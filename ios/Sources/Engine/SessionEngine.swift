import Foundation

// Review scheduling glue and the session engine. Port of web/src/lib/{fsrs,engine,pickSet}.ts.

// MARK: Reviews

struct ReviewRow: Codable, Hashable {
    var probeId: String
    var cardId: String
    var card: FSRSCard
}

enum Reviews {
    /// Answers at or under these times count as "fast". Slower correct answers are "Good".
    static func fastMs(_ kind: ProbeKind) -> Int {
        switch kind {
        case .tf: return 3_000
        case .mcq: return 6_000
        case .cloze: return 10_000
        case .estimate: return 8_000
        }
    }

    /// right + fast = Easy, right + slow = Good, wrong = Again. No self-rating.
    static func rating(kind: ProbeKind, correct: Bool, ms: Int) -> FSRSGrade {
        if !correct { return .again }
        return ms <= fastMs(kind) ? .easy : .good
    }

    /// Start of the next local day, pushed one more day out if that is under 6 hours away.
    static func tomorrowStart(after now: Date, calendar: Calendar = .current) -> Date {
        var d = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        if d.timeIntervalSince(now) < 6 * 3600 { d = calendar.date(byAdding: .day, value: 1, to: d)! }
        return d
    }

    /// First recall check for a probe: due tomorrow ("we'll check tomorrow if they stuck"), state New.
    static func newReview(probeId: String, cardId: String, now: Date, calendar: Calendar = .current) -> ReviewRow {
        let due = Int64((tomorrowStart(after: now, calendar: calendar).timeIntervalSince1970 * 1000).rounded())
        return ReviewRow(probeId: probeId, cardId: cardId, card: FSRSCard(dueMs: due))
    }

    static func apply(_ row: ReviewRow, grade: FSRSGrade, now: Date, fsrs: FSRS = FSRS()) -> ReviewRow {
        var out = row
        out.card = fsrs.next(row.card, nowMs: Int64((now.timeIntervalSince1970 * 1000).rounded()), grade: grade)
        return out
    }

    static func dueDate(_ row: ReviewRow) -> Date { Date(timeIntervalSince1970: Double(row.card.dueMs) / 1000) }
}

// MARK: Session items

enum SessionItem: Hashable {
    case review(card: Card, probe: Probe, review: ReviewRow)
    case new(Card)
    case drill(DrillSpec)
    /// A short game at the end of a set. The caller decides how often (see AppModel.makeSet).
    case game(GameId)
}

struct EngineInput {
    var cards: [Card]
    var reviews: [ReviewRow]
    /// Card ids the user has already completed.
    var completed: Set<String>
    var interests: [Interest]
    /// 0...1 per interest, from completion vs skip history. Higher means shown first.
    var engagement: [Interest: Double] = [:]
    var now: Date
    var setSize: Int = SessionEngine.defaultSetSize
    /// The next skill drill. Without it the drill slot goes to other content.
    var drill: DrillSpec?
    /// A game for the end of this set. Chosen by the caller.
    var game: GameId?
    /// When each card was last shown. Cards shown longest ago (or never) are preferred, so skipping a card does not bring it straight back.
    var lastShown: [String: Date] = [:]
}

enum SessionEngine {
    static let defaultSetSize = 5

    /// Base mix is 2 reviews + 2 new + 1 drill; a big backlog nudges reviews toward about half of the set.
    static func reviewTarget(dueCount: Int, setSize: Int) -> Int {
        let base = Int(FSRS.jsRound(Double(setSize) * 0.4))
        return dueCount > setSize ? min(setSize - 1, base + 1) : base
    }

    struct Due {
        let card: Card
        let probe: Probe
        let review: ReviewRow
    }

    /// Due probes, most overdue first, at most one per card.
    static func dueReviews(cards: [Card], reviews: [ReviewRow], now: Date) -> [Due] {
        let nowMs = Int64((now.timeIntervalSince1970 * 1000).rounded())
        let byId = Dictionary(cards.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var out: [Due] = []
        var seenCards = Set<String>()
        for r in reviews.filter({ $0.card.dueMs <= nowMs }).sorted(by: { $0.card.dueMs < $1.card.dueMs }) {
            guard let card = byId[r.cardId], let probe = card.probes.first(where: { $0.id == r.probeId }), !seenCards.contains(card.id) else { continue }
            seenCards.insert(card.id)
            out.append(Due(card: card, probe: probe, review: r))
        }
        return out
    }

    /// Engagement per interest = completed / (completed + skipped). Interests without history are left out.
    static func engagement(events: [(cardId: String, kind: String)], cards: [Card]) -> [Interest: Double] {
        let interestOf = Dictionary(cards.map { ($0.id, $0.interest) }, uniquingKeysWith: { first, _ in first })
        var tally: [Interest: (done: Int, skip: Int)] = [:]
        for e in events {
            guard let i = interestOf[e.cardId], e.kind == "complete" || e.kind == "skip" else { continue }
            var t = tally[i] ?? (0, 0)
            if e.kind == "complete" { t.done += 1 } else { t.skip += 1 }
            tally[i] = t
        }
        return tally.mapValues { Double($0.done) / Double($0.done + $0.skip) }
    }

    /// Picks `n` cards from the chosen interests only: unseen ones first (round-robin in the given order, varying card
    /// types), then (unless `allowSeen` is false) already-seen ones. Topics the user did not pick are never added.
    static func pickSet(cards: [Card], interests: [Interest], seen: Set<String>, n: Int, allowSeen: Bool = true, exclude: Set<String> = []) -> [Card] {
        guard n > 0 else { return [] }
        let content = cards.filter { !exclude.contains($0.id) }
        var chosen: [Card] = []
        var used = Set<String>()

        func take(_ groups: [[Card]]) {
            var progress = true
            while chosen.count < n && progress {
                progress = false
                for g in groups {
                    if chosen.count >= n { break }
                    let usedTypes = Set(chosen.map { $0.type })
                    let next = g.first(where: { !used.contains($0.id) && !usedTypes.contains($0.type) }) ?? g.first(where: { !used.contains($0.id) })
                    if let next {
                        chosen.append(next)
                        used.insert(next.id)
                        progress = true
                    }
                }
            }
        }

        func byInterest(_ list: [Card], _ ints: [Interest]) -> [[Card]] { ints.map { i in list.filter { $0.interest == i } } }

        let unseen = content.filter { !seen.contains($0.id) }
        take(byInterest(unseen, interests))
        if allowSeen { take(byInterest(content, interests)) }
        return chosen
    }

    /// Cards ordered by how long ago they were last shown (never shown first). Ties keep the original order.
    static func leastRecentlyShown(_ cards: [Card], lastShown: [String: Date]) -> [Card] {
        cards.enumerated()
            .sorted { a, b in
                let da = lastShown[a.element.id] ?? .distantPast
                let db = lastShown[b.element.id] ?? .distantPast
                return da != db ? da < db : a.offset < b.offset
            }
            .map { $0.element }
    }

    private static func interleave(_ a: [SessionItem], _ b: [SessionItem]) -> [SessionItem] {
        var out: [SessionItem] = []
        for i in 0..<max(a.count, b.count) {
            if i < a.count { out.append(a[i]) }
            if i < b.count { out.append(b[i]) }
        }
        return out
    }

    /// Builds one set. Slots: reviews (most overdue first), new cards from the user's interests, one skill drill.
    /// Empty review slots fill with new cards; empty new slots fill with more due reviews, then with seen cards.
    /// Reviews and new cards alternate (a review first), with the drill last.
    static func build(_ input: EngineInput) -> [SessionItem] {
        let setSize = input.setSize
        let due = dueReviews(cards: input.cards, reviews: input.reviews, now: input.now)
        let drillCount = input.drill == nil ? 0 : 1
        let gameCount = input.game == nil ? 0 : 1

        let reviewCount = min(reviewTarget(dueCount: due.count, setSize: setSize), due.count)
        let chosenReviews = Array(due.prefix(reviewCount))
        var used = Set(chosenReviews.map { $0.card.id })

        // Interests the user engages with most come first (stable for ties).
        let ordered = input.interests.enumerated()
            .sorted { a, b in
                let ea = input.engagement[a.element] ?? 0.5
                let eb = input.engagement[b.element] ?? 0.5
                return ea != eb ? ea > eb : a.offset < b.offset
            }
            .map { $0.element }

        let newNeeded = max(0, setSize - chosenReviews.count - drillCount - gameCount)
        let seen = input.completed.union(input.reviews.map { $0.cardId })
        let rotated = leastRecentlyShown(input.cards, lastShown: input.lastShown)
        var news = pickSet(cards: rotated, interests: ordered, seen: seen, n: newNeeded, allowSeen: false, exclude: used)

        var reviewItems: [SessionItem] = chosenReviews.map { .review(card: $0.card, probe: $0.probe, review: $0.review) }
        var newItems: [SessionItem] = news.map { .new($0) }

        // Not enough unseen cards: pull extra due reviews.
        var short = newNeeded - news.count
        for r in due.dropFirst(reviewCount) {
            if short <= 0 { break }
            reviewItems.append(.review(card: r.card, probe: r.probe, review: r.review))
            used.insert(r.card.id)
            short -= 1
        }

        // Still short: repeat seen cards rather than showing a tiny set.
        if short > 0 {
            let taken = used.union(news.map { $0.id })
            news = pickSet(cards: rotated, interests: ordered, seen: [], n: short, allowSeen: true, exclude: taken)
            newItems += news.map { .new($0) }
        }

        var items = interleave(reviewItems, newItems)
        if let drill = input.drill { items.append(.drill(drill)) }
        if let game = input.game { items.append(.game(game)) }
        return items
    }
}
