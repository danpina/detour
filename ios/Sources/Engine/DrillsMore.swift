import Foundation

// Geometry, probability, number theory and everyday money. A port of web/src/lib/drills/{geometry,probability,numberTheory,money}.ts:
// the random numbers are drawn in the same order, so a seed gives the same problems on both apps (DrillTests replays the vectors).

enum MoreLevels {
    static let geometry = [
        "Perimeter of a rectangle",
        "Area of a rectangle",
        "Area of a triangle",
        "The third angle of a triangle",
        "Complementary and straight-line angles",
        "L-shaped areas",
        "Circles, with π ≈ 3",
        "Volume of a box",
        "Right triangles: Pythagoras",
        "Trapezoids and polygon angles",
        "Square: area to perimeter",
        "Area of a rhombus",
        "Circumference from the diameter",
        "Volume of a cylinder",
        "The diagonal of a rectangle",
        "True or false: right triangles",
        "Angles of regular polygons",
        "Enlarging a triangle",
        "Surface area of a cube",
        "Distance between two points",
    ]

    static let probability = [
        "Coin flips: how many results?",
        "Outfits: multiplying choices",
        "Expected counts",
        "Chance as a percent",
        "Orders: arranging people",
        "Two dice: ways to make a total",
        "Handshakes: choosing pairs",
        "Codes and passwords",
        "Two chances in a row",
        "Choosing a few from many",
        "The chance of not",
        "Either one or the other",
        "Drawing without putting back",
        "Expected total of dice",
        "Arranging letters with repeats",
        "Which is most likely?",
        "Choosing exactly k heads",
        "Odds to percent",
        "True or false: chance myths",
        "Expected profit",
    ]

    static let numberTheory = [
        "Counting factors",
        "Smallest prime factor",
        "The next prime",
        "Greatest common divisor",
        "Least common multiple",
        "Remainders by 3 and 9: digit sums",
        "Binary to decimal",
        "Decimal to binary",
        "Hexadecimal to decimal",
        "Last digits of powers",
        "Prime or not?",
        "Prime factors added up",
        "Counting perfect squares",
        "Remainders of products",
        "Adding in binary",
        "Adding in hexadecimal",
        "Which is divisible by 9?",
        "Greatest common divisor of three",
        "Least common multiple of three",
        "Digital roots",
    ]

    static let money = [
        "Making change",
        "Totals: items at a price",
        "Unit prices",
        "Splitting the bill",
        "Discounts: 10%, 20%, 25%, 50% off",
        "Tips: 10%, 15%, 20%",
        "Saving up: how many weeks?",
        "Percent up and down",
        "Simple interest",
        "Compound interest, two years",
        "Sales tax",
        "The better deal",
        "Profit as a percent",
        "Break-even",
        "Monthly payments",
        "Exchanging currency",
        "The rule of 72",
        "Inflation",
        "Overtime pay",
        "Which loan costs less?",
    ]
}

extension Drills {
    private static func problem(_ prompt: String, _ answer: Int, _ hint: String) -> DrillProblem {
        DrillProblem(prompt: prompt, answer: Double(answer), hint: hint)
    }

    private static func gcd(_ a: Int, _ b: Int) -> Int { b == 0 ? a : gcd(b, a % b) }

    private static func isPrime(_ n: Int) -> Bool {
        if n < 2 { return false }
        var d = 2
        while d * d <= n {
            if n % d == 0 { return false }
            d += 1
        }
        return true
    }

    // MARK: Geometry

    private static let triples: [(Int, Int, Int)] = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29)]

    static func geometry(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.geometry.count)
        if lv > 10 { return geometryDepth(lv, &r) }
        switch lv {
        case 1:
            let w = r.int(3, 20), h = r.int(2, 15)
            return problem("Perimeter of a \(w) × \(h) rectangle", 2 * (w + h), "Two widths and two heights: 2 × (\(w) + \(h)).")
        case 2:
            let w = r.int(3, 12), h = r.int(3, 12)
            return problem("Area of a \(w) × \(h) rectangle", w * h, "Width times height: \(w) × \(h).")
        case 3:
            let b = 2 * r.int(2, 10), h = r.int(3, 12)
            return problem("Area of a triangle, base \(b), height \(h)", b * h / 2, "Half of base times height: half of \(b) × \(h).")
        case 4:
            let a = r.int(30, 80), b = r.int(30, 80)
            return problem("Triangle with angles \(a)° and \(b)°. The third angle?", 180 - a - b, "The three angles add up to 180°. 180 − \(a) − \(b).")
        case 5:
            let a = r.int(10, 80)
            if r.next() < 0.5 { return problem("Complement of \(a)° (adds up to 90°)", 90 - a, "90 − \(a).") }
            let b = r.int(20, 160)
            return problem("An angle of \(b)° on a straight line. The angle beside it?", 180 - b, "A straight line is 180°. 180 − \(b).")
        case 6:
            let w = r.int(8, 14), h = r.int(7, 12), cw = r.int(2, 5), ch = r.int(2, 4)
            return problem("\(w) × \(h) rectangle with a \(cw) × \(ch) corner cut out. Area?", w * h - cw * ch, "Whole rectangle \(w * h), minus the corner \(cw * ch).")
        case 7:
            let rad = r.int(2, 10)
            if r.next() < 0.5 { return problem("Area of a circle, radius \(rad) (π ≈ 3)", 3 * rad * rad, "π × r²: 3 × \(rad) × \(rad).") }
            return problem("Circumference of a circle, radius \(rad) (π ≈ 3)", 6 * rad, "2 × π × r: 2 × 3 × \(rad).")
        case 8:
            let l = r.int(2, 9), w = r.int(2, 9), h = r.int(2, 9)
            return problem("Volume of a \(l) × \(w) × \(h) box", l * w * h, "Length × width × height. Do \(l) × \(w) = \(l * w) first.")
        case 9:
            let t = r.pick(triples)
            let k = r.int(1, 2)
            let doubled = k > 1 ? ", doubled" : ""
            if r.next() < 0.5 {
                return problem("Right triangle, legs \(t.0 * k) and \(t.1 * k). The long side?", t.2 * k, "A \(t.0)-\(t.1)-\(t.2) triangle\(doubled).")
            }
            return problem("Right triangle, long side \(t.2 * k), one leg \(t.0 * k). The other leg?", t.1 * k, "A \(t.0)-\(t.1)-\(t.2) triangle\(doubled).")
        default:
            if r.next() < 0.5 {
                let a = r.int(2, 10), h = r.int(2, 10), step = r.int(1, 5)
                let b = a + 2 * step
                return problem("Trapezoid with parallel sides \(a) and \(b), height \(h). Area?", (a + b) / 2 * h, "Average the parallel sides, \((a + b) / 2), then times \(h).")
            }
            let n = r.int(5, 10)
            return problem("Angles inside a \(n)-sided polygon add up to?", (n - 2) * 180, "(\(n) − 2) × 180°.")
        }
    }

    // MARK: Probability and counting

    static func probability(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.probability.count)
        if lv > 10 { return probabilityDepth(lv, &r) }
        switch lv {
        case 1:
            let n = r.int(2, 6)
            return problem("A fair coin is flipped \(n) times. How many different results are there?", 1 << n, "Each flip doubles the options: 2 multiplied \(n) times.")
        case 2:
            let shirts = r.int(2, 9), trousers = r.int(2, 9)
            return problem("\(shirts) shirts and \(trousers) pairs of trousers. How many outfits?", shirts * trousers, "Each shirt goes with each pair: \(shirts) × \(trousers).")
        case 3:
            let k = r.int(2, 20)
            return problem("Roll a fair die \(6 * k) times. About how many times do you expect one particular number?", k, "Each number comes up about 1 time in 6: \(6 * k) ÷ 6.")
        case 4:
            let total = r.pick([4, 5, 10, 20, 25])
            let red = r.int(1, total - 1)
            return problem(
                "A bag has \(red) red and \(total - red) blue marbles. Chance of drawing red, in percent?",
                100 * red / total,
                "\(red) out of \(total): scale to 100 by multiplying by \(100 / total)."
            )
        case 5:
            let n = r.int(3, 6)
            var answer = 1
            if n >= 2 { for i in 2...n { answer *= i } }
            return problem("In how many different orders can \(n) people stand in a line?", answer, "\(n) choices for first place, then \(n - 1), and so on down to 1.")
        case 6:
            let s = r.int(2, 12)
            return problem("Two fair dice. In how many ways can they total \(s)?", 6 - abs(s - 7), "Seven is the easiest total (6 ways). Each step away from 7 loses one way.")
        case 7:
            let n = r.int(4, 12)
            return problem("\(n) people shake hands once with each other. How many handshakes?", n * (n - 1) / 2, "\(n) × \(n - 1) counts each handshake twice, so halve it.")
        case 8:
            let base = r.pick([10, 26])
            let n = base == 10 ? r.int(2, 4) : r.int(2, 3)
            let what = base == 10 ? "\(n)-digit PIN (digits 0–9)" : "\(n)-letter code (A–Z)"
            var answer = 1
            for _ in 0..<n { answer *= base }
            return problem("How many possible \(what)? Repeats are fine.", answer, "\(base) options for each spot, \(n) spots: \(base) multiplied \(n) times.")
        case 9:
            let a = r.int(1, 9), b = r.int(1, 9)
            return problem("A \(10 * a)% chance, then another \(10 * b)% chance. Chance of both, in percent?", a * b, "Multiply the chances: \(10 * a)% of \(10 * b)% is \(a) × \(b).")
        default:
            let n = r.int(5, 8), k = r.int(2, 3)
            var top = 1, bottom = 1
            for i in 0..<k {
                top *= n - i
                bottom *= i + 1
            }
            let second = k > 1 ? " × \(n - 1)" : ""
            let third = k > 2 ? " × \(n - 2)" : ""
            return problem("Choose \(k) people from \(n) for a team. How many different teams?", top / bottom, "\(n)\(second)\(third) = \(top) ordered picks, divided by the \(bottom) orders of the same team.")
        }
    }

    // MARK: Number theory

    private static let hexDigits = Array("0123456789ABCDEF")

    static func numberTheory(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.numberTheory.count)
        if lv > 10 { return numberTheoryDepth(lv, &r) }
        switch lv {
        case 1:
            let n = r.int(6, 40)
            var count = 0
            for d in 1...n where n % d == 0 { count += 1 }
            return problem("How many numbers divide \(n) exactly? (1 and \(n) count)", count, "Go through the pairs that multiply to \(n). Each pair gives two numbers.")
        case 2:
            let p = r.pick([2, 3, 5, 7]), q = r.pick([11, 13, 17, 19, 23])
            return problem("Smallest prime factor of \(p * q)", p, "\(p * q) = \(p) × \(q), and \(p) is the smaller prime.")
        case 3:
            let n = r.int(10, 90)
            var next = n + 1
            while !isPrime(next) { next += 1 }
            return problem("The first prime after \(n)", next, "Skip even numbers and multiples of 3, 5 and 7. \(next) has no divisor but 1 and itself.")
        case 4:
            let g = r.int(2, 12), x = r.int(2, 6), y = r.int(2, 6)
            let a = g * x, b = g * y
            return problem("Greatest common divisor of \(a) and \(b)", gcd(a, b), "The biggest number that goes into both \(a) and \(b).")
        case 5:
            let a = r.int(2, 12), b = r.int(2, 12)
            return problem("Least common multiple of \(a) and \(b)", a * b / gcd(a, b), "The first number both \(a) and \(b) divide into. \(a) × \(b) divided by their GCD, \(gcd(a, b)).")
        case 6:
            let d = r.pick([3, 9])
            let n = r.int(100, 9999)
            return problem("Remainder of \(n) ÷ \(d)", n % d, "Add up the digits of \(n), then take the remainder of that by \(d). It matches.")
        case 7:
            let bits = r.int(4, 6)
            var value = 1
            var text = "1"
            for _ in 1..<bits {
                let bit = r.int(0, 1)
                value = value * 2 + bit
                text += String(bit)
            }
            return problem("Binary \(text) in decimal", value, "From the right the places are 1, 2, 4, 8, 16... Add the places that have a 1.")
        case 8:
            let n = r.int(5, 63)
            return problem("\(n) in binary", Int(String(n, radix: 2)) ?? 0, "Take away the biggest power of 2 you can (32, 16, 8, 4, 2, 1), write a 1 for it and a 0 when you skip.")
        case 9:
            let hi = r.int(1, 15), lo = r.int(0, 15)
            return problem("Hexadecimal \(hexDigits[hi])\(hexDigits[lo]) in decimal", hi * 16 + lo, "The first digit counts 16s: \(hi) × 16 = \(hi * 16). Then add \(lo). (A = 10 ... F = 15.)")
        default:
            let a = r.int(2, 9), b = r.int(2, 6)
            var power = 1
            for _ in 0..<b { power *= a }
            return problem("Last digit of \(a)^\(b)", power % 10, "Only the last digit matters: multiply \(b) times, keeping just the last digit each time.")
        }
    }

    // MARK: Everyday money

    static func money(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.money.count)
        if lv > 10 { return moneyDepth(lv, &r) }
        switch lv {
        case 1:
            let paid = r.pick([20, 50, 100])
            let cost = r.int(3, paid - 1)
            return problem("You pay $\(paid) for something that costs $\(cost). Change?", paid - cost, "Count up from \(cost) to \(paid).")
        case 2:
            let n = r.int(2, 9), price = r.int(2, 25)
            return problem("\(n) items at $\(price) each. Total?", n * price, "Split \(price) into tens and ones, multiply each by \(n), and add.")
        case 3:
            let n = r.pick([4, 6, 8, 10, 12])
            let each = r.int(1, 9)
            return problem("A pack of \(n) costs $\(n * each). What does one cost, in dollars?", each, "Divide the price by \(n).")
        case 4:
            let n = r.int(2, 8), each = r.int(5, 30)
            return problem("A $\(n * each) bill split evenly between \(n) people. Each pays?", each, "\(n * each) ÷ \(n).")
        case 5:
            let price = 40 * r.int(1, 10)
            let off = r.pick([10, 20, 25, 50])
            return problem("$\(price) with \(off)% off. New price?", price - price * off / 100, "\(off)% of \(price) is \(price * off / 100). Take it away.")
        case 6:
            let bill = 20 * r.int(2, 12)
            let pct = r.pick([10, 15, 20])
            let tail = pct == 15 ? "Add half of that for 15%." : (pct == 20 ? "Double it for 20%." : "That is the answer.")
            return problem("\(pct)% tip on a $\(bill) bill. The tip, in dollars?", bill * pct / 100, "10% of \(bill) is \(bill / 10). \(tail)")
        case 7:
            let weekly = r.int(5, 40), weeks = r.int(4, 20)
            return problem("Save $\(weekly) a week. How many weeks to reach $\(weekly * weeks)?", weeks, "\(weekly * weeks) ÷ \(weekly).")
        case 8:
            let from = 20 * r.int(1, 10)
            let pct = r.pick([10, 20, 25, 50])
            let change = from * pct / 100
            if r.next() < 0.5 { return problem("A price rises from $\(from) to $\(from + change). By what percent?", pct, "It went up $\(change). That is \(change) out of \(from).") }
            return problem("A price drops from $\(from) to $\(from - change). By what percent did it fall?", pct, "It went down $\(change). That is \(change) out of \(from).")
        case 9:
            let hundreds = r.int(1, 20), rate = r.int(2, 8), years = r.int(2, 5)
            return problem(
                "$\(hundreds * 100) at \(rate)% simple interest a year, for \(years) years. Interest earned?",
                hundreds * rate * years,
                "1% of $\(hundreds * 100) is $\(hundreds). Times \(rate)%, times \(years) years."
            )
        default:
            let hundreds = r.int(1, 10)
            let rate = r.pick([10, 20, 50])
            let factor = Double(100 + rate) / 100
            return problem(
                "$\(hundreds * 100) grows \(rate)% a year, compounded. How much after 2 years?",
                hundreds * (100 + rate) * (100 + rate) / 100,
                "Grow it twice: times \(String(factor)) and times \(String(factor)) again. The second year earns interest on the first."
            )
        }
    }
}
