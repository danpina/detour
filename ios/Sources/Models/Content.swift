import Foundation

// Card data model. Mirrors /content/schema (the zod schemas) and decodes the JSON in content/published.

enum Interest: String, Codable, CaseIterable, Hashable {
    case history, science, money, tech, mind, numbers
    /// A skill, not a card topic: choosing it adds a quick estimation round to the sets.
    case estimation

    var displayName: String {
        switch self {
        case .history: return "History"
        case .science: return "Science"
        case .money: return "Money & Markets"
        case .tech: return "Tech"
        case .mind: return "Human Mind"
        case .numbers: return "Numbers & Logic"
        case .estimation: return "Estimation"
        }
    }
}

struct SourceLink: Codable, Hashable {
    let title: String
    let url: String
}

struct CardImage: Codable, Hashable {
    let file: String
    let alt: String
    let kind: String
    let credit: String
    let license: String
    let source_url: String?
}

enum ProbeKind: String, Codable, Hashable {
    case mcq, tf, estimate, cloze
}

enum ProbeAnswer: Hashable {
    case index(Int)
    case bool(Bool)
    case number(Double)
    case text(String)
}

struct Probe: Decodable, Hashable, Identifiable {
    let id: String
    let kind: ProbeKind
    let question: String
    let options: [String]?
    let answer: ProbeAnswer
    let unit: String?
    let lo: Double?
    let hi: Double?
    let scale: String?
    let accept: [String]?

    enum CodingKeys: String, CodingKey {
        case id, kind, question, options, answer, unit, scale, accept
        case lo = "min"
        case hi = "max"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = try c.decode(ProbeKind.self, forKey: .kind)
        question = try c.decode(String.self, forKey: .question)
        options = try c.decodeIfPresent([String].self, forKey: .options)
        unit = try c.decodeIfPresent(String.self, forKey: .unit)
        lo = try c.decodeIfPresent(Double.self, forKey: .lo)
        hi = try c.decodeIfPresent(Double.self, forKey: .hi)
        scale = try c.decodeIfPresent(String.self, forKey: .scale)
        accept = try c.decodeIfPresent([String].self, forKey: .accept)
        switch kind {
        case .mcq: answer = .index(try c.decode(Int.self, forKey: .answer))
        case .tf: answer = .bool(try c.decode(Bool.self, forKey: .answer))
        case .estimate: answer = .number(try c.decode(Double.self, forKey: .answer))
        case .cloze: answer = .text(try c.decode(String.self, forKey: .answer))
        }
    }
}

enum CardBody: Hashable {
    case story(panels: [String])
    case factWhy(claim: String, why: String)
    case guessFirst(question: String, options: [String], answer: Int, reveal: String)
    case estimate(question: String, unit: String, lo: Double, hi: Double, scale: String, answer: Double, reveal: String)
}

struct Card: Decodable, Hashable, Identifiable {
    let id: String
    let interest: Interest
    let type: String
    let title: String
    let body: CardBody
    let image: CardImage?
    let probes: [Probe]
    let sources: [SourceLink]
    let difficulty: Int
    let version: Int

    enum CodingKeys: String, CodingKey {
        case id, interest, type, title, body, image, probes, sources, difficulty, version
    }

    private enum BodyKeys: String, CodingKey {
        case panels, claim, why, question, options, answer, reveal, unit, scale
        case lo = "min"
        case hi = "max"
    }

    private struct Panel: Decodable {
        let text: String
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        interest = try c.decode(Interest.self, forKey: .interest)
        type = try c.decode(String.self, forKey: .type)
        title = try c.decode(String.self, forKey: .title)
        image = try c.decodeIfPresent(CardImage.self, forKey: .image)
        probes = try c.decode([Probe].self, forKey: .probes)
        sources = try c.decode([SourceLink].self, forKey: .sources)
        difficulty = try c.decode(Int.self, forKey: .difficulty)
        version = try c.decode(Int.self, forKey: .version)

        let b = try c.nestedContainer(keyedBy: BodyKeys.self, forKey: .body)
        switch type {
        case "story":
            let panels = try b.decode([Panel].self, forKey: .panels)
            body = .story(panels: panels.map { $0.text })
        case "fact_why":
            body = .factWhy(claim: try b.decode(String.self, forKey: .claim), why: try b.decode(String.self, forKey: .why))
        case "guess_first":
            body = .guessFirst(
                question: try b.decode(String.self, forKey: .question),
                options: try b.decode([String].self, forKey: .options),
                answer: try b.decode(Int.self, forKey: .answer),
                reveal: try b.decode(String.self, forKey: .reveal)
            )
        case "estimate":
            body = .estimate(
                question: try b.decode(String.self, forKey: .question),
                unit: try b.decode(String.self, forKey: .unit),
                lo: try b.decode(Double.self, forKey: .lo),
                hi: try b.decode(Double.self, forKey: .hi),
                scale: try b.decodeIfPresent(String.self, forKey: .scale) ?? "linear",
                answer: try b.decode(Double.self, forKey: .answer),
                reveal: try b.decode(String.self, forKey: .reveal)
            )
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "Unknown card type \(type)")
        }
    }
}

extension Card {
    /// Direct initializer, used by tests and SwiftUI previews (decoding from JSON uses `init(from:)`).
    init(id: String, interest: Interest, type: String, title: String, body: CardBody, image: CardImage? = nil,
         probes: [Probe], sources: [SourceLink] = [SourceLink(title: "Source", url: "https://example.com")], difficulty: Int = 2, version: Int = 1) {
        self.id = id
        self.interest = interest
        self.type = type
        self.title = title
        self.body = body
        self.image = image
        self.probes = probes
        self.sources = sources
        self.difficulty = difficulty
        self.version = version
    }
}

extension Probe {
    /// Direct initializer (tests and previews). Decoding from JSON uses `init(from:)`.
    init(id: String, kind: ProbeKind, question: String, options: [String]? = nil, answer: ProbeAnswer,
         unit: String? = nil, lo: Double? = nil, hi: Double? = nil, scale: String? = nil, accept: [String]? = nil) {
        self.id = id
        self.kind = kind
        self.question = question
        self.options = options
        self.answer = answer
        self.unit = unit
        self.lo = lo
        self.hi = hi
        self.scale = scale
        self.accept = accept
    }

    static func trueFalse(id: String, question: String = "True or false?", answer: Bool = true) -> Probe {
        Probe(id: id, kind: .tf, question: question, answer: .bool(answer))
    }
}