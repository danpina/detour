import XCTest
@testable import Detour

final class GameStatsTests: XCTestCase {
    func testAnOlderSaveWithoutALengthIsReplaced() {
        XCTAssertTrue(GameStats.beats(score: 1, of: 2, savedBest: 8, savedOf: nil))
    }

    func testRoundsOfDifferentLengthsCompareByShareRight() {
        XCTAssertTrue(GameStats.beats(score: 9, of: 10, savedBest: 4, savedOf: 5))
        XCTAssertFalse(GameStats.beats(score: 3, of: 5, savedBest: 4, savedOf: 5))
        XCTAssertTrue(GameStats.beats(score: 10, of: 10, savedBest: 2, savedOf: 2))
        XCTAssertFalse(GameStats.beats(score: 2, of: 2, savedBest: 10, savedOf: 10))
    }

    func testRunsCompareScoresDirectly() {
        XCTAssertTrue(GameStats.beats(score: 8, of: 0, savedBest: 7, savedOf: 0))
        XCTAssertFalse(GameStats.beats(score: 6, of: 0, savedBest: 7, savedOf: 0))
    }

    func testBestLabelShowsScoreOutOfLength() {
        let defaults = UserDefaults(suiteName: "detour.tests.stats." + UUID().uuidString)!
        XCTAssertNil(GameStats.bestLabel(.logic, defaults: defaults))
        GameStats.recordRound(.logic, score: 4, of: 5, defaults: defaults)
        XCTAssertEqual(GameStats.bestLabel(.logic, defaults: defaults), "4/5")
        GameStats.recordRound(.memory, score: 7, of: 0, defaults: defaults)
        XCTAssertEqual(GameStats.bestLabel(.memory, defaults: defaults), "7 in a row")
    }
}

final class EmbeddedRoundSizeTests: XCTestCase {
    func testAGameInsideARoundPlaysOnePuzzle() {
        XCTAssertEqual(GameStats.size(embedded: true), 1)
        XCTAssertEqual(GameStats.size(embedded: false), GameStats.roundSize)
    }
}
