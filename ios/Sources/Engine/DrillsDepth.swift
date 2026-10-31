import Foundation

// Levels 11 to 20 of eight skills, with multiple-choice and true-or-false problems. A port of the later levels in
// web/src/lib/drills/{algebra,geometry,probability,numberTheory,money,fractions,sequences,rates}.ts, drawing random numbers in the
// same order so a seed gives the same problems on both apps.

extension Drills {
    private static func depthItem(_ prompt: String, _ answer: Int, _ hint: String) -> DrillProblem {
        DrillProblem(prompt: prompt, answer: Double(answer), hint: hint)
    }

    /// A multiple-choice or true-or-false problem: `answer` is the index of the right option.
    private static func depthPick(_ prompt: String, _ pick: (choices: [String], answer: Int), _ hint: String) -> DrillProblem {
        DrillProblem(prompt: prompt, answer: Double(pick.answer), hint: hint, choices: pick.choices)
    }

    /// The right option goes in a random place among the wrong ones (one random number is drawn for that).
    private static func choose(_ r: inout SeededRng, correct: String, wrong: [String]) -> (choices: [String], answer: Int) {
        let at = r.int(0, wrong.count)
        var choices = wrong
        choices.insert(correct, at: at)
        return (choices, at)
    }

    private static func trueFalse(_ isTrue: Bool) -> (choices: [String], answer: Int) {
        (["True", "False"], isTrue ? 0 : 1)
    }

    private static func depthPow(_ base: Int, _ exponent: Int) -> Int {
        var result = 1
        for _ in 0..<exponent { result *= base }
        return result
    }

    private static func gcdOf(_ a: Int, _ b: Int) -> Int { b == 0 ? a : gcdOf(b, a % b) }

    private static func isPrimeNumber(_ n: Int) -> Bool {
        if n < 2 { return false }
        var d = 2
        while d * d <= n {
            if n % d == 0 { return false }
            d += 1
        }
        return true
    }

    private static func coefText(_ a: Int) -> String { a == 1 ? "" : String(a) }

    private static let supDigits = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]

    private static func supText(_ n: Int) -> String {
        if n == 1 { return "" }
        return String(n).compactMap { Int(String($0)) }.map { supDigits[$0] }.joined()
    }

    private static let depthTriples: [[Int]] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]

    // MARK: Algebra and calculus, levels 11 to 20

    static func algebraDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let a = r.int(2, 9), q = r.int(2, 8), b = r.int(1, 12)
            return depthItem("x ÷ \(a) + \(b) = \(q + b)", a * q, "Take \(b) away first (\(q)), then multiply by \(a).")
        case 12:
            let x = r.int(2, 12), a = r.int(4, 9), c = r.int(1, a - 1), b = r.int(1, 15)
            return depthItem(
                "\(a)x + \(b) = \(coefText(c))x + \((a - c) * x + b)",
                x,
                "Take \(coefText(c).isEmpty ? "1" : coefText(c))x from both sides, then \(b) from both: \(a - c)x = \((a - c) * x)."
            )
        case 13:
            let a = r.int(2, 9), b = r.int(1, 9), x = r.int(1, 10)
            return depthItem("\(a)(x + \(b)) = \(a * (x + b))", x, "Divide both sides by \(a) first: x + \(b) = \(x + b).")
        case 14:
            let x = r.int(5, 12), y = r.int(1, 4), a = r.int(3, 6), b = r.int(1, 2)
            return depthItem("\(a)x − \(b)y, when x = \(x) and y = \(y)", a * x - b * y, "\(a) × \(x) = \(a * x), then take away \(b) × \(y) = \(b * y).")
        case 15:
            let x = r.int(5, 20), y = r.int(1, x - 1)
            return depthItem("x + y = \(x + y) and x − y = \(x - y). Find x", x, "Add the two equations: 2x = \(2 * x).")
        case 16:
            let a = r.int(2, 9), b = r.int(1, 12), x = r.int(3, 12)
            let pick = choose(&r, correct: String(x), wrong: [String(x + 1), String(x - 1), String(x + 2)])
            return depthPick("Which value of x solves \(a)x + \(b) = \(a * x + b)?", pick, "Take \(b) away, then divide by \(a): x = \(x).")
        case 17:
            let p = r.int(1, 9), q = r.int(1, 9)
            if r.next() < 0.5 { return depthItem("(x + \(p))(x + \(q)) = x² + ?x + \(p * q). What is ?", p + q, "The middle term is \(p) + \(q).") }
            return depthItem("(x + \(p))(x + \(q)) = x² + \(p + q)x + ?. What is ?", p * q, "The last term is \(p) × \(q).")
        case 18:
            let p = r.int(1, 9), q = r.int(1, 9)
            return depthItem("Smaller root of x² − \(p + q)x + \(p * q) = 0", min(p, q), "Two numbers that add to \(p + q) and multiply to \(p * q). Pick the smaller.")
        case 19:
            let a = r.int(1, 4), b = r.int(1, 5), c = r.int(1, 3)
            return depthItem(
                "d/dx of \(coefText(a))x\(supText(3)) + \(coefText(b))x\(supText(2)) at x = \(c)",
                3 * a * c * c + 2 * b * c,
                "The derivative is \(3 * a)x\(supText(2)) + \(2 * b)x. Put \(c) in."
            )
        default:
            let a = 2 * r.int(1, 4), b = r.int(1, 6), c = r.int(1, 4)
            return depthItem(
                "∫ from 0 to \(c) of (\(a)x + \(b)) dx",
                a * c * c / 2 + b * c,
                "The antiderivative is \(a / 2)x\(supText(2)) + \(b)x. Put \(c) in."
            )
        }
    }

    // MARK: Geometry, levels 11 to 20

    static func geometryDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let s = r.int(3, 12)
            return depthItem("A square has area \(s * s). Its perimeter?", 4 * s, "The side is \(s), so the perimeter is 4 × \(s).")
        case 12:
            let d1 = 2 * r.int(2, 8), d2 = r.int(3, 10)
            return depthItem("A rhombus with diagonals \(d1) and \(d2). Its area?", d1 * d2 / 2, "Half of the diagonals multiplied: half of \(d1) × \(d2).")
        case 13:
            let d = r.int(2, 14)
            return depthItem("Circumference of a circle with diameter \(d) (π ≈ 3)", 3 * d, "π × diameter: 3 × \(d).")
        case 14:
            let rad = r.int(1, 5), h = r.int(2, 9)
            return depthItem("Volume of a cylinder, radius \(rad), height \(h) (π ≈ 3)", 3 * rad * rad * h, "π × r² × h: 3 × \(rad * rad) × \(h).")
        case 15:
            let t = r.pick(depthTriples)
            let k = r.int(1, 2)
            return depthItem("A \(t[0] * k) by \(t[1] * k) rectangle. Its diagonal?", t[2] * k, "The diagonal is the long side of a right triangle: a \(t[0])-\(t[1])-\(t[2]) triangle\(k > 1 ? ", doubled" : "").")
        case 16:
            let t = r.pick(depthTriples)
            let right = r.next() < 0.5
            let third = right ? t[2] : t[2] + 1
            return depthPick(
                "True or false: a triangle with sides \(t[0]), \(t[1]) and \(third) is a right triangle.",
                trueFalse(right),
                "Check \(t[0])² + \(t[1])² = \(t[0] * t[0] + t[1] * t[1]) against the long side squared: \(third * third)."
            )
        case 17:
            let n = r.pick([3, 4, 5, 6, 8, 9, 10, 12])
            return depthItem("Each angle of a regular \(n)-sided polygon?", (n - 2) * 180 / n, "All angles add up to (\(n) − 2) × 180°. Share that between \(n) angles.")
        case 18:
            let t = r.pick(depthTriples)
            let k = r.int(2, 5)
            return depthItem("A triangle with sides \(t[0]), \(t[1]) and \(t[2]) is enlarged \(k) times. The new perimeter?", (t[0] + t[1] + t[2]) * k, "Every side grows \(k) times, so the perimeter does too: \(t[0] + t[1] + t[2]) × \(k).")
        case 19:
            let s = r.int(2, 9)
            return depthItem("Surface area of a cube with side \(s)", 6 * s * s, "Six square faces of \(s) × \(s).")
        default:
            let t = r.pick(depthTriples)
            let x = r.int(0, 5), y = r.int(0, 5)
            return depthItem("Distance from (\(x), \(y)) to (\(x + t[0]), \(y + t[1]))", t[2], "\(t[0]) across and \(t[1]) up: a \(t[0])-\(t[1])-\(t[2]) right triangle.")
        }
    }

    // MARK: Probability and counting, levels 11 to 20

    /// [red marbles, all marbles, chance both of two draws are red, in percent].
    private static let bags: [[Int]] = [[3, 5, 30], [4, 5, 60], [2, 5, 10], [3, 4, 50], [4, 6, 40], [3, 6, 20]]
    private static let letterWords: [(String, Int)] = [("LEVEL", 30), ("NOON", 6), ("TOOTH", 30), ("BANANA", 60), ("MOON", 12), ("APPLE", 60)]
    private static let chanceSets: [[String]] = [
        ["1 in 2", "1 in 3", "1 in 5"],
        ["3 in 4", "2 in 3", "3 in 5"],
        ["2 in 5", "3 in 10", "1 in 4"],
        ["7 in 10", "3 in 5", "1 in 2"],
        ["4 in 5", "3 in 4", "2 in 3"],
    ]
    private static let oddsPairs: [[Int]] = [[1, 1], [3, 1], [1, 3], [1, 4], [4, 1], [2, 3], [3, 2], [1, 9], [9, 1], [3, 7], [7, 3]]
    private static let chanceMyths: [(String, Bool)] = [
        ("after five heads in a row, tails is now more likely", false),
        ("two fair dice are more likely to total 7 than 12", true),
        ("rolling a 6 twice in a row is less likely than a 6 and then a 1", false),
        ("a fair coin flipped 100 times will always give exactly 50 heads", false),
        ("an event with a 10% chance can still happen twice in a row", true),
        ("a card drawn at random is as likely to be red as black", true),
    ]

    static func probabilityDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let p = r.int(1, 19) * 5
            return depthItem("A \(p)% chance of rain. The chance it stays dry, in percent?", 100 - p, "The two chances add up to 100%: 100 − \(p).")
        case 12:
            let a = r.int(1, 5) * 10, b = r.int(1, 5) * 10
            return depthItem("Two events that cannot both happen: \(a)% and \(b)%. The chance of one or the other?", a + b, "They cannot overlap, so add them: \(a) + \(b).")
        case 13:
            let bag = r.pick(bags)
            let red = bag[0], total = bag[1], pct = bag[2]
            return depthItem(
                "A bag has \(red) red and \(total - red) blue marbles. You draw two without putting any back. The chance both are red, in percent?",
                pct,
                "\(red)/\(total) for the first, then \(red - 1)/\(total - 1) for the second. Multiply them."
            )
        case 14:
            let n = r.pick([2, 4, 6, 8, 10])
            return depthItem("Roll \(n) fair dice. The expected total?", 7 * n / 2, "Each die averages 3.5, so \(n) dice average \(n) × 3.5.")
        case 15:
            let pair = r.pick(letterWords)
            return depthItem("How many different ways can the letters of \(pair.0) be arranged?", pair.1, "Count all orders, then divide by the orders of the repeated letters.")
        case 16:
            let set = r.pick(chanceSets)
            let pick = choose(&r, correct: set[0], wrong: Array(set.dropFirst()))
            return depthPick("Which is the most likely?", pick, "Turn each into a percent to compare them.")
        case 17:
            let n = r.int(4, 7), k = r.int(2, 3)
            var top = 1, bottom = 1
            for i in 0..<k {
                top *= n - i
                bottom *= i + 1
            }
            return depthItem("You flip a coin \(n) times. In how many different orders can exactly \(k) of them be heads?", top / bottom, "Choose which \(k) of the \(n) flips are heads.")
        case 18:
            let odds = r.pick(oddsPairs)
            let a = odds[0], b = odds[1]
            return depthItem("The odds in favour of an event are \(a) to \(b). Its chance, in percent?", 100 * a / (a + b), "\(a) chances for, \(b) against: \(a) out of \(a + b).")
        case 19:
            let myth = r.pick(chanceMyths)
            return depthPick("True or false: \(myth.0).", trueFalse(myth.1), myth.1 ? "That one holds." : "That is a common mix-up: chance has no memory.")
        default:
            let w = 10 * r.int(2, 10), pp = 10 * r.int(2, 8)
            let expected = (w / 10) * (pp / 10)
            let cost = r.int(1, expected - 1)
            return depthItem(
                "Pay $\(cost) to play: win $\(w) with a \(pp)% chance. The expected profit, in dollars?",
                expected - cost,
                "The expected win is \(pp)% of \(w) = \(expected). Take away the $\(cost) it costs."
            )
        }
    }

    // MARK: Number theory, levels 11 to 20

    static func numberTheoryDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let prime = r.next() < 0.5
            var n = r.int(20, 120)
            if prime { while !isPrimeNumber(n) { n += 1 } } else { while isPrimeNumber(n) { n += 1 } }
            return DrillProblem(
                prompt: "Is \(n) prime?",
                answer: prime ? 0 : 1,
                hint: prime ? "Nothing but 1 and \(n) divides it." : "It has a smaller factor besides 1.",
                choices: ["Prime", "Not prime"]
            )
        case 12:
            let p = r.pick([2, 3, 5]), q = r.pick([2, 3, 5, 7]), s = r.pick([2, 3, 5, 7, 11])
            return depthItem("Write \(p * q * s) as a product of primes. What do those primes add up to?", p + q + s, "\(p * q * s) = \(p) × \(q) × \(s), so \(p) + \(q) + \(s).")
        case 13:
            let n = r.int(30, 200)
            var k = 0
            while (k + 1) * (k + 1) <= n { k += 1 }
            return depthItem("How many perfect squares are there from 1 up to \(n)?", k, "1², 2², 3²... The last one that fits is \(k)² = \(k * k).")
        case 14:
            let a = r.int(12, 49), b = r.int(12, 49), m = r.int(5, 9)
            return depthItem("Remainder of \(a) × \(b) ÷ \(m)", (a * b) % m, "Multiply the remainders instead: \(a % m) × \(b % m), then take the remainder again.")
        case 15:
            let x = r.int(3, 15), y = r.int(3, 15)
            return depthItem(
                "Add in binary: \(String(x, radix: 2)) + \(String(y, radix: 2))",
                Int(String(x + y, radix: 2)) ?? 0,
                "In decimal that is \(x) + \(y) = \(x + y). Write \(x + y) in binary."
            )
        case 16:
            let x = r.int(16, 120), y = r.int(16, 120)
            return depthItem(
                "0x\(String(x, radix: 16).uppercased()) + 0x\(String(y, radix: 16).uppercased()), as a decimal number",
                x + y,
                "Change each to decimal: \(x) + \(y)."
            )
        case 17:
            let n = 9 * r.int(12, 110)
            let pick = choose(&r, correct: String(n), wrong: [String(n + 1), String(n + 2), String(n + 4)])
            return depthPick("Which of these is divisible by 9?", pick, "A number is divisible by 9 when its digits add up to a multiple of 9.")
        case 18:
            let g = r.int(2, 9), a = g * r.int(2, 6), b = g * r.int(2, 6), c = g * r.int(2, 6)
            return depthItem("Greatest common divisor of \(a), \(b) and \(c)", gcdOf(gcdOf(a, b), c), "The biggest number that goes into all three.")
        case 19:
            let a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9)
            let lcm2 = (a * b) / gcdOf(a, b)
            return depthItem("Least common multiple of \(a), \(b) and \(c)", (lcm2 * c) / gcdOf(lcm2, c), "The first number all three divide into.")
        default:
            let n = r.int(100, 99999)
            var root = n
            while root >= 10 {
                var sum = 0
                for ch in String(root) { sum += ch.wholeNumberValue ?? 0 }
                root = sum
            }
            return depthItem("Add the digits of \(n), then the digits of that, until one digit is left. Which digit?", root, "The result is also the remainder when dividing by 9 (with 9 for a multiple of 9).")
        }
    }

    // MARK: Everyday money, levels 11 to 20

    static func moneyDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let price = 20 * r.int(2, 15), tax = r.pick([10, 20, 25])
            return depthItem("$\(price) plus \(tax)% tax. The total?", price + price * tax / 100, "\(tax)% of \(price) is \(price * tax / 100). Add it on.")
        case 12:
            let aCheaper = r.next() < 0.5
            let nA = r.pick([4, 6, 8, 10]), nB = r.pick([3, 5, 6, 12])
            let base = r.int(2, 8), diff = r.int(1, 2)
            let uA = aCheaper ? base : base + diff, uB = aCheaper ? base + diff : base
            return DrillProblem(
                prompt: "Pack A: \(nA) for $\(nA * uA). Pack B: \(nB) for $\(nB * uB). Which is cheaper per item?",
                answer: aCheaper ? 0 : 1,
                hint: "A costs $\(uA) each and B costs $\(uB) each.",
                choices: ["Pack A", "Pack B"]
            )
        case 13:
            let cost = 20 * r.int(2, 10), pct = r.pick([10, 20, 25, 50])
            return depthItem("Bought for $\(cost), sold for $\(cost + cost * pct / 100). The profit as a percent of the cost?", pct, "The profit is $\(cost * pct / 100). That is \(cost * pct / 100) out of \(cost).")
        case 14:
            let price = r.int(8, 20), unitCost = r.int(2, price - 3), units = r.int(5, 40)
            return depthItem(
                "A stall costs $\((price - unitCost) * units) to set up. Each item sells for $\(price) and costs $\(unitCost) to make. How many must it sell to break even?",
                units,
                "Each sale earns $\(price - unitCost). Divide the set-up cost by that."
            )
        case 15:
            let months = r.pick([6, 12, 18, 24]), pay = r.int(15, 90)
            return depthItem("A $\(months * pay) purchase is paid in \(months) equal monthly payments. Each payment, in dollars?", pay, "\(months * pay) ÷ \(months).")
        case 16:
            let rate = r.pick([2, 3, 4, 5, 8, 10]), amount = r.int(5, 40)
            return depthItem("$1 buys \(rate) kroner. How many kroner for $\(amount)?", rate * amount, "\(amount) × \(rate).")
        case 17:
            let rate = r.pick([2, 3, 4, 6, 8, 9, 12])
            return depthItem("Money grows \(rate)% a year. By the rule of 72, about how many years to double?", 72 / rate, "Divide 72 by the rate: 72 ÷ \(rate).")
        case 18:
            let price = 20 * r.int(2, 20), pct = r.pick([5, 10, 15, 20])
            return depthItem("Prices rise \(pct)% in a year. Something that costs $\(price) now costs how much next year?", price + price * pct / 100, "\(pct)% of \(price) is \(price * pct / 100). Add it on.")
        case 19:
            let wage = 2 * r.int(5, 15), extra = 2 * r.int(1, 5)
            return depthItem(
                "You earn $\(wage) an hour for 40 hours, then 1.5 times that for \(extra) more hours. The week's pay, in dollars?",
                40 * wage + extra * wage * 3 / 2,
                "The 40 hours pay \(40 * wage). Overtime is $\(wage * 3 / 2) an hour for \(extra) hours."
            )
        default:
            let h = r.int(2, 10), rA = r.int(2, 8), tA = r.int(2, 5), rB = r.int(2, 8), tB = r.int(2, 5)
            let tBx = rA * tA == rB * tB ? tB + 1 : tB
            let iA = rA * tA, iB = rB * tBx
            return DrillProblem(
                prompt: "$\(h * 100) borrowed. Loan A: \(rA)% simple interest for \(tA) years. Loan B: \(rB)% for \(tBx) years. Which costs less?",
                answer: iA < iB ? 0 : 1,
                hint: "Simple interest is the rate times the years: A is \(iA)% of the loan, B is \(iB)%.",
                choices: ["Loan A", "Loan B"]
            )
        }
    }

    // MARK: Fractions and ratios, levels 11 to 20

    private static let depthDenominators: [[Int]] = [[2, 3, 6], [3, 4, 12], [2, 5, 10], [3, 5, 15], [4, 6, 12], [2, 6, 6], [3, 6, 6], [4, 5, 20]]
    private static let comparePairs: [[Int]] = [
        [3, 4, 5, 7], [2, 3, 5, 8], [5, 6, 7, 9], [4, 5, 7, 9], [3, 5, 4, 7], [2, 5, 3, 8], [7, 8, 6, 7], [5, 8, 3, 5], [4, 7, 5, 9], [2, 7, 3, 10],
    ]

    static func fractionsDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let w = r.int(1, 5), d = r.int(2, 9), n = r.int(1, d - 1)
            return depthItem("\(w) \(n)/\(d) = ?/\(d)", w * d + n, "\(w) wholes is \(w * d)/\(d). Add \(n)/\(d).")
        case 12:
            let dd = r.pick(depthDenominators)
            let d1 = dd[0], d2 = dd[1], lcm = dd[2]
            let n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1)
            let a = n1 * lcm / d1, b = n2 * lcm / d2
            let first = a >= b ? "\(n1)/\(d1)" : "\(n2)/\(d2)"
            let second = a >= b ? "\(n2)/\(d2)" : "\(n1)/\(d1)"
            return depthItem("\(first) − \(second) = ?/\(lcm)", abs(a - b), "Rewrite both over \(lcm): \(max(a, b))/\(lcm) and \(min(a, b))/\(lcm). Subtract the tops.")
        case 13:
            let pair = r.pick(comparePairs)
            let a = pair[0], b = pair[1], c = pair[2], d = pair[3]
            let flip = r.next() < 0.5
            let x = "\(a)/\(b)", y = "\(c)/\(d)"
            let firstLarger = a * d > c * b
            return DrillProblem(
                prompt: "Which fraction is larger?",
                answer: (flip ? !firstLarger : firstLarger) ? 0 : 1,
                hint: "Cross-multiply: \(a) × \(d) = \(a * d) and \(c) × \(b) = \(c * b).",
                choices: flip ? [y, x] : [x, y]
            )
        case 14:
            let d = r.pick([2, 4, 5, 10, 20, 25]), n = r.int(1, d - 1)
            return depthItem("\(n)/\(d) as a percent?", 100 * n / d, "Make the bottom 100: multiply top and bottom by \(100 / d).")
        case 15:
            let a = r.int(1, 5), b = r.int(1, 5), c = r.int(1, 5), k = r.int(2, 12)
            return depthItem("Share $\((a + b + c) * k) in the ratio \(a):\(b):\(c). The smallest share, in dollars?", min(a, b, c) * k, "\(a + b + c) parts in all, so one part is $\(k).")
        case 16:
            let b = r.int(2, 9), a = r.int(1, b - 1), k = r.int(2, 6)
            return depthItem("\(a)/\(b) = \(a * k)/?", b * k, "The top was multiplied by \(k), so multiply the bottom by \(k) too.")
        case 17:
            let d = r.int(2, 6), n = r.int(1, d - 1), m = r.int(2, 5)
            return depthItem("A tap fills \(n)/\(d) of a tank in \(n * m) minutes. How long for a full tank?", d * m, "That is \(m) minutes for each 1/\(d), and a full tank is \(d) of those.")
        case 18:
            let b = r.pick([2, 3, 4]), a = r.int(1, 5), c = b * r.int(1, 3)
            return depthItem("How many 1/\(c)s fit in \(a)/\(b)?", a * c / b, "Dividing by 1/\(c) means multiplying by \(c): \(a)/\(b) × \(c).")
        case 19:
            let a = 10 * r.int(2, 9), b = 10 * r.int(2, 9), k = r.int(1, 10)
            return depthItem("\(a)% of \(b)% of \(100 * k)", k * a * b / 100, "\(b)% of \(100 * k) is \(b * k). Then \(a)% of that.")
        default:
            let left = r.int(5, 40)
            return depthItem(
                "You spend 1/3 of your money, then half of what is left. You have $\(left) remaining. How much did you start with?",
                3 * left,
                "After the first spend 2/3 is left; half of that is 1/3 of the start. So the start is 3 × \(left)."
            )
        }
    }

    // MARK: Sequences and patterns, levels 11 to 20

    private static let sequenceStatements: [(String, Bool)] = [
        ("2, 4, 8, 16 adds the same amount each time", false),
        ("5, 8, 11, 14 adds the same amount each time", true),
        ("3, 6, 12, 24 multiplies by the same number each time", true),
        ("1, 4, 9, 16 goes up by the same amount each time", false),
        ("10, 7, 4, 1 is an arithmetic sequence", true),
        ("1, 1, 2, 3, 5 adds 1 each time", false),
    ]

    static func sequencesDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let n = r.int(5, 20)
            return depthItem("Triangular numbers go 1, 3, 6, 10, ... What is number \(n)?", n * (n + 1) / 2, "It is 1 + 2 + ... + \(n): \(n) × \(n + 1) ÷ 2.")
        case 12:
            let a = r.int(1, 4), q = r.pick([2, 3]), n = r.int(5, 8)
            return depthItem("\(a), \(a * q), \(a * q * q), ... What is term number \(n)?", a * depthPow(q, n - 1), "Start with \(a) and multiply by \(q), \(n - 1) times.")
        case 13:
            let a = r.int(2, 20), d = r.int(2, 9)
            let pick = choose(&r, correct: String(a + 4 * d), wrong: [String(a + 4 * d + 1), String(a + 4 * d - 1), String(a + 5 * d)])
            return depthPick("\(a), \(a + d), \(a + 2 * d), \(a + 3 * d), ... What comes next?", pick, "It goes up by \(d) each time.")
        case 14:
            let a = r.int(1, 3), b = r.int(0, 4), c = r.int(0, 5)
            func t(_ n: Int) -> Int { a * n * n + b * n + c }
            return depthItem(
                "\(t(1)), \(t(2)), \(t(3)), \(t(4)), ?",
                t(5),
                "The steps are \(t(2) - t(1)), \(t(3) - t(2)), \(t(4) - t(3)): they grow by \(2 * a) each time."
            )
        case 15:
            let n = r.int(3, 10)
            return depthItem("1² + 2² + 3² + ... + \(n)²", n * (n + 1) * (2 * n + 1) / 6, "The formula is n(n + 1)(2n + 1) ÷ 6 with n = \(n).")
        case 16:
            let s = r.int(1, 5)
            return depthItem("\(s), \(2 * s), \(2 * s + 1), \(4 * s + 2), \(4 * s + 3), \(8 * s + 6), ?", 8 * s + 7, "Two rules take turns: double, then add 1.")
        case 17:
            let x1 = r.int(1, 6), x2 = r.int(1, 6)
            let t3 = x1 + x2, t4 = x2 + t3
            return depthItem("?, \(x2), \(t3), \(t4): each term is the sum of the two before. The first term?", x1, "\(t3) is the first plus \(x2), so the first is \(t3) − \(x2).")
        case 18:
            let a = r.int(2, 12), d = r.int(2, 9), n = r.int(10, 30)
            return depthItem("\(a), \(a + d), \(a + 2 * d), ... Which term is \(a + (n - 1) * d)?", n, "Take away the start, divide by \(d), then add 1.")
        case 19:
            let n = r.int(3, 9)
            return depthItem("1 + 2 + 4 + ... + \(depthPow(2, n))", depthPow(2, n + 1) - 1, "Adding powers of 2 up to \(depthPow(2, n)) always gives one less than the next power of 2.")
        default:
            let st = r.pick(sequenceStatements)
            return depthPick("True or false: \(st.0).", trueFalse(st.1), st.1 ? "That one holds." : "Check the steps between the terms.")
        }
    }

    // MARK: Rates and word problems, levels 11 to 20

    private static let juiceMixes: [[Int]] = [[20, 50, 20, 25], [30, 40, 30, 20], [10, 60, 5, 40], [24, 50, 24, 25], [60, 30, 30, 20], [15, 40, 10, 24], [20, 30, 10, 20]]

    static func ratesDepth(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch level {
        case 11:
            let v = r.pick([5, 10, 15, 20, 25])
            return depthItem("\(v) m/s is how many km/h? (multiply by 3.6)", v * 18 / 5, "\(v) × 3.6.")
        case 12:
            let rate = 2 * r.int(3, 6), km = 50 * r.int(2, 10)
            return depthItem("A car uses \(rate) litres per 100 km. How many litres for \(km) km?", rate * km / 100, "\(km) km is \(km / 100) lots of 100 km.")
        case 13:
            let w = r.int(2, 5), k = r.int(2, 3), d = k * r.int(2, 6)
            return depthItem("\(w) workers build a wall in \(d) days. How many days would \(w * k) workers take?", d / k, "\(k) times the workers, so \(k) times faster: \(d) ÷ \(k).")
        case 14:
            let mix = r.pick(juiceMixes)
            let y = mix[0], c = mix[1], w = mix[2], result = mix[3]
            return depthItem("\(y) litres of \(c)% juice and \(w) litres of water are mixed. The percent juice in the mix?", result, "There is \(y * c / 100) litres of juice in \(y + w) litres.")
        case 15:
            let vB = 10 * r.int(3, 8), diff = 10 * r.int(1, 3)
            let gap = diff * r.int(1, 5)
            return depthItem("A car at \(vB + diff) km/h chases one at \(vB) km/h that is \(gap) km ahead. Hours to catch up?", gap / diff, "It gains \(diff) km every hour. \(gap) ÷ \(diff).")
        case 16:
            let aFaster = r.next() < 0.5
            let tA = r.pick([2, 3, 4]), tB = r.pick([2, 3, 5])
            let base = 5 * r.int(6, 14), extra = 5 * r.int(1, 2)
            let sA = aFaster ? base + extra : base, sB = aFaster ? base : base + extra
            return DrillProblem(
                prompt: "Cyclist A rode \(sA * tA) km in \(tA) hours. Cyclist B rode \(sB * tB) km in \(tB) hours. Who is faster?",
                answer: aFaster ? 0 : 1,
                hint: "A rode \(sA) km/h and B rode \(sB) km/h.",
                choices: ["Cyclist A", "Cyclist B"]
            )
        case 17:
            let start = r.int(2, 10), d = r.int(2, 5), k = r.int(2, 4)
            return depthItem("A culture of \(start) bacteria triples every \(d) hours. How many after \(k * d) hours?", start * depthPow(3, k), "\(k * d) hours is \(k) triplings: \(start) × 3, \(k) times over.")
        case 18:
            let x = r.int(8, 15), c = r.int(1, 4), k = r.int(2, 5)
            return depthItem("A boat goes \(x) km/h in still water and the river flows at \(c) km/h. Hours to go \(k * (x + c)) km downstream?", k, "Downstream the speeds add: \(x + c) km/h. \(k * (x + c)) ÷ \(x + c).")
        case 19:
            let ben = r.int(5, 20), diff = r.int(2, 10), k = r.int(2, 8)
            return depthItem("Anna is \(diff) years older than Ben. In \(k) years their ages add up to \(2 * ben + diff + 2 * k). Ben's age now?", ben, "Take off the \(2 * k) years that pass for both, then the \(diff), and halve.")
        default:
            let out = r.int(5, 12)
            let inn = r.int(1, out - 2)
            let k = r.int(3, 10)
            return depthItem("A tank holds \(k * (out - inn)) litres. It drains \(out) litres a minute while a pump adds \(inn) a minute. Minutes to empty?", k, "It loses \(out - inn) litres a minute overall.")
        }
    }
}
