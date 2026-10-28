import Foundation

// "What you've learned": the finished cards, to search and read again. A port of web/src/lib/learned.ts.

struct LearnedRow: Identifiable {
    let card: Card
    let learnedAt: Date
    let state: ProgressStats.CardState
    var id: String { card.id }
}

enum Learned {
    /// The text of a card, as paragraphs, for reading it again.
    static func paragraphs(_ card: Card) -> [String] {
        switch card.body {
        case .story(let panels):
            return panels
        case .factWhy(let claim, let why):
            return [claim, why]
        case .guessFirst(let question, let options, let answer, let reveal):
            return [question, "Answer: " + (options.indices.contains(answer) ? options[answer] : ""), reveal]
        case .estimate(let question, let unit, _, _, _, let answer, let reveal):
            let number = answer.formatted(.number.grouping(.automatic).precision(.fractionLength(0...4)))
            return [question, "Answer: " + number + (unit.isEmpty ? "" : " " + unit), reveal]
        }
    }

    /// Cards matching the search words (every word must appear in the title or text) and the topic, in the same order.
    static func filter(_ rows: [LearnedRow], query: String, topic: Interest?) -> [LearnedRow] {
        let words = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map { String($0) }
        return rows.filter { row in
            if let topic, row.card.interest != topic { return false }
            if words.isEmpty { return true }
            let haystack = (row.card.title + " " + paragraphs(row.card).joined(separator: " ")).lowercased()
            return words.allSatisfy { haystack.contains($0) }
        }
    }

    /// "today", "yesterday", "3 days ago", "2 weeks ago", "3 months ago".
    static func ago(_ at: Date, now: Date) -> String {
        let days = max(0, Int(now.timeIntervalSince(at) / 86_400))
        if days == 0 { return "today" }
        if days == 1 { return "yesterday" }
        if days < 14 { return "\(days) days ago" }
        if days < 60 { return "\(days / 7) weeks ago" }
        return "\(days / 30) months ago"
    }

    static func stateLabel(_ state: ProgressStats.CardState) -> String {
        switch state {
        case .new: return "Not yet"
        case .seen: return "Seen"
        case .learning: return "Sticking"
        case .solid: return "Locked in"
        }
    }
}
