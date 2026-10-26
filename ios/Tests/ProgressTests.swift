import XCTest
@testable import Detour

/// Mirrors web/src/lib/progress.test.ts.
final class ProgressTests: XCTestCase {
    private let mon = "2026-10-12" // a Monday

    private func run(_ days: [String], from start: StreakState = StreakState()) -> StreakState {
        days.reduce(start) { Streaks.recordDay($0, today: $1) }
    }

    func testWeeksStartOnMonday() {
        XCTAssertEqual(Days.weekKey("2026-10-12"), "2026-10-12")
        XCTAssertEqual(Days.weekKey("2026-10-18"), "2026-10-12")
        XCTAssertEqual(Days.weekKey("2026-10-19"), "2026-10-19")
        XCTAssertEqual(Days.between("2026-10-30", "2026-11-02"), 3)
        XCTAssertEqual(Days.add("2026-12-31", 1), "2027-01-01")
        XCTAssertEqual(Days.add("2028-02-28", 1), "2028-02-29")
        XCTAssertEqual(Days.number("1970-01-01"), 0)
    }

    func testStreakStartsAtOneAndIgnoresRepeats() {
        let s = run([mon, mon])
        XCTAssertEqual(s.current, 1)
        XCTAssertEqual(s.freezesLeft, 2)
    }

    func testConsecutiveDaysCount() {
        let s = run([mon, Days.add(mon, 1), Days.add(mon, 2)])
        XCTAssertEqual(s.current, 3)
        XCTAssertEqual(s.best, 3)
    }

    func testMissedDaySpendsAFreeze() {
        let s = run([mon, Days.add(mon, 2)])
        XCTAssertEqual(s.current, 2)
        XCTAssertEqual(s.freezesLeft, 1)
    }

    func testTwoMissedDaysUseBothFreezesAndThirdBreaks() {
        let two = run([mon, Days.add(mon, 3)])
        XCTAssertEqual(two.current, 2)
        XCTAssertEqual(two.freezesLeft, 0)
        let three = run([mon, Days.add(mon, 4)])
        XCTAssertEqual(three.current, 1)
        XCTAssertEqual(three.best, 1)
    }

    func testFreezesRefillOnMonday() {
        let s = run([0, 1, 2, 3, 4, 5, 7].map { Days.add(mon, $0) })
        XCTAssertEqual(s.current, 7)
        XCTAssertEqual(s.freezesLeft, 2)
    }

    func testLongBreakResetsButKeepsBest() {
        let s = run([mon, Days.add(mon, 1), Days.add(mon, 2), Days.add(mon, 40)])
        XCTAssertEqual(s.current, 1)
        XCTAssertEqual(s.best, 3)
    }

    func testDisplayStreakKeepsCoveredGapsAlive() {
        let s = run([mon, Days.add(mon, 1)])
        XCTAssertEqual(Streaks.display(s, today: Days.add(mon, 1)).current, 2)
        XCTAssertEqual(Streaks.display(s, today: Days.add(mon, 3)).current, 2)
        XCTAssertEqual(Streaks.display(s, today: Days.add(mon, 6)).current, 0)
        XCTAssertEqual(Streaks.display(StreakState(), today: mon).current, 0)
    }

    func testRecallStatsCountOnlyAnswersInTheWindow() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        func ev(_ daysAgo: Double, _ correct: Bool?) -> AppEvent {
            AppEvent(cardId: "sci-0001", kind: .complete, msSpent: 5000, at: now.addingTimeInterval(-daysAgo * 86_400),
                     probeId: correct == nil ? nil : "sci-0001-p1", correct: correct)
        }
        let stats = ProgressStats.recall(events: [ev(1, true), ev(2, true), ev(3, true), ev(4, false), ev(40, false), ev(1, nil)], now: now, days: 30)
        XCTAssertEqual(stats.total, 4)
        XCTAssertEqual(stats.correct, 3)
        XCTAssertEqual(stats.rate, 0.75)
        XCTAssertNil(ProgressStats.recall(events: [], now: now, days: 30).rate)
    }

    func testKnowledgeMapStates() {
        func card(_ id: String) -> Card {
            Card(id: id, interest: .science, type: "fact_why", title: id, body: .factWhy(claim: "c", why: "w"), probes: [Probe.trueFalse(id: "\(id)-p1")])
        }
        func row(_ stability: Double, reps: Int = 1) -> ReviewRow {
            var c = FSRSCard(dueMs: 0)
            c.stability = stability
            c.reps = reps
            return ReviewRow(probeId: "sci-0001-p1", cardId: "sci-0001", card: c)
        }
        let c = card("sci-0001")
        XCTAssertEqual(ProgressStats.cardState(c, completed: [], reviews: [:]), .new)
        XCTAssertEqual(ProgressStats.cardState(c, completed: ["sci-0001"], reviews: ["sci-0001-p1": row(0, reps: 0)]), .seen)
        XCTAssertEqual(ProgressStats.cardState(c, completed: ["sci-0001"], reviews: ["sci-0001-p1": row(5)]), .learning)
        XCTAssertEqual(ProgressStats.cardState(c, completed: ["sci-0001"], reviews: ["sci-0001-p1": row(30)]), .solid)
    }
}

/// End-to-end behaviour of the app's brain, using a temporary file for storage.
@MainActor
final class AppModelTests: XCTestCase {
    private func makeModel() -> (AppModel, URL) {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("detour-test-\(UUID().uuidString).json")
        let fixed = Date(timeIntervalSince1970: 1_800_000_000)
        return (AppModel(store: DataStore(url: url), content: ContentStore.load(), clock: { fixed }), url)
    }

    private func isDrill(_ item: SessionItem) -> Bool { if case .drill = item { return true } else { return false } }
    private func isGame(_ item: SessionItem) -> Bool { if case .game = item { return true } else { return false } }

    func testOnboardingThenALearningRoundOfFiveCards() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.history, .science, .numbers])
        XCTAssertTrue(model.settings.onboardingDone)
        let items = model.makeSet()
        XCTAssertEqual(items.count, 5)
        XCTAssertFalse(items.contains(where: isDrill), "a learning round is cards only")
        XCTAssertFalse(items.contains(where: isGame), "a learning round is cards only")
        XCTAssertEqual(Set(items.map { $0.key }).count, items.count)
    }

    func testLearningRoundsOnlyUseTheChosenTopics() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.history, .science, .money])
        for item in model.makeSet(kind: .learning) {
            switch item {
            case .drill, .game: XCTFail("a learning round has no drills or games")
            case .new(let c): XCTAssertTrue([Interest.history, .science, .money].contains(c.interest), c.id + " is from a topic the user did not pick")
            case .review: break
            }
        }
    }

    func testAMathRoundIsMentalMathThenAnotherSkillAtTheirLevels() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.history, .science, .money])
        let items = model.makeSet(kind: .math)
        XCTAssertEqual(items.count, 2)
        guard case .drill(let first) = items[0], case .drill(let second) = items[1] else { return XCTFail("both items should be drills") }
        XCTAssertEqual(first.track, .mentalMath)
        XCTAssertNotEqual(second.track, .mentalMath)
        XCTAssertEqual(first.level, 1)
        XCTAssertEqual(model.mathLevel, 1)
    }

    func testAGamesRoundIsThreeDifferentGames() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.history, .science, .money])
        let items = model.makeSet(kind: .games)
        XCTAssertEqual(items.count, AppModel.gamesPerRound)
        XCTAssertTrue(items.allSatisfy(isGame))
        XCTAssertEqual(Set(items.map { $0.key }).count, items.count)
    }

    func testFinishingANewCardSchedulesItsProbesForTomorrowAndStartsTheStreak() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.history, .science, .money])
        guard case .new(let card)? = model.makeSet().first else { return XCTFail("expected a new card first") }
        model.completed(.new(card), correct: nil, ms: 4_000)
        XCTAssertEqual(model.data.reviews.count, card.probes.count)
        XCTAssertEqual(model.data.streak.current, 1)
        XCTAssertTrue(model.completedCardIds.contains(card.id))
        XCTAssertEqual(model.dueCount, 0, "nothing is due until tomorrow")
    }

    func testProgressSurvivesARestart() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        model.completeOnboarding(interests: [.tech, .mind, .numbers])
        guard case .new(let card)? = model.makeSet().first else { return XCTFail("expected a new card first") }
        model.completed(.new(card), correct: nil, ms: 1_000)

        let again = AppModel(store: DataStore(url: url), content: ContentStore.load())
        XCTAssertEqual(again.settings.interests, [.tech, .mind, .numbers])
        XCTAssertEqual(again.data.reviews.count, card.probes.count)
        XCTAssertTrue(again.completedCardIds.contains(card.id))
    }

    func testReviewAnswersRescheduleAndRecordRecall() {
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("detour-test-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        var clock = start
        let model = AppModel(store: DataStore(url: url), content: ContentStore.load(), clock: { clock })
        model.completeOnboarding(interests: [.history, .science, .money])
        guard case .new(let card)? = model.makeSet().first else { return XCTFail("expected a new card first") }
        model.completed(.new(card), correct: nil, ms: 1_000)

        clock = start.addingTimeInterval(3 * 86_400) // three days later the check is due
        XCTAssertGreaterThan(model.dueCount, 0)
        guard let review = model.makeSet().compactMap({ item -> SessionItem? in if case .review = item { return item } else { return nil } }).first,
              case .review(_, let probe, let row) = review else { return XCTFail("expected a due review") }
        model.completed(review, correct: true, ms: 1_500)

        let updated = model.data.reviews.first { $0.probeId == probe.id }!
        XCTAssertGreaterThan(updated.card.dueMs, row.card.dueMs)
        XCTAssertEqual(updated.card.state, .review)
        let stats = ProgressStats.recall(events: model.data.events, now: clock, days: 30)
        XCTAssertEqual(stats.total, 1)
        XCTAssertEqual(stats.correct, 1)
    }

    func testDrillRoundsLevelUpTracks() {
        let (model, url) = makeModel()
        defer { try? FileManager.default.removeItem(at: url) }
        var leveled = false
        for _ in 0..<7 { leveled = model.recordDrillRound(track: .mentalMath, results: [true, true, true]).leveledUp }
        XCTAssertTrue(leveled)
        XCTAssertEqual(model.data.skills.first?.level, 2)
    }
}
