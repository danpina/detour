import XCTest
@testable import Detour

final class PatternsTests: XCTestCase {
    func testPuzzlesLoadFromTheBundle() {
        let puzzles = PatternsData.load()
        XCTAssertGreaterThan(puzzles.count, 250)
        for level in [1, 2, 3] {
            XCTAssertFalse(puzzles.filter { $0.level == level }.isEmpty, "no puzzles at level \(level)")
        }
    }

    func testEveryAnswerIsInItsOptions() {
        for puzzle in PatternsData.load() {
            XCTAssertEqual(puzzle.options.count, 4, puzzle.id)
            XCTAssertEqual(Set(puzzle.options).count, 4, "\(puzzle.id) has duplicate options")
            XCTAssertTrue(puzzle.options.contains(puzzle.answer), "\(puzzle.id) answer missing from options")
            XCTAssertGreaterThanOrEqual(puzzle.shown.count, 5, puzzle.id)
            XCTAssertFalse(puzzle.rule.isEmpty, puzzle.id)
        }
    }

    func testRoundRampsFromEasyToHard() {
        let round = PatternsData.buildRound(from: PatternsData.load())
        XCTAssertEqual(round.count, PatternsData.roundSize)
        XCTAssertEqual(round.map { $0.level }, [1, 1, 1, 2, 2, 2, 2, 3, 3, 3])
        XCTAssertEqual(Set(round.map { $0.id }).count, round.count)
    }
}
