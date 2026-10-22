import XCTest
@testable import Detour

final class MemoryTests: XCTestCase {
    private func sequencePicker(_ values: [Int]) -> MemoryLogic.Picker {
        var index = 0
        return { count in
            let v = values[index % values.count]
            index += 1
            return v % count
        }
    }

    func testDigitsUseInjectedPicker() {
        let digits = MemoryLogic.generateDigits(length: 4, pick: sequencePicker([0, 1, 5, 9]))
        XCTAssertEqual(digits, [0, 1, 5, 9])
    }

    func testTilesNeverRepeatInARow() {
        let stuck = MemoryLogic.generateTiles(length: 6, tileCount: 9, pick: { _ in 0 })
        XCTAssertEqual(stuck.count, 6)
        var i = 1
        while i < stuck.count {
            XCTAssertNotEqual(stuck[i], stuck[i - 1])
            i += 1
        }
        for _ in 0..<50 {
            let tiles = MemoryLogic.generateTiles(length: 12)
            var j = 1
            while j < tiles.count {
                XCTAssertNotEqual(tiles[j], tiles[j - 1])
                XCTAssertTrue(tiles[j] >= 0 && tiles[j] < 9)
                j += 1
            }
        }
    }

    func testCheckAnswer() {
        XCTAssertTrue(MemoryLogic.checkAnswer(expected: [1, 2, 3], given: [1, 2, 3]))
        XCTAssertFalse(MemoryLogic.checkAnswer(expected: [1, 2, 3], given: [1, 3, 2]))
        XCTAssertFalse(MemoryLogic.checkAnswer(expected: [1, 2, 3], given: [1, 2]))
        XCTAssertTrue(MemoryLogic.isPrefix(expected: [1, 2, 3], given: [1, 2]))
        XCTAssertFalse(MemoryLogic.isPrefix(expected: [1, 2, 3], given: [1, 3]))
    }

    func testGrowsByOnePerSuccess() {
        var run = MemoryLogic.Run()
        XCTAssertEqual(run.length, 3)
        run = MemoryLogic.apply(run, success: true)
        run = MemoryLogic.apply(run, success: true)
        XCTAssertEqual(run.length, 5)
        XCTAssertEqual(run.best, 4)
        XCTAssertFalse(run.over)
    }

    func testEndsAfterTwoMissesInARow() {
        var run = MemoryLogic.Run()
        run = MemoryLogic.apply(run, success: true)
        run = MemoryLogic.apply(run, success: false)
        XCTAssertFalse(run.over)
        XCTAssertEqual(run.length, 4)
        run = MemoryLogic.apply(run, success: true)
        run = MemoryLogic.apply(run, success: false)
        XCTAssertFalse(run.over)
        run = MemoryLogic.apply(run, success: false)
        XCTAssertTrue(run.over)
        XCTAssertEqual(run.best, 4)
    }

    func testShortRoundEndsAfterTarget() {
        var round = MemoryLogic.ShortRound(target: 2)
        round = MemoryLogic.applyShort(round, success: true)
        XCTAssertFalse(round.done)
        XCTAssertEqual(round.run.length, 4)
        round = MemoryLogic.applyShort(round, success: true)
        XCTAssertTrue(round.done)
        XCTAssertEqual(round.played, 2)
        XCTAssertEqual(round.score, 4)
    }

    func testShortRoundMissDoesNotCount() {
        var round = MemoryLogic.ShortRound(target: 2)
        round = MemoryLogic.applyShort(round, success: false)
        XCTAssertFalse(round.done)
        XCTAssertEqual(round.played, 0)
        XCTAssertEqual(round.run.length, 3)
        round = MemoryLogic.applyShort(round, success: true)
        round = MemoryLogic.applyShort(round, success: true)
        XCTAssertTrue(round.done)
        XCTAssertEqual(round.score, 4)
    }

    func testShortRoundEndsEarlyAfterTwoMisses() {
        var round = MemoryLogic.ShortRound(target: 10)
        round = MemoryLogic.applyShort(round, success: true)
        round = MemoryLogic.applyShort(round, success: false)
        XCTAssertFalse(round.done)
        round = MemoryLogic.applyShort(round, success: false)
        XCTAssertTrue(round.done)
        XCTAssertEqual(round.score, 3)
        var none = MemoryLogic.ShortRound(target: 5)
        none = MemoryLogic.applyShort(none, success: false)
        none = MemoryLogic.applyShort(none, success: false)
        XCTAssertEqual(none.score, 0)
    }

    func testScoreIsZeroWhenFirstTwoMissed() {
        var run = MemoryLogic.apply(MemoryLogic.Run(), success: false)
        run = MemoryLogic.apply(run, success: false)
        XCTAssertTrue(run.over)
        XCTAssertEqual(run.best, 0)
    }
}
