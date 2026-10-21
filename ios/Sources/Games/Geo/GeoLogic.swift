import Foundation

/// One country in content/games/geo.json.
struct GeoCountry: Codable, Equatable {
    let name: String
    let capital: String
    let flag: String
    let continent: String
    let level: Int
    let note: String?
}

private struct GeoFile: Codable {
    let countries: [GeoCountry]
}

enum GeoKind {
    case flag
    case capital
    case country
}

struct GeoQuestion {
    let kind: GeoKind
    /// The big thing on screen: a flag emoji, a country name or a capital name.
    let prompt: String
    /// The line above the prompt.
    let title: String
    let options: [String]
    /// The correct option text (always one of `options`).
    let answer: String
    /// One line shown after answering.
    let fact: String
    let level: Int
}

enum GeoData {
    static let continents: [String] = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]

    /// Decodes the geo.json bytes. Rows with an unknown continent or level are skipped.
    static func parse(_ data: Data) -> [GeoCountry] {
        guard let file = try? JSONDecoder().decode(GeoFile.self, from: data) else { return [] }
        return file.countries.filter { country in
            continents.contains(country.continent) && country.level >= 1 && country.level <= 3
        }
    }

    /// Loads the bundled list. Returns an empty list (never crashes) when the file is missing.
    static func load() -> [GeoCountry] {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "geo", withExtension: "json", subdirectory: "games") {
                if let data = try? Data(contentsOf: url) {
                    let countries = parse(data)
                    if !countries.isEmpty { return countries }
                }
            }
        }
        return []
    }
}

enum GeoBuilder {
    static let roundLength = 10

    /// The first 4 questions are easy, then 3 medium, then 3 harder (scaled for other lengths).
    static func level(forIndex index: Int, length: Int) -> Int {
        let fraction = Double(index) / Double(max(length, 1))
        if fraction < 0.4 { return 1 }
        if fraction < 0.7 { return 2 }
        return 3
    }

    private static func optionText(_ kind: GeoKind, _ country: GeoCountry) -> String {
        if kind == .capital { return country.capital }
        return country.name
    }

    /// Wrong options: same continent when possible, never the answer, never a duplicate.
    static func distractors<G: RandomNumberGenerator>(all: [GeoCountry], answer: GeoCountry, kind: GeoKind, count: Int, using rng: inout G) -> [GeoCountry] {
        let answerText = optionText(kind, answer)
        let usable = all.filter { $0.name != answer.name && optionText(kind, $0) != answerText }
        let same = usable.filter { $0.continent == answer.continent }.shuffled(using: &rng)
        let other = usable.filter { $0.continent != answer.continent }.shuffled(using: &rng)
        var result: [GeoCountry] = []
        var seen: Set<String> = [answerText]
        for candidate in same + other {
            let text = optionText(kind, candidate)
            if seen.contains(text) { continue }
            seen.insert(text)
            result.append(candidate)
            if result.count == count { break }
        }
        return result
    }

    private static func fact(for country: GeoCountry) -> String {
        if let note = country.note, !note.isEmpty { return note }
        return "\(country.capital) is the capital of \(country.name)."
    }

    static func question<G: RandomNumberGenerator>(all: [GeoCountry], answer: GeoCountry, kind: GeoKind, using rng: inout G) -> GeoQuestion {
        let wrong = distractors(all: all, answer: answer, kind: kind, count: 3, using: &rng)
        let correct = optionText(kind, answer)
        let options = ([correct] + wrong.map { optionText(kind, $0) }).shuffled(using: &rng)
        switch kind {
        case .flag:
            return GeoQuestion(kind: kind, prompt: answer.flag, title: "Which country is this?", options: options, answer: correct,
                               fact: "\(answer.flag) \(answer.name). \(fact(for: answer))", level: answer.level)
        case .capital:
            return GeoQuestion(kind: kind, prompt: answer.name, title: "What is the capital of", options: options, answer: correct,
                               fact: fact(for: answer), level: answer.level)
        case .country:
            return GeoQuestion(kind: kind, prompt: answer.capital, title: "Which country has the capital", options: options, answer: correct,
                               fact: fact(for: answer), level: answer.level)
        }
    }

    /// A round: easy first, a mix of the three kinds, no country twice.
    static func round<G: RandomNumberGenerator>(all: [GeoCountry], length: Int, using rng: inout G) -> [GeoQuestion] {
        let kinds: [GeoKind] = [.flag, .capital, .country]
        var used: Set<String> = []
        var order = kinds.shuffled(using: &rng)
        var questions: [GeoQuestion] = []
        for i in 0..<length {
            let wanted = level(forIndex: i, length: length)
            var pool = all.filter { $0.level == wanted && !used.contains($0.name) }
            if pool.isEmpty { pool = all.filter { !used.contains($0.name) } }
            guard let answer = pool.randomElement(using: &rng) else { break }
            used.insert(answer.name)
            if i > 0 && i % kinds.count == 0 {
                order = kinds.shuffled(using: &rng)
            }
            let kind = order[i % kinds.count]
            questions.append(question(all: all, answer: answer, kind: kind, using: &rng))
        }
        return questions
    }
}
