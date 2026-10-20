import XCTest
@testable import Detour

/// Mirrors web/src/lib/engine.test.ts so both apps build the same kinds of sets.
final class EngineTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private let day: TimeInterval = 86_400

    private func card(_ id: String, _ interest: Interest = .science, type: String = "fact_why") -> Card {
        Card(id: id, interest: interest, type: type, title: id,
             body: .factWhy(claim: "claim", why: "why"),
             probes: [Probe.trueFalse(id: "\(id)-p1")])
    }

    private func review(_ c: Card, dueInDays: Double) -> ReviewRow {
        var row = Reviews.newReview(probeId: "\(c.id)-p1", cardId: c.id, now: now)
        row.card.dueMs = Int64((now.timeIntervalSince1970 + dueInDays * day) * 1000)
        return row
    }

    private lazy var pool: [Card] = [
        card("sci-0001"), card("sci-0002", .science, type: "estimate"), card("hist-0001", .history, type: "story"),
        card("hist-0002", .history, type: "guess_first"), card("money-0001", .money, type: "story"),
        card("tech-0001", .tech, type: "story"), card("num-0001", .numbers, type: "estimate"), card("mind-0001", .mind),
    ]
    private let drill = DrillSpec(track: .mentalMath, level: 1, seed: 1)

    private func input(reviews: [ReviewRow] = [], completed: Set<String> = [], cards: [Card]? = nil, interests: [Interest] = [.science, .history, .money],
                       drill: DrillSpec? = nil, engagement: [Interest: Double] = [:]) -> EngineInput {
        EngineInput(cards: cards ?? pool, reviews: reviews, completed: completed, interests: interests, engagement: engagement, now: now, drill: drill)
    }

    private func kinds(_ items: [SessionItem]) -> [String] {
        items.map { item in
            switch item {
            case .review: return "review"
            case .new: return "new"
            case .drill: return "drill"
            }
        }
    }

    private func ids(_ items: [SessionItem]) -> [String] {
        items.map { item in
            switch item {
            case .review(let c, _, _): return c.id
            case .new(let c): return c.id
            case .drill(let d): return "drill:\(d.track.rawValue)"
            }
        }
    }

    func testMixIsTwoReviewsTwoNewOneDrill() {
        let reviews = [review(pool[0], dueInDays: -1), review(pool[1], dueInDays: -2), review(pool[2], dueInDays: -0.5)]
        let items = SessionEngine.build(input(reviews: reviews, completed: ["sci-0001", "sci-0002", "hist-0001"], drill: drill))
        XCTAssertEqual(items.count, 5)
        XCTAssertEqual(kinds(items).filter { $0 == "review" }.count, 2)
        XCTAssertEqual(kinds(items).filter { $0 == "new" }.count, 2)
        XCTAssertEqual(kinds(items).last, "drill")
        XCTAssertEqual(Set(ids(items)).count, 5)
    }

    func testMostOverdueReviewsComeFirst() {
        let reviews = [review(pool[0], dueInDays: -1), review(pool[1], dueInDays: -5), review(pool[2], dueInDays: -3)]
        let items = SessionEngine.build(input(reviews: reviews, completed: ["sci-0001", "sci-0002", "hist-0001"], drill: drill))
        let reviewIds = zip(kinds(items), ids(items)).filter { $0.0 == "review" }.map { $0.1 }
        XCTAssertEqual(reviewIds, ["sci-0002", "hist-0001"])
    }

    func testReviewAndNewAlternateStartingWithReview() {
        let reviews = [review(pool[0], dueInDays: -1), review(pool[1], dueInDays: -2)]
        let items = SessionEngine.build(input(reviews: reviews, completed: ["sci-0001", "sci-0002"], drill: drill))
        XCTAssertEqual(kinds(items), ["review", "new", "review", "new", "drill"])
    }

    func testEmptyReviewSlotsFillWithNewCards() {
        XCTAssertEqual(kinds(SessionEngine.build(input(drill: drill))), ["new", "new", "new", "new", "drill"])
    }

    func testReviewsNotYetDueAreSkipped() {
        let items = SessionEngine.build(input(reviews: [review(pool[0], dueInDays: 1)], completed: ["sci-0001"], drill: drill))
        XCTAssertFalse(kinds(items).contains("review"))
        XCTAssertFalse(ids(items).contains("sci-0001"))
    }

    func testDrillSlotGoesToContentWhenNoDrill() {
        let items = SessionEngine.build(input())
        XCTAssertEqual(items.count, 5)
        XCTAssertTrue(kinds(items).allSatisfy { $0 == "new" })
    }

    func testExtraDueReviewsFillWhenNewCardsRunOut() {
        let only = Array(pool.prefix(5))
        let reviews = only.enumerated().map { review($0.element, dueInDays: -Double($0.offset + 1)) }
        let items = SessionEngine.build(input(reviews: reviews, completed: Set(only.map { $0.id }), cards: only, interests: [.science], drill: drill))
        XCTAssertGreaterThanOrEqual(kinds(items).filter { $0 == "review" }.count, 2)
        XCTAssertEqual(items.count, 5)
        XCTAssertEqual(Set(ids(items)).count, 5)
    }

    func testSeenCardsRepeatInsteadOfATinySet() {
        let only = Array(pool.prefix(3))
        let items = SessionEngine.build(input(completed: Set(only.map { $0.id }), cards: only))
        XCTAssertEqual(items.count, 3)
    }

    func testBacklogMovesTowardHalfReviews() {
        XCTAssertEqual(SessionEngine.reviewTarget(dueCount: 0, setSize: 5), 2)
        XCTAssertEqual(SessionEngine.reviewTarget(dueCount: 6, setSize: 5), 3)
        XCTAssertEqual(SessionEngine.reviewTarget(dueCount: 0, setSize: 3), 1)
        XCTAssertEqual(SessionEngine.reviewTarget(dueCount: 0, setSize: 8), 3)
    }

    func testMostEngagingInterestComesFirst() {
        let events: [(cardId: String, kind: String)] = [
            ("hist-0001", "complete"), ("hist-0002", "complete"), ("sci-0001", "skip"), ("sci-0002", "skip"),
        ]
        let eng = SessionEngine.engagement(events: events, cards: pool)
        XCTAssertEqual(eng[.history], 1)
        XCTAssertEqual(eng[.science], 0)
        let items = SessionEngine.build(input(interests: [.science, .history], engagement: eng))
        if case .new(let first)? = items.first { XCTAssertEqual(first.interest, .history) } else { XCTFail("expected a new card first") }
    }

    func testReviewSchedulingAndRating() {
        XCTAssertEqual(Reviews.rating(kind: .tf, correct: false, ms: 100), .again)
        XCTAssertEqual(Reviews.rating(kind: .tf, correct: true, ms: 3_000), .easy)
        XCTAssertEqual(Reviews.rating(kind: .tf, correct: true, ms: 3_001), .good)
        XCTAssertEqual(Reviews.rating(kind: .cloze, correct: true, ms: 10_000), .easy)

        let row = Reviews.newReview(probeId: "p", cardId: "c", now: now)
        XCTAssertEqual(row.card.state, .new)
        XCTAssertGreaterThan(Reviews.dueDate(row).timeIntervalSince(now), 6 * 3600)
        let after = Reviews.apply(row, grade: .good, now: Reviews.dueDate(row))
        XCTAssertEqual(after.card.state, .review)
        XCTAssertGreaterThan(after.card.dueMs, row.card.dueMs)
    }
}
