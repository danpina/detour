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
            for level in 1...3 { XCTAssertGreaterThanOrEqual(list.filter { $0.level == level }.count, 250, language.name) }
            var rng = SystemRandomNumberGenerator()
            let round = LanguageBuilder.round(everything: list, progress: LanguageProgress(), length: 8, using: &rng)
            XCTAssertEqual(round.count, 8, language.name)
            for q in round { XCTAssertTrue(q.options.contains(q.answer), language.name) }
        }
    }

    func testFirstRoundIsLevelOneRecognition() {
        var rng = SystemRandomNumberGenerator()
        let round = LanguageBuilder.round(everything: words, progress: LanguageProgress(), length: 5, using: &rng)
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
        let first = LanguageBuilder.round(everything: words, progress: progress, length: 2, using: &rng)
        XCTAssertTrue(first.map { $0.key }.contains("queso"))

        progress = LanguageProgress(known: ["gato": 2], missed: ["gato"])
        let cloze = LanguageBuilder.round(everything: words, progress: progress, length: 1, using: &rng)[0]
        XCTAssertEqual(cloze.kind, .cloze)
        XCTAssertTrue(cloze.prompt.contains("____"))
    }

    func testARoundOnlyAsksTheChosenLevel() {
        var rng = SystemRandomNumberGenerator()
        for level in 1...2 {
            let pool = words.filter { $0.level == level }
            let allowed = Set(pool.flatMap { [$0.en, $0.word, $0.key] })
            let round = LanguageBuilder.round(everything: words, level: level, progress: LanguageProgress(), length: 6, using: &rng)
            XCTAssertEqual(round.count, 6)
            for q in round {
                XCTAssertTrue(pool.contains { $0.key == q.key })
                for option in q.options { XCTAssertTrue(allowed.contains(option), option) }
            }
        }
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

    func testWordsGotRightOnceComeBackBeforeNewOnes() {
        var rng = SystemRandomNumberGenerator()
        let level1 = words.filter { $0.level == 1 }
        let once = level1.prefix(3).map { $0.key }
        let progress = LanguageProgress(known: Dictionary(uniqueKeysWithValues: once.map { ($0, 1) }), missed: [])
        for _ in 0..<25 {
            let round = LanguageBuilder.round(everything: words, level: 1, progress: progress, length: 3, using: &rng)
            XCTAssertEqual(Set(round.map { $0.key }), Set(once))
        }
    }
}
