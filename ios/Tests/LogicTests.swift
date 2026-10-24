import XCTest
@testable import Detour

final class LogicTests: XCTestCase {
    private var items: [LogicItem] { LogicData.load() }

    func testBundledPuzzlesLoadWithValidAnswers() {
        let items = self.items
        XCTAssertGreaterThan(items.count, 40)
        XCTAssertEqual(Set(items.map { $0.id }).count, items.count)
        for item in items {
            XCTAssertTrue(item.options.contains(item.answer), item.id)
            XCTAssertEqual(Set(item.options).count, item.options.count, item.id)
        }
    }

    func testFirstRoundIsLevelOneWithNoRepeatsAndMixedKinds() {
        var rng = SystemRandomNumberGenerator()
        let round = LogicBuilder.round(all: items, progress: LogicProgress(), length: 5, using: &rng)
        XCTAssertEqual(round.count, 5)
        XCTAssertEqual(Set(round.map { $0.id }).count, 5)
        XCTAssertTrue(round.allSatisfy { $0.level == 1 })
        XCTAssertGreaterThan(Set(round.map { $0.kind }).count, 1)
    }

    func testMissedPuzzlesComeBackAndLevelsOpen() {
        var rng = SystemRandomNumberGenerator()
        let round = LogicBuilder.round(all: items, progress: LogicProgress(solved: [:], missed: ["fal-1"]), length: 2, using: &rng)
        XCTAssertTrue(round.map { $0.id }.contains("fal-1"))
        XCTAssertEqual(LogicBuilder.unlockedLevel(LogicProgress()), 1)
        let solved = Dictionary(uniqueKeysWithValues: items.prefix(8).map { ($0.id, 1) })
        XCTAssertEqual(LogicBuilder.unlockedLevel(LogicProgress(solved: solved, missed: [])), 2)
    }

    func testAnswersUpdateProgress() {
        var p = LogicBuilder.apply(LogicProgress(), id: "syl-1", right: false)
        XCTAssertEqual(p.missed, ["syl-1"])
        p = LogicBuilder.apply(p, id: "syl-1", right: true)
        XCTAssertEqual(p.missed, [])
        XCTAssertEqual(p.solved["syl-1"], 1)
    }
}
