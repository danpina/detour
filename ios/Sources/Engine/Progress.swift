import Foundation

// Streaks, recall stats, the knowledge map and the weekly recap. Port of web/src/lib/progress.ts.

// MARK: Events

enum EventKind: String, Codable {
    case view, complete, skip, report
}

/// One thing that happened. No personal data: ids, counts, times and fixed reason codes only.
struct AppEvent: Codable, Hashable {
    var cardId: String
    var kind: EventKind
    var msSpent: Int
    var at: Date
    var reason: String? = nil
    var probeId: String? = nil
    var correct: Bool? = nil
}

// MARK: Days and weeks (calendar days as "YYYY-MM-DD")

enum Days {
    /// The calendar day of `date` in the given calendar's time zone.
    static func key(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// Days since 1970-01-01 for a "YYYY-MM-DD" key (proleptic Gregorian, no time zones involved).
    static func number(_ key: String) -> Int {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        var y = parts[0]
        let m = parts[1], d = parts[2]
        if m <= 2 { y -= 1 }
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    static func key(fromNumber z0: Int) -> String {
        let z = z0 + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return String(format: "%04d-%02d-%02d", m <= 2 ? y + 1 : y, m, d)
    }

    static func between(_ a: String, _ b: String) -> Int { number(b) - number(a) }
    static func add(_ day: String, _ n: Int) -> String { key(fromNumber: number(day) + n) }

    /// Monday of the week containing `day`. Streak freezes refill every Monday.
    static func weekKey(_ day: String) -> String {
        let dow = ((number(day) + 3) % 7 + 7) % 7 // 1970-01-01 was a Thursday; 0 = Monday
        return add(day, -dow)
    }
}

// MARK: Streak with freezes

struct StreakState: Codable, Hashable {
    var current = 0
    var best = 0
    var freezesLeft = Streaks.freezesPerWeek
    /// The week (Monday) the freezes count belongs to.
    var freezeWeek = ""
    var lastActiveDay = ""
}

enum Streaks {
    static let freezesPerWeek = 2
    static let maxGapDays = 14

    private static func refill(_ s: inout StreakState, day: String) {
        let wk = Days.weekKey(day)
        if wk != s.freezeWeek {
            s.freezeWeek = wk
            s.freezesLeft = freezesPerWeek
        }
    }

    /// Walks the days missed since the last activity, spending a freeze for each. Breaks the streak when freezes run out.
    private static func settleGap(_ s: inout StreakState, today: String) {
        guard !s.lastActiveDay.isEmpty else { return }
        let missed = Days.between(s.lastActiveDay, today) - 1
        if missed <= 0 { return }
        if missed > maxGapDays {
            s.current = 0
            return
        }
        var k = 1
        while k <= missed && s.current > 0 {
            refill(&s, day: Days.add(s.lastActiveDay, k))
            if s.freezesLeft > 0 { s.freezesLeft -= 1 } else { s.current = 0 }
            k += 1
        }
    }

    /// Call when the user does something on `today`.
    static func recordDay(_ state: StreakState, today: String) -> StreakState {
        if state.lastActiveDay == today { return state }
        var s = state
        settleGap(&s, today: today)
        refill(&s, day: today)
        s.current += 1
        s.best = max(s.best, s.current)
        s.lastActiveDay = today
        return s
    }

    /// The streak to show right now, without recording activity.
    static func display(_ state: StreakState, today: String) -> (current: Int, freezesLeft: Int) {
        if state.lastActiveDay.isEmpty { return (0, freezesPerWeek) }
        var s = state
        settleGap(&s, today: today)
        refill(&s, day: today)
        return (s.current, s.freezesLeft)
    }
}

// MARK: Remembered score, knowledge map, recap

enum ProgressStats {
    static func recall(events: [AppEvent], now: Date, days: Int) -> (total: Int, correct: Int, rate: Double?) {
        let since = now.addingTimeInterval(-Double(days) * 86_400)
        let answers = events.filter { $0.kind == .complete && $0.probeId != nil && $0.correct != nil && $0.at >= since }
        let correct = answers.filter { $0.correct == true }.count
        return (answers.count, correct, answers.isEmpty ? nil : Double(correct) / Double(answers.count))
    }

    /// A probe counts as long-term memory once its stability reaches about three weeks.
    static let longTermDays = 21.0

    enum CardState: String { case new, seen, learning, solid }

    static func cardState(_ card: Card, completed: Set<String>, reviews: [String: ReviewRow]) -> CardState {
        if !completed.contains(card.id) { return .new }
        let rows = card.probes.map { reviews[$0.id] }
        if rows.allSatisfy({ ($0?.card.reps ?? 0) > 0 && ($0?.card.stability ?? 0) >= longTermDays }) { return .solid }
        if rows.contains(where: { ($0?.card.reps ?? 0) > 0 }) { return .learning }
        return .seen
    }

    static func knowledgeMap(cards: [Card], completed: Set<String>, reviews: [ReviewRow]) -> [Interest: [(id: String, state: CardState)]] {
        let byProbe = Dictionary(reviews.map { ($0.probeId, $0) }, uniquingKeysWith: { first, _ in first })
        var out: [Interest: [(id: String, state: CardState)]] = [:]
        for c in cards {
            out[c.interest, default: []].append((c.id, cardState(c, completed: completed, reviews: byProbe)))
        }
        return out
    }

    struct Recap: Equatable {
        var cards: Int
        var recallRate: Double?
        var recallAnswers: Int
        var minutes: Int
        var streak: Int
        var days: Int
    }

    static func weeklyRecap(events: [AppEvent], streak: Int, now: Date, calendar: Calendar = .current) -> Recap {
        let since = now.addingTimeInterval(-7 * 86_400)
        let completes = events.filter { $0.kind == .complete && $0.at >= since }
        let cards = completes.filter { !$0.cardId.hasPrefix("drill:") }.count
        let stats = recall(events: events, now: now, days: 7)
        let days = Set(completes.map { Days.key($0.at, calendar: calendar) }).count
        let minutes = Int((Double(completes.reduce(0) { $0 + $1.msSpent }) / 60_000).rounded())
        return Recap(cards: cards, recallRate: stats.rate, recallAnswers: stats.total, minutes: minutes, streak: streak, days: days)
    }
}
