import XCTest
@testable import Detour

final class ContentTests: XCTestCase {
    func testBundledCardsDecode() {
        let content = ContentStore.load()
        XCTAssertNotNil(content.root, "The published folder should be bundled in the app")
        XCTAssertTrue(content.issues.isEmpty, content.issues.joined(separator: "\n"))
        XCTAssertGreaterThan(content.cards.count, 0)
    }

    func testEveryCardHasProbesSourcesAndImage() {
        let content = ContentStore.load()
        for card in content.cards {
            XCTAssertFalse(card.probes.isEmpty, "\(card.id) needs a probe")
            XCTAssertFalse(card.sources.isEmpty, "\(card.id) needs a source")
            XCTAssertNotNil(card.image, "\(card.id) needs an image")
            XCTAssertNotNil(ContentStore.image(for: card, root: content.root), "\(card.id) image should load")
        }
    }

    func testProbeAnswersMatchTheirKind() {
        for card in ContentStore.load().cards {
            for probe in card.probes {
                switch (probe.kind, probe.answer) {
                case (.mcq, .index(let i)): XCTAssertLessThan(i, probe.options?.count ?? 0, probe.id)
                case (.tf, .bool), (.estimate, .number), (.cloze, .text): break
                default: XCTFail("\(probe.id) has an answer that does not match its kind")
                }
            }
        }
    }
}
