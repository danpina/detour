import Foundation

/// A language you can practise: which word list it uses, and a few words of the language itself.
struct LanguageInfo: Equatable, Identifiable {
    let id: String
    let name: String
    let flag: String
    /// The word list in content/games (without ".json").
    let file: String
    /// Where progress is kept. Spanish keeps its original key so earlier progress carries over.
    let storeKey: String
    let yes: String
    let perfect: String
    let great: String

    static let all: [LanguageInfo] = [
        LanguageInfo(id: "es", name: "Spanish", flag: "🇪🇸", file: "spanish", storeKey: "detour.games.spanish", yes: "¡Sí!", perfect: "¡Perfecto!", great: "¡Muy bien!"),
        LanguageInfo(id: "fr", name: "French", flag: "🇫🇷", file: "french", storeKey: "detour.games.french", yes: "Oui !", perfect: "Parfait !", great: "Très bien !"),
        LanguageInfo(id: "de", name: "German", flag: "🇩🇪", file: "german", storeKey: "detour.games.german", yes: "Ja!", perfect: "Perfekt!", great: "Sehr gut!"),
    ]

    private static let choiceKey = "detour.games.language"

    static func info(for id: String?) -> LanguageInfo { all.first { $0.id == id } ?? all[0] }

    /// The language being practised. Spanish until another is chosen.
    static var current: LanguageInfo {
        get { info(for: UserDefaults.standard.string(forKey: choiceKey)) }
        set { UserDefaults.standard.set(newValue.id, forKey: choiceKey) }
    }
}

/// One word in a language list (content/games/spanish.json, french.json, german.json).
struct LanguageWord: Codable, Equatable {
    let word: String
    let en: String
    let level: Int
    let cat: String
    let ex: String
    let exEn: String
    let key: String
}

private struct LanguageFile: Codable {
    let words: [LanguageWord]
}

enum LanguageKind {
    case toEn
    case toWord
    case cloze
}

struct LanguageQuestion {
    let kind: LanguageKind
    let key: String
    let title: String
    /// The big thing on screen.
    let prompt: String
    /// A small line under the prompt (the sentence in English for a fill-in-the-blank).
    let hint: String?
    let options: [String]
    let answer: String
    /// Shown after answering.
    let fact: String
}

/// How many times each word was answered right, and which ones were missed last time. Stays on the device.
struct LanguageProgress: Codable, Equatable {
    var known: [String: Int] = [:]
    var missed: [String] = []
}

enum LanguageData {
    /// Decodes the bytes of a word list. Rows with an unknown level are skipped.
    static func parse(_ data: Data) -> [LanguageWord] {
        guard let file = try? JSONDecoder().decode(LanguageFile.self, from: data) else { return [] }
        return file.words.filter { $0.level >= 1 && $0.level <= 3 }
    }

    /// Loads the bundled list for a language. Returns an empty list (never crashes) when the file is missing.
    static func load(_ language: LanguageInfo = LanguageInfo.current) -> [LanguageWord] {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: language.file, withExtension: "json", subdirectory: "games"),
               let data = try? Data(contentsOf: url) {
                let words = parse(data)
                if !words.isEmpty { return words }
            }
        }
        return []
    }
}

enum LanguageStore {
    static func load(_ language: LanguageInfo = LanguageInfo.current, defaults: UserDefaults = .standard) -> LanguageProgress {
        guard let data = defaults.data(forKey: language.storeKey), let value = try? JSONDecoder().decode(LanguageProgress.self, from: data) else { return LanguageProgress() }
        return value
    }

    static func save(_ progress: LanguageProgress, language: LanguageInfo = LanguageInfo.current, defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(progress) { defaults.set(data, forKey: language.storeKey) }
    }
}

enum LanguageBuilder {
    /// Words answered right at least this many times count as learned.
    static let learnedAt = 2

    /// The highest level in play: level 2 opens once 12 words are learned, level 3 once 30 are.
    static func unlockedLevel(progress: LanguageProgress, words: [LanguageWord]) -> Int {
        let learned = words.filter { (progress.known[$0.key] ?? 0) >= learnedAt }.count
        if learned >= 30 { return 3 }
        if learned >= 12 { return 2 }
        return 1
    }

    /// Recognise first, then recall, then use it in a sentence.
    static func kind(forTimesRight times: Int) -> LanguageKind {
        if times <= 0 { return .toEn }
        if times == 1 { return .toWord }
        return .cloze
    }

    /// The sentence with the word replaced by a blank, or nil when the word is not in it.
    static func blanked(_ word: LanguageWord) -> String? {
        guard let range = word.ex.range(of: word.key, options: .caseInsensitive) else { return nil }
        return word.ex.replacingCharacters(in: range, with: "____")
    }

    private static func distractors<G: RandomNumberGenerator>(all: [LanguageWord], answer: LanguageWord, text: (LanguageWord) -> String, using rng: inout G) -> [String] {
        let correct = text(answer)
        let usable = all.filter { $0.key != answer.key && text($0) != correct }
        let same = usable.filter { $0.cat == answer.cat }.shuffled(using: &rng)
        let other = usable.filter { $0.cat != answer.cat }.shuffled(using: &rng)
        var result: [String] = []
        var seen: Set<String> = [correct]
        for candidate in same + other {
            let t = text(candidate)
            if seen.contains(t) { continue }
            seen.insert(t)
            result.append(t)
            if result.count == 3 { break }
        }
        return result
    }

    static func question<G: RandomNumberGenerator>(all: [LanguageWord], word: LanguageWord, kind: LanguageKind, using rng: inout G) -> LanguageQuestion {
        let fact = "\(word.word) = \(word.en). \"\(word.ex)\" \(word.exEn)"
        switch kind {
        case .cloze:
            if let sentence = blanked(word) {
                let options = ([word.key] + distractors(all: all, answer: word, text: { $0.key }, using: &rng)).shuffled(using: &rng)
                return LanguageQuestion(kind: .cloze, key: word.key, title: "Fill the gap", prompt: sentence, hint: word.exEn, options: options, answer: word.key, fact: fact)
            }
            return question(all: all, word: word, kind: .toWord, using: &rng)
        case .toWord:
            let options = ([word.word] + distractors(all: all, answer: word, text: { $0.word }, using: &rng)).shuffled(using: &rng)
            return LanguageQuestion(kind: .toWord, key: word.key, title: "How do you say", prompt: word.en, hint: nil, options: options, answer: word.word, fact: fact)
        case .toEn:
            let options = ([word.en] + distractors(all: all, answer: word, text: { $0.en }, using: &rng)).shuffled(using: &rng)
            return LanguageQuestion(kind: .toEn, key: word.key, title: "What does this mean?", prompt: word.word, hint: nil, options: options, answer: word.en, fact: fact)
        }
    }

    /// A round: words missed last time come back first (up to half), then words not yet learned within the level, then a refresher.
    static func round<G: RandomNumberGenerator>(all: [LanguageWord], progress: LanguageProgress, length: Int, using rng: inout G) -> [LanguageQuestion] {
        let level = unlockedLevel(progress: progress, words: all)
        let byKey = Dictionary(all.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        var chosen: [LanguageWord] = []
        var used: Set<String> = []
        func add(_ word: LanguageWord?) {
            guard let word, !used.contains(word.key), chosen.count < length else { return }
            used.insert(word.key)
            chosen.append(word)
        }
        let missedWords = progress.missed.compactMap { byKey[$0] }.shuffled(using: &rng)
        for word in missedWords.prefix((length + 1) / 2) { add(word) }
        for word in all.filter({ $0.level <= level && (progress.known[$0.key] ?? 0) < learnedAt }).shuffled(using: &rng) { add(word) }
        for word in all.filter({ $0.level <= level }).shuffled(using: &rng) { add(word) }
        return chosen.map { question(all: all, word: $0, kind: kind(forTimesRight: progress.known[$0.key] ?? 0), using: &rng) }
    }

    /// A right answer counts up; a wrong one sets the word back and queues it for next time.
    static func apply(_ progress: LanguageProgress, key: String, right: Bool) -> LanguageProgress {
        var next = progress
        next.missed.removeAll { $0 == key }
        if right {
            next.known[key, default: 0] += 1
        } else {
            next.known[key] = max(0, (next.known[key] ?? 0) - 1)
            next.missed.append(key)
        }
        if next.missed.count > 20 { next.missed.removeFirst(next.missed.count - 20) }
        return next
    }
}
