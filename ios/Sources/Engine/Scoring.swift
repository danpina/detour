import Foundation

/// Scoring for estimate cards and estimation drills. Port of web/src/lib/scoring.ts and drills/estimation.ts.
enum Scoring {
    // MARK: Estimate cards (slider)

    /// 0...1 closeness of a guess to the answer. Log scale compares ratios (10x too big or too small scores 0, whatever the
    /// slider's range is), linear compares differences against the slider's range.
    static func closeness(guess: Double, answer: Double, lo: Double, hi: Double, scale: String) -> Double {
        if scale == "log", guess > 0, answer > 0, lo > 0 {
            return clamp01(1 - abs(log10(guess / answer)))
        }
        return clamp01(1 - abs(guess - answer) / (hi - lo))
    }

    static func closenessLabel(_ c: Double) -> String {
        if c >= 0.97 { return "Spot on" }
        if c >= 0.85 { return "Very close" }
        if c >= 0.65 { return "In the ballpark" }
        return "Not quite, but now you know"
    }

    private static func clamp01(_ n: Double) -> Double { min(1, max(0, n)) }

    /// Slider position (0...1) to value and back.
    static func value(at t: Double, lo: Double, hi: Double, scale: String) -> Double {
        scale == "log" ? lo * pow(hi / lo, t) : lo + (hi - lo) * t
    }

    static func position(of v: Double, lo: Double, hi: Double, scale: String) -> Double {
        scale == "log" ? log(v / lo) / log(hi / lo) : (v - lo) / (hi - lo)
    }

    /// Rounds to 2-3 significant figures so slider values stay readable.
    static func tidy(_ v: Double) -> Double {
        if v == 0 { return 0 }
        let digits = abs(v) >= 10 ? 2 : 3
        let p = pow(10, floor(log10(abs(v))) - Double(digits) + 1)
        let r = (v / p).rounded() * p
        return abs(r) >= 1 ? (r * 100).rounded() / 100 : r
    }

    static func format(_ n: Double) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US")
        f.numberStyle = .decimal
        if abs(n) >= 100_000 {
            let units: [(Double, String)] = [(1e9, "B"), (1e6, "M"), (1e3, "K")]
            for (size, suffix) in units where abs(n) >= size {
                f.maximumFractionDigits = 2
                return (f.string(from: NSNumber(value: n / size)) ?? "\(n / size)") + suffix
            }
        }
        f.maximumFractionDigits = n >= 100 ? 0 : 2
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    // MARK: Estimation drills (how many times too big or small)

    /// How many times too big or too small the guess is (always >= 1).
    static func timesOff(_ guess: Double, _ answer: Double) -> Double {
        guard guess > 0, answer > 0 else { return .infinity }
        return pow(10, abs(log10(guess / answer)))
    }

    /// A guess counts as right when it is within a factor of 2.
    static let tolerance = 2.0

    static func isCloseEnough(_ guess: Double, _ answer: Double) -> Bool { timesOff(guess, answer) <= tolerance }

    static func estimationVerdict(_ guess: Double, _ answer: Double) -> String {
        let x = timesOff(guess, answer)
        if x <= 1.1 { return "Spot on" }
        if x <= tolerance { return "Close enough" }
        if x <= 10 { return "Right ballpark, but a bit off" }
        return "Way off. Now you have a feel for it"
    }
}
