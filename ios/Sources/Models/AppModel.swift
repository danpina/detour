import Foundation
import Observation

extension SessionItem {
    /// Stable identity of an item within a set (also used to tell "already completed").
    var key: String {
        switch self {
        case .review(let card, let probe, _): return "review:\(card.id):\(probe.id)"
        case .new(let card): return "new:\(card.id)"
        case .drill(let spec): return "drill:\(spec.track.rawValue):\(spec.seed)"
        }
    }

    /// The id recorded in events. Drills have no card, so they use a stable pseudo id.
    var eventCardId: String {
        switch self {
        case .review(let card, _, _): return card.id
        case .new(let card): return card.id
        case .drill(let spec): return "drill:\(spec.track.rawValue)"
        }
    }
}

struct SkillSummary: Identifiable {
    let track: TrackId
    let name: String
    let level: Int
    let maxLevel: Int
    let levelName: String
    let recentRight: Int
    let recentTotal: Int
    var id: String { track.rawValue }
}

struct ProgressSnapshot {
    let streak: Int
    let bestStreak: Int
    let freezesLeft: Int
    let recall: (total: Int, correct: Int, rate: Double?)
    let map: [Interest: [(id: String, state: ProgressStats.CardState)]]
    let skills: [SkillSummary]
    let recap: ProgressStats.Recap
}

/// The app's brain: owns the user's data, builds sets, and records what happens. All logic lives in the engine
/// types; this class only wires them to storage so the screens stay simple.
@MainActor
@Observable
final class AppModel {
    private(set) var data: AppData
    let content: LoadedContent
    @ObservationIgnored private let store: DataStore
    @ObservationIgnored private let clock: () -> Date
    @ObservationIgnored private let calendar: Calendar

    var cards: [Card] { content.cards }
    var settings: UserSettings { data.settings }

    init(store: DataStore = DataStore(), content: LoadedContent = ContentStore.load(), clock: @escaping () -> Date = { Date() }, calendar: Calendar = .current) {
        self.store = store
        self.content = content
        self.clock = clock
        self.calendar = calendar
        self.data = store.load()
        pruneEvents(olderThanDays: 90)
    }

    // MARK: Settings

    func updateSettings(_ change: (inout UserSettings) -> Void) {
        change(&data.settings)
        persist()
    }

    func completeOnboarding(interests: [Interest]) {
        updateSettings {
            $0.interests = interests
            $0.onboardingDone = true
        }
    }

    // MARK: Sets

    var completedCardIds: Set<String> {
        Set(data.events.filter { $0.kind == .complete }.map { $0.cardId })
    }

    func makeSet() -> [SessionItem] {
        let now = clock()
        let track = Skills.nextTrack(data.skills)
        let level = data.skills.first { $0.track == track }?.level ?? 1
        let drill = DrillSpec(track: track, level: level, seed: UInt32.random(in: 0..<(1 << 31)))
        let events = data.events.map { (cardId: $0.cardId, kind: $0.kind.rawValue) }
        let input = EngineInput(
            cards: cards,
            reviews: data.reviews,
            completed: completedCardIds,
            interests: data.settings.interests,
            engagement: SessionEngine.engagement(events: events, cards: cards),
            now: now,
            setSize: data.settings.setSize,
            drill: drill
        )
        return SessionEngine.build(input)
    }

    /// Recall checks that are due right now.
    var dueCount: Int {
        SessionEngine.dueReviews(cards: cards, reviews: data.reviews, now: clock()).count
    }

    // MARK: Recording what happens

    func viewed(_ item: SessionItem) {
        append(AppEvent(cardId: item.eventCardId, kind: .view, msSpent: 0, at: clock()))
    }

    func skipped(_ item: SessionItem, ms: Int) {
        append(AppEvent(cardId: item.eventCardId, kind: .skip, msSpent: ms, at: clock()))
    }

    /// A card was finished (revealed, answered, read to the end).
    /// - New card: its probes are scheduled for tomorrow ("we'll check tomorrow if they stuck").
    /// - Review: the answer is rated automatically and rescheduled.
    func completed(_ item: SessionItem, correct: Bool?, ms: Int) {
        let now = clock()
        var event = AppEvent(cardId: item.eventCardId, kind: .complete, msSpent: ms, at: now)
        switch item {
        case .new(let card):
            for probe in card.probes where !data.reviews.contains(where: { $0.probeId == probe.id }) {
                data.reviews.append(Reviews.newReview(probeId: probe.id, cardId: card.id, now: now, calendar: calendar))
            }
        case .review(_, let probe, let review):
            event.probeId = probe.id
            event.correct = correct ?? false
            let rating = Reviews.rating(kind: probe.kind, correct: correct ?? false, ms: ms)
            let current = data.reviews.first { $0.probeId == probe.id } ?? review
            let updated = Reviews.apply(current, grade: rating, now: now)
            if let i = data.reviews.firstIndex(where: { $0.probeId == probe.id }) { data.reviews[i] = updated } else { data.reviews.append(updated) }
        case .drill:
            break
        }
        data.events.append(event)
        recordActivity(now: now)
        persist()
    }

    func reported(cardId: String, reason: String) {
        append(AppEvent(cardId: cardId, kind: .report, msSpent: 0, at: clock(), reason: reason))
    }

    func sessionFinished(cardsDone: Int, source: String = "free") {
        data.sessions.append(SessionRecord(startedAt: clock(), cardsDone: cardsDone, source: source))
        persist()
    }

    func recordDrillRound(track: TrackId, results: [Bool]) -> (progress: SkillProgress, leveledUp: Bool) {
        let current = data.skills.first { $0.track == track } ?? SkillProgress(track: track)
        let out = Skills.apply(current, results: results, now: clock())
        if let i = data.skills.firstIndex(where: { $0.track == track }) { data.skills[i] = out.progress } else { data.skills.append(out.progress) }
        persist()
        return out
    }

    private func recordActivity(now: Date) {
        data.streak = Streaks.recordDay(data.streak, today: Days.key(now, calendar: calendar))
    }

    // MARK: Progress screen

    func progress() -> ProgressSnapshot {
        let now = clock()
        let shown = Streaks.display(data.streak, today: Days.key(now, calendar: calendar))
        let skills = TrackId.allCases.map { id -> SkillSummary in
            let p = data.skills.first { $0.track == id }
            let info = Drills.info(id)
            let level = p?.level ?? 1
            return SkillSummary(track: id, name: info.name, level: level, maxLevel: info.maxLevel, levelName: info.levels[level - 1],
                                recentRight: p?.recentResults.filter { $0 }.count ?? 0, recentTotal: p?.recentResults.count ?? 0)
        }
        return ProgressSnapshot(
            streak: shown.current,
            bestStreak: max(data.streak.best, shown.current),
            freezesLeft: shown.freezesLeft,
            recall: ProgressStats.recall(events: data.events, now: now, days: 30),
            map: ProgressStats.knowledgeMap(cards: cards, completed: completedCardIds, reviews: data.reviews),
            skills: skills,
            recap: ProgressStats.weeklyRecap(events: data.events, streak: shown.current, now: now, calendar: calendar)
        )
    }

    // MARK: Housekeeping

    func eraseEverything() {
        data = AppData()
        store.erase()
    }

    private func pruneEvents(olderThanDays days: Int) {
        let cutoff = clock().addingTimeInterval(-Double(days) * 86_400)
        let before = data.events.count
        data.events.removeAll { $0.at < cutoff }
        if data.events.count != before { persist() }
    }

    private func append(_ event: AppEvent) {
        data.events.append(event)
        persist()
    }

    private func persist() {
        store.save(data)
    }
}
