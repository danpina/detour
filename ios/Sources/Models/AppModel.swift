import Foundation
import Observation

extension SessionItem {
    /// Stable identity of an item within a set (also used to tell "already completed").
    var key: String {
        switch self {
        case .review(let card, let probe, _): return "review:\(card.id):\(probe.id)"
        case .new(let card): return "new:\(card.id)"
        case .drill(let spec): return "drill:\(spec.track.rawValue):\(spec.seed)"
        case .game(let id): return "game:\(id.rawValue)"
        }
    }

    /// The id recorded in events. Drills have no card, so they use a stable pseudo id.
    var eventCardId: String {
        switch self {
        case .review(let card, _, _): return card.id
        case .new(let card): return card.id
        case .drill(let spec): return "drill:\(spec.track.rawValue)"
        case .game(let id): return "game:\(id.rawValue)"
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
    /// Problems answered in total.
    let attempts: Int
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

    /// The player's level in mental math, shown on the Math round.
    var mathLevel: Int { data.skills.first { $0.track == .mentalMath }?.level ?? 1 }

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
        let s = data.settings
        AppLog.log("settings: interests=\(s.interests.map { $0.rawValue }.joined(separator: ",")) setSize=\(s.setSize) drills=\(String(describing: s.drills)) reminder=\(s.reminderEnabled)")
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

    /// The three kinds of round on the home screen. Each has its own place: cards, math, or games.
    enum RoundKind: String, CaseIterable {
        case learning, math, games
    }

    /// What a round from "Pick something specific" is about: one topic's cards, only the cards due for review, or one math skill.
    enum Specific: Hashable {
        case topic(Interest)
        case due
        case skill(TrackId)
    }

    /// Builds a round of the given kind: cards (learning), skill drills (math) or a few games (games).
    /// With `specific` it is a round of one topic, the due cards, or one math skill instead.
    func makeSet(kind: RoundKind = .learning, specific: Specific? = nil) -> [SessionItem] {
        if let specific { return specificRound(specific) }
        switch kind {
        case .games:
            // One setting sets the length of every round: N cards, N math problems or N games (each a single puzzle).
            let games = GameId.allCases.shuffled().prefix(data.settings.setSize).map { SessionItem.game($0) }
            AppLog.log("round built: games=\(games.map { $0.key }.joined(separator: ", "))")
            return Array(games)
        case .math:
            return mathRound()
        case .learning:
            return learningRound()
        }
    }

    /// The math skills that are in rounds. Skills can be switched off in the skills page; at least one stays on.
    var mathSkillsOn: [TrackId] {
        let off = data.settings.mathOff ?? []
        return TrackId.allCases.filter { !off.contains($0.rawValue) }
    }

    /// A math round of N problems, mixed across the skills that are on: one problem per skill, the one practised least recently
    /// first (never-practised ones before that), each at the player's level in it. With more problems than skills it goes round again.
    private func mathRound() -> [SessionItem] {
        let size = data.settings.setSize
        let pool = mathSkillsOn.isEmpty ? TrackId.allCases : mathSkillsOn
        func lastAt(_ track: TrackId) -> Date { data.skills.first { $0.track == track }?.lastAt ?? .distantPast }
        // Least recently practised first; ties keep the list order, like the web app.
        let ranked = pool.enumerated().sorted { a, b in
            lastAt(a.element) == lastAt(b.element) ? a.offset < b.offset : lastAt(a.element) < lastAt(b.element)
        }.map { $0.element }
        var counts: [TrackId: Int] = [:]
        for i in 0..<size { counts[ranked[i % ranked.count], default: 0] += 1 }
        let items = ranked.filter { counts[$0] != nil }.map { track -> SessionItem in
            let level = data.skills.first { $0.track == track }?.level ?? 1
            return .drill(DrillSpec(track: track, level: level, seed: UInt32.random(in: 0..<(1 << 31)), count: counts[track] ?? 1))
        }
        AppLog.log("round built: math items=[\(items.map { $0.key }.joined(separator: ", "))]")
        return items
    }

    private func specificRound(_ specific: Specific) -> [SessionItem] {
        let size = data.settings.setSize
        switch specific {
        case .skill(let track):
            let level = data.skills.first { $0.track == track }?.level ?? 1
            return [.drill(DrillSpec(track: track, level: level, seed: UInt32.random(in: 0..<(1 << 31)), count: size))]
        case .due:
            return SessionEngine.dueReviews(cards: cards, reviews: data.reviews, now: clock()).prefix(size).map {
                SessionItem.review(card: $0.card, probe: $0.probe, review: $0.review)
            }
        case .topic(let interest):
            return learningRound(only: interest)
        }
    }

    /// A skill's level and how many problems have been answered in it.
    func skillStatus(_ track: TrackId) -> (level: Int, attempts: Int) {
        let p = data.skills.first { $0.track == track }
        return (p?.level ?? 1, p?.attemptsTotal ?? 0)
    }

    /// How many cards a topic has, and how many of its checks are due. For the "Pick something specific" list.
    func topicCounts(_ interest: Interest) -> (cards: Int, due: Int) {
        let total = cards.filter { $0.interest == interest && $0.type != "drill" && $0.type != "recall" }.count
        let due = SessionEngine.dueReviews(cards: cards, reviews: data.reviews, now: clock()).filter { $0.card.interest == interest }.count
        return (total, due)
    }

    /// A learning round is cards only: reviews of what you learned, and new cards from your topics.
    private func learningRound(only topic: Interest? = nil) -> [SessionItem] {
        let now = clock()
        let events = data.events.map { (cardId: $0.cardId, kind: $0.kind.rawValue) }
        let input = EngineInput(
            cards: topic.map { t in cards.filter { $0.interest == t } } ?? cards,
            reviews: data.reviews,
            completed: completedCardIds,
            interests: topic.map { [$0] } ?? data.settings.interests,
            engagement: SessionEngine.engagement(events: events, cards: cards),
            now: now,
            setSize: data.settings.setSize,
            lastShown: lastShown
        )
        let items = SessionEngine.build(input)
        let list = items.map { $0.key }.joined(separator: ", ")
        AppLog.log("set built: size=\(data.settings.setSize) due=\(dueCount) completedCards=\(completedCardIds.count) reviewRows=\(data.reviews.count) shownBefore=\(lastShown.count) items=[\(list)]")
        return items
    }

    /// When each card was last shown, from the view events. Used so the same card does not keep coming back.
    var lastShown: [String: Date] {
        var out: [String: Date] = [:]
        for e in data.events where e.kind == .view {
            if let d = out[e.cardId], d >= e.at { continue }
            out[e.cardId] = e.at
        }
        return out
    }

    /// Recall checks that are due right now.
    var dueCount: Int {
        SessionEngine.dueReviews(cards: cards, reviews: data.reviews, now: clock()).count
    }

    // MARK: Recording what happens

    func viewed(_ item: SessionItem) {
        append(AppEvent(cardId: item.eventCardId, kind: .view, msSpent: 0, at: clock()))
        AppLog.log("view \(item.key)")
    }

    func skipped(_ item: SessionItem, ms: Int) {
        append(AppEvent(cardId: item.eventCardId, kind: .skip, msSpent: ms, at: clock()))
        AppLog.log("skip \(item.key) after \(ms) ms")
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
        case .drill, .game:
            break
        }
        data.events.append(event)
        recordActivity(now: now)
        persist()
        AppLog.log("complete \(item.key) correct=\(String(describing: correct)) ms=\(ms)")
    }

    func reported(cardId: String, reason: String) {
        append(AppEvent(cardId: cardId, kind: .report, msSpent: 0, at: clock(), reason: reason))
    }

    func sessionFinished(cardsDone: Int, source: String = "free") {
        data.sessions.append(SessionRecord(startedAt: clock(), cardsDone: cardsDone, source: source))
        persist()
        AppLog.log("set finished: cardsDone=\(cardsDone) source=\(source) totalSessions=\(data.sessions.count)")
    }

    func recordDrillRound(track: TrackId, results: [Bool]) -> (progress: SkillProgress, leveledUp: Bool) {
        let current = data.skills.first { $0.track == track } ?? SkillProgress(track: track)
        let out = Skills.apply(current, results: results, now: clock())
        if let i = data.skills.firstIndex(where: { $0.track == track }) { data.skills[i] = out.progress } else { data.skills.append(out.progress) }
        persist()
        AppLog.log("drill round: track=\(track.rawValue) results=\(results.map { $0 ? "1" : "0" }.joined()) level=\(out.progress.level) leveledUp=\(out.leveledUp)")
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
                                recentRight: p?.recentResults.filter { $0 }.count ?? 0, recentTotal: p?.recentResults.count ?? 0, attempts: p?.attemptsTotal ?? 0)
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
