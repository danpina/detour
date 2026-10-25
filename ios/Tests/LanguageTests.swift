import XCTest
@testable import Detour

final class LanguageTests: XCTestCase {
    /// The round checks use Spanish; the data checks run for every language.
    private var words: [LanguageWord] { LanguageData.load(LanguageInfo.all[0]) }

    func testBundledWordsLoadAndExamplesContainTheirWord() {
        let words = self.words
        XCTAssertGreaterThan(words.count, 50)
        XCTAssertEqual(Set(words.map { $0.key }).count, words.count)
        for word in words { XCTAssertNotNil(LanguageBuilder.blanked(word), word.key) }
    }

    func testEveryLanguageLoadsWithUniqueKeysAndUsableExamples() {
        for language in LanguageInfo.all {
            let list = LanguageData.load(language)
            XCTAssertGreaterThan(list.count, 80, language.name)
            XCTAssertEqual(Set(list.map { $0.key }).count, list.count, language.name)
            for word in list { XCTAssertNotNil(LanguageBuilder.blanked(word), language.name + ": " + word.key) }
            for level in 1...3 { XCTAssertGreaterThanOrEqual(list.filter { $0.level == level }.count, 12, language.name) }
            var rng = SystemRandomNumberGenerator()
            let round = LanguageBuilder.round(all: list, progress: LanguageProgress(), length: 8, using: &rng)
            XCTAssertEqual(round.count, 8, language.name)
            for q in round { XCTAssertTrue(q.options.contains(q.answer), language.name) }
        }
    }

    func testFirstRoundIsLevelOneRecognition() {
        var rng = SystemRandomNumberGenerator()
        let round = LanguageBuilder.round(all: words, progress: LanguageProgress(), length: 5, using: &rng)
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
        var progress = LanguageProgress()
        progress.missed = ["queso"]
        let first = LanguageBuilder.round(all: words, progress: progress, length: 2, using: &rng)
        XCTAssertTrue(first.map { $0.key }.contains("queso"))

        progress = LanguageProgress(known: ["gato": 2], missed: ["gato"])
        let cloze = LanguageBuilder.round(all: words, progress: progress, length: 1, using: &rng)[0]
        XCTAssertEqual(cloze.kind, .cloze)
        XCTAssertTrue(cloze.prompt.contains("____"))
    }

    func testLevelsOpenAsWordsAreLearned() {
        let words = self.words
        XCTAssertEqual(LanguageBuilder.unlockedLevel(progress: LanguageProgress(), words: words), 1)
        let known = Dictionary(uniqueKeysWithValues: words.prefix(12).map { ($0.key, 2) })
        XCTAssertEqual(LanguageBuilder.unlockedLevel(progress: LanguageProgress(known: known, missed: []), words: words), 2)
    }

    func testAnswersUpdateProgress() {
        var p = LanguageBuilder.apply(LanguageProgress(), key: "gato", right: true)
        XCTAssertEqual(p.known["gato"], 1)
        p = LanguageBuilder.apply(p, key: "gato", right: false)
        XCTAssertEqual(p.known["gato"], 0)
        XCTAssertEqual(p.missed, ["gato"])
        p = LanguageBuilder.apply(p, key: "gato", right: true)
        XCTAssertEqual(p.missed, [])
    }
}
