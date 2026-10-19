import Foundation

// A Swift port of the FSRS-6 scheduler, matching ts-fsrs 5.4 as configured in the web app:
// no minute-level learning steps (enable_short_term = false), no fuzz, request retention 0.9.
// `content/fsrs-test-vectors.json` is the contract: FSRSTests replays those cases and must match.

enum FSRSState: Int, Codable, Hashable {
    case new = 0, learning = 1, review = 2, relearning = 3
}

enum FSRSGrade: Int, CaseIterable {
    case again = 1, hard = 2, good = 3, easy = 4
}

struct FSRSCard: Equatable, Hashable, Codable {
    /// Milliseconds since the Unix epoch.
    var dueMs: Int64
    var stability: Double = 0
    var difficulty: Double = 0
    var elapsedDays: Int = 0
    var scheduledDays: Int = 0
    var learningSteps: Int = 0
    var reps: Int = 0
    var lapses: Int = 0
    var state: FSRSState = .new
    var lastReviewMs: Int64? = nil
}

struct FSRS {
    static let defaultW: [Double] = [
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 1e-3, 1.8722, 0.1666,
        0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ]
    static let sMin = 1e-3
    static let sMax = 36500.0
    static let dayMs: Int64 = 86_400_000

    let w: [Double]
    let requestRetention: Double
    let maximumInterval: Int
    private let decay: Double
    private let factor: Double
    private let intervalModifier: Double

    init(w: [Double] = FSRS.defaultW, requestRetention: Double = 0.9, maximumInterval: Int = 36500) {
        self.w = w
        self.requestRetention = requestRetention
        self.maximumInterval = maximumInterval
        let decay = -w[20]
        let factor = FSRS.roundTo(exp((1 / decay) * log(0.9)) - 1, 8)
        self.decay = decay
        self.factor = factor
        self.intervalModifier = FSRS.roundTo((pow(requestRetention, 1 / decay) - 1) / factor, 8)
    }

    // MARK: JavaScript-compatible helpers

    /// JavaScript's Math.round: halves round toward +infinity.
    static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    static func roundTo(_ x: Double, _ decimals: Int) -> Double {
        let f = pow(10.0, Double(decimals))
        return jsRound(x * f) / f
    }

    private static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { min(max(v, lo), hi) }

    /// Whole UTC days between two instants (calendar-day difference, like ts-fsrs).
    static func dateDiffInDays(lastMs: Int64, nowMs: Int64) -> Int {
        Int(nowMs / dayMs - lastMs / dayMs)
    }

    // MARK: Memory model

    func forgettingCurve(elapsedDays t: Double, stability s: Double) -> Double {
        FSRS.roundTo(pow(1 + factor * t / s, decay), 8)
    }

    private func initStability(_ g: FSRSGrade) -> Double { max(w[g.rawValue - 1], 0.1) }

    private func initDifficulty(_ g: FSRSGrade) -> Double {
        FSRS.roundTo(w[4] - exp(Double(g.rawValue - 1) * w[5]) + 1, 8)
    }

    private func nextInterval(stability s: Double) -> Int {
        let v = min(max(1, FSRS.jsRound(s * intervalModifier)), Double(maximumInterval))
        return Int(v)
    }

    private func linearDamping(_ deltaD: Double, _ oldD: Double) -> Double {
        FSRS.roundTo(deltaD * (10 - oldD) / 9, 8)
    }

    private func meanReversion(_ initial: Double, _ current: Double) -> Double {
        FSRS.roundTo(w[7] * initial + (1 - w[7]) * current, 8)
    }

    private func nextDifficulty(_ d: Double, _ g: FSRSGrade) -> Double {
        let deltaD = -w[6] * Double(g.rawValue - 3)
        let nextD = d + linearDamping(deltaD, d)
        return FSRS.clamp(meanReversion(initDifficulty(.easy), nextD), 1, 10)
    }

    private func nextRecallStability(d: Double, s: Double, r: Double, g: FSRSGrade) -> Double {
        let hardPenalty = g == .hard ? w[15] : 1
        let easyBound = g == .easy ? w[16] : 1
        let gain = exp(w[8]) * (11 - d) * pow(s, -w[9]) * (exp((1 - r) * w[10]) - 1) * hardPenalty * easyBound
        return FSRS.roundTo(FSRS.clamp(s * (1 + gain), FSRS.sMin, FSRS.sMax), 8)
    }

    private func nextForgetStability(d: Double, s: Double, r: Double) -> Double {
        FSRS.roundTo(
            FSRS.clamp(w[11] * pow(d, -w[12]) * (pow(s + 1, w[13]) - 1) * exp((1 - r) * w[14]), FSRS.sMin, FSRS.sMax),
            8
        )
    }

    private func nextState(d: Double, s: Double, t: Double, g: FSRSGrade, r: Double?) -> (d: Double, s: Double) {
        if d == 0 && s == 0 {
            return (FSRS.clamp(initDifficulty(g), 1, 10), initStability(g))
        }
        let retrievability = r ?? forgettingCurve(elapsedDays: t, stability: s)
        let newS: Double
        if g == .again {
            let afterFail = nextForgetStability(d: d, s: s, r: retrievability)
            // Without short-term steps the floor is the old stability itself.
            newS = FSRS.clamp(FSRS.roundTo(s, 8), FSRS.sMin, afterFail)
        } else {
            newS = nextRecallStability(d: d, s: s, r: retrievability, g: g)
        }
        return (nextDifficulty(d, g), newS)
    }

    // MARK: Scheduling

    /// Reviews `card` at `nowMs` with `grade` and returns the updated card.
    func next(_ card: FSRSCard, nowMs: Int64, grade: FSRSGrade) -> FSRSCard {
        let isNew = card.state == .new
        var current = card
        var interval = 0
        if !isNew, let last = card.lastReviewMs {
            interval = FSRS.dateDiffInDays(lastMs: last, nowMs: nowMs)
        }
        current.lastReviewMs = nowMs
        current.elapsedDays = interval
        current.reps += 1
        if isNew {
            current.scheduledDays = 0
            current.elapsedDays = 0
        }

        let t = isNew ? 0 : interval
        let retrievability: Double? = isNew ? nil : forgettingCurve(elapsedDays: Double(interval), stability: card.stability)

        var results: [FSRSGrade: FSRSCard] = [:]
        for g in FSRSGrade.allCases {
            var c = current
            let ns = nextState(d: card.difficulty, s: card.stability, t: Double(t), g: g, r: retrievability)
            c.difficulty = ns.d
            c.stability = ns.s
            results[g] = c
        }

        // Keep the four intervals strictly increasing: again <= hard < good < easy.
        var again = nextInterval(stability: results[.again]!.stability)
        var hard = nextInterval(stability: results[.hard]!.stability)
        var good = nextInterval(stability: results[.good]!.stability)
        var easy = nextInterval(stability: results[.easy]!.stability)
        again = min(again, hard)
        hard = max(hard, again + 1)
        good = max(good, hard + 1)
        easy = max(easy, good + 1)
        let days: [FSRSGrade: Int] = [.again: again, .hard: hard, .good: good, .easy: easy]

        for g in FSRSGrade.allCases {
            var c = results[g]!
            c.scheduledDays = days[g]!
            c.dueMs = nowMs + Int64(days[g]!) * FSRS.dayMs
            c.state = .review
            c.learningSteps = 0
            if g == .again && !isNew { c.lapses += 1 }
            results[g] = c
        }
        return results[grade]!
    }
}
