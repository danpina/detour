import XCTest
@testable import Detour

final class SpanishTests: XCTestCase {
    private var words: [SpanishWord] { SpanishData.load() }

    func testBundledWordsLoadAndExamplesContainTheirWord() {
        let words = self.words
        XCTAssertGreaterThan(words.count, 50)
        XCTAssertEqual(Set(words.map { $0.key }).count, words.count)
        for word in words { XCTAssertNotNil(SpanishBuilder.blanked(word), word.key) }
    }

    func testFirstRoundIsLevelOneRecognition() {
        var rng = SystemRandomNumberGenerator()
        let round = SpanishBuilder.round(all: words, progress: SpanishProgress(), length: 5, using: &rng)
        XCTAssertEqual(round.count, 5)
        XCTAssertEqual(Set(round.map { $0.key }).count, 5)
        for q in round {
            XCTAssertEqual(q.kind, .toEn)
            XCTAssertTrue(q.options.contains(q.answer))
            XCTAssertEqual(Set(q.options).count, q.options.count)
        }
    }

    func testMissedWordsComeBackAndKnownOnesBecomeSentences() {
        var rng = SystemRandomNumberGenerator()
        var progress = SpanishProgress()
        progress.missed = ["queso"]
        let first = SpanishBuilder.round(all: words, progress: progress, length: 2, using: &rng)
        XCTAssertTrue(first.map { $0.key }.contains("queso"))

        progress = SpanishProgress(known: ["gato": 2], missed: ["gato"])
        let cloze = SpanishBuilder.round(all: words, progress: progress, length: 1, using: &rng)[0]
        XCTAssertEqual(cloze.kind, .cloze)
        XCTAssertTrue(cloze.prompt.contains("____"))
    }

    func testLevelsOpenAsWordsAreLearned() {
        let words = self.words
        XCTAssertEqual(SpanishBuilder.unlockedLevel(progress: SpanishProgress(), words: words), 1)
        let known = Dictionary(uniqueKeysWithValues: words.prefix(12).map { ($0.key, 2) })
        XCTAssertEqual(SpanishBuilder.unlockedLevel(progress: SpanishProgress(known: known, missed: []), words: words), 2)
    }

    func testAnswersUpdateProgress() {
        var p = SpanishBuilder.apply(SpanishProgress(), key: "gato", right: true)
        XCTAssertEqual(p.known["gato"], 1)
        p = SpanishBuilder.apply(p, key: "gato", right: false)
        XCTAssertEqual(p.known["gato"], 0)
        XCTAssertEqual(p.missed, ["gato"])
        p = SpanishBuilder.apply(p, key: "gato", right: true)
        XCTAssertEqual(p.missed, [])
    }
}
