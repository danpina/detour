import XCTest
@testable import Detour

@MainActor
final class LearnedTests: XCTestCase {
    private let cards = ContentStore.load().cards

    private func rows(_ count: Int) -> [LearnedRow] {
        cards.prefix(count).enumerated().map { LearnedRow(card: $1, learnedAt: Date(timeIntervalSince1970: Double($0)), state: .seen) }
    }

    func testEveryCardHasReadableText() {
        XCTAssertFalse(cards.isEmpty)
        for card in cards {
            let text = Learned.paragraphs(card)
            XCTAssertFalse(text.isEmpty, card.id)
            let joined = text.joined(separator: " ")
            XCTAssertFalse(joined.contains("NaN") || joined.contains("Optional("), card.id)
        }
    }

    func testSearchByWordsAndTopic() {
        let all = rows(40)
        guard let first = all.first else { return XCTFail("no cards") }
        let word = first.card.title.split(separator: " ").map(String.init).first { $0.count > 4 } ?? first.card.title
        XCTAssertTrue(Learned.filter(all, query: word.uppercased(), topic: nil).contains { $0.card.id == first.card.id })
        XCTAssertTrue(Learned.filter(all, query: "zzzzqqqq", topic: nil).isEmpty)
        XCTAssertEqual(Learned.filter(all, query: "  ", topic: nil).count, all.count)
        let topic = first.card.interest
        XCTAssertTrue(Learned.filter(all, query: "", topic: topic).allSatisfy { $0.card.interest == topic })
    }

    func testSaysHowLongAgoInPlainWords() {
        let now = Date(timeIntervalSince1970: 100 * 86_400)
        func ago(_ days: Double, hours: Double = 0) -> String { Learned.ago(now.addingTimeInterval(-(days * 86_400 + hours * 3600)), now: now) }
        XCTAssertEqual(ago(0, hours: 1), "today")
        XCTAssertEqual(ago(1), "yesterday")
        XCTAssertEqual(ago(5), "5 days ago")
        XCTAssertEqual(ago(21), "3 weeks ago")
        XCTAssertEqual(ago(95), "3 months ago")
    }

    func testNothingIsLearnedBeforeAnythingIsFinished() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("detour-test-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let model = AppModel(store: DataStore(url: url), content: ContentStore.load(), clock: { Date() })
        XCTAssertTrue(model.learnedCards().isEmpty)
    }
}
