import Foundation

/// One word in content/games/spanish.json.
struct SpanishWord: Codable, Equatable {
    let es: String
    let en: String
    let level: Int
    let cat: String
    let ex: String
    let exEn: String
    let key: String
}

private struct SpanishFile: Codable {
    let words: [SpanishWord]
}

enum SpanishKind {
    case toEn
    case toEs
    case cloze
}

struct SpanishQuestion {
    let kind: SpanishKind
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
struct SpanishProgress: Codable, Equatable {
    var known: [String: Int] = [:]
    var missed: [String] = []
}

enum SpanishData {
    /// Decodes the spanish.json bytes. Rows with an unknown level are skipped.
    static func parse(_ data: Data) -> [SpanishWord] {
        guard let file = try? JSONDecoder().decode(SpanishFile.self, from: data) else { return [] }
        return file.words.filter { $0.level >= 1 && $0.level <= 3 }
    }

    /// Loads the bundled list. Returns an empty list (never crashes) when the file is missing.
    static func load() -> [SpanishWord] {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "spanish", withExtension: "json", subdirectory: "games"),
               let data = try? Data(contentsOf: url) {
                let words = parse(data)
                if !words.isEmpty { return words }
            }
        }
        return []
    }
}

enum SpanishStore {
    private static let key = "detour.games.spanish"

    static func load(defaults: UserDefaults = .standard) -> SpanishProgress {
        guard let data = defaults.data(forKey: key), let value = try? JSONDecoder().decode(SpanishProgress.self, from: data) else { return SpanishProgress() }
        return value
    }

    static func save(_ progress: SpanishProgress, defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(progress) { defaults.set(data, forKey: key) }
    }
}

enum SpanishBuilder {
    /// Words answered right at least this many times count as learned.
    static let learnedAt = 2

    /// The highest level in play: level 2 opens once 12 words are learned, level 3 once 30 are.
    static func unlockedLevel(progress: SpanishProgress, words: [SpanishWord]) -> Int {
        let learned = words.filter { (progress.known[$0.key] ?? 0) >= learnedAt }.count
        if learned >= 30 { return 3 }
        if learned >= 12 { return 2 }
        return 1
    }

    /// Recognise first, then recall, then use it in a sentence.
    static func kind(forTimesRight times: Int) -> SpanishKind {
        if times <= 0 { return .toEn }
        if times == 1 { return .toEs }
        return .cloze
    }

    /// The sentence with the word replaced by a blank, or nil when the word is not in it.
    static func blanked(_ word: SpanishWord) -> String? {
        guard let range = word.ex.range(of: word.key, options: .caseInsensitive) else { return nil }
        return word.ex.replacingCharacters(in: range, with: "____")
    }

    private static func distractors<G: RandomNumberGenerator>(all: [SpanishWord], answer: SpanishWord, text: (SpanishWord) -> String, using rng: inout G) -> [String] {
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

    static func question<G: RandomNumberGenerator>(all: [SpanishWord], word: SpanishWord, kind: SpanishKind, using rng: inout G) -> SpanishQuestion {
        let fact = "\(word.es) = \(word.en). \"\(word.ex)\" \(word.exEn)"
        switch kind {
        case .cloze:
            if let sentence = blanked(word) {
                let options = ([word.key] + distractors(all: all, answer: word, text: { $0.key }, using: &rng)).shuffled(using: &rng)
                return SpanishQuestion(kind: .cloze, key: word.key, title: "Fill the gap", prompt: sentence, hint: word.exEn, options: options, answer: word.key, fact: fact)
            }
            return question(all: all, word: word, kind: .toEs, using: &rng)
        case .toEs:
            let options = ([word.es] + distractors(all: all, answer: word, text: { $0.es }, using: &rng)).shuffled(using: &rng)
            return SpanishQuestion(kind: .toEs, key: word.key, title: "How do you say", prompt: word.en, hint: nil, options: options, answer: word.es, fact: fact)
        case .toEn:
            let options = ([word.en] + distractors(all: all, answer: word, text: { $0.en }, using: &rng)).shuffled(using: &rng)
            return SpanishQuestion(kind: .toEn, key: word.key, title: "What does this mean?", prompt: word.es, hint: nil, options: options, answer: word.en, fact: fact)
        }
    }

    /// A round: words missed last time come back first (up to half), then words not yet learned within the level, then a refresher.
    static func round<G: RandomNumberGenerator>(all: [SpanishWord], progress: SpanishProgress, length: Int, using rng: inout G) -> [SpanishQuestion] {
        let level = unlockedLevel(progress: progress, words: all)
        let byKey = Dictionary(all.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        var chosen: [SpanishWord] = []
        var used: Set<String> = []
        func add(_ word: SpanishWord?) {
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
    static func apply(_ progress: SpanishProgress, key: String, right: Bool) -> SpanishProgress {
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
