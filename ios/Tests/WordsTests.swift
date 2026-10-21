import XCTest
@testable import Detour

final class WordsTests: XCTestCase {
    private func sortedLetters(_ text: String) -> [Character] {
        return Array(text).sorted()
    }

    func testWordsDataLoads() {
        let puzzles = WordsLogic.loadPuzzles()
        XCTAssertGreaterThanOrEqual(puzzles.count, 150, "words.json should be bundled and decode")
        for level in [1, 2, 3] {
            XCTAssertGreaterThanOrEqual(puzzles.filter { $0.level == level }.count, 30, "level \(level) needs enough words")
        }
    }

    func testScrambleLettersMatchAnswer() {
        for puzzle in WordsLogic.loadPuzzles() {
            XCTAssertEqual(sortedLetters(puzzle.scramble), sortedLetters(puzzle.answer), puzzle.id)
            XCTAssertFalse(puzzle.accept.contains(puzzle.scramble), "\(puzzle.id) scramble must differ from the answer")
            XCTAssertFalse(puzzle.clue.isEmpty, puzzle.id)
        }
    }

    func testAcceptContainsAnswerAndIsSymmetric() {
        let puzzles = WordsLogic.loadPuzzles()
        var byAnswer: [String: WordPuzzle] = [:]
        for puzzle in puzzles { byAnswer[puzzle.answer] = puzzle }
        for puzzle in puzzles {
            XCTAssertTrue(puzzle.accept.contains(puzzle.answer), puzzle.id)
            for word in puzzle.accept {
                guard let other = byAnswer[word] else {
                    XCTFail("\(puzzle.id) accepts \(word), which is not a puzzle")
                    continue
                }
                XCTAssertTrue(other.accept.contains(puzzle.answer), "\(word) should accept \(puzzle.answer)")
            }
        }
    }

    func testRoundRampsAndHasNoRepeats() {
        let puzzles = WordsLogic.loadPuzzles()
        var rng = SystemRandomNumberGenerator()
        let round = WordsLogic.buildRound(puzzles, using: &rng)
        XCTAssertEqual(round.map { $0.level }, WordsLogic.roundLevels)
        XCTAssertEqual(Set(round.map { $0.id }).count, round.count)
    }

    func testTilePlacement() {
        var placed: [Int] = []
        placed = WordsLogic.placeTile(placed, tile: 2, slots: 3)
        placed = WordsLogic.placeTile(placed, tile: 2, slots: 3)
        placed = WordsLogic.placeTile(placed, tile: 0, slots: 3)
        placed = WordsLogic.placeTile(placed, tile: 1, slots: 3)
        placed = WordsLogic.placeTile(placed, tile: 3, slots: 3)
        XCTAssertEqual(placed, [2, 0, 1])
        XCTAssertEqual(WordsLogic.letters(of: "ABC", placed: placed), "CAB")
        XCTAssertEqual(WordsLogic.removeSlot(placed, slot: 0), [0, 1])
    }

    func testAnswersAndPoints() {
        let puzzles = WordsLogic.loadPuzzles()
        if let listen = puzzles.first(where: { $0.answer == "LISTEN" }) {
            XCTAssertTrue(WordsLogic.isCorrect(listen, guess: "silent"))
            XCTAssertFalse(WordsLogic.isCorrect(listen, guess: "LISTENS"))
        } else {
            XCTFail("LISTEN should be in the list")
        }
        XCTAssertEqual(WordsLogic.wordPoints(solved: true, usedHint: false), 1)
        XCTAssertEqual(WordsLogic.wordPoints(solved: true, usedHint: true), 0)
        XCTAssertEqual(WordsLogic.wordPoints(solved: false, usedHint: false), 0)
    }
}
