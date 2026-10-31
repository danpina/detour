import Foundation

// Statistics, fractions and ratios, sequences, and rates. A port of web/src/lib/drills/{statistics,fractions,sequences,rates}.ts,
// drawing random numbers in the same order so a seed gives the same problems on both apps.

extension MoreLevels {
    static let statistics = [
        "Mean of three numbers",
        "Median of five",
        "Mode",
        "Range",
        "Mean of five",
        "Median of an even list",
        "Find the missing value for a mean",
        "Totals and means",
        "Weighted means: two groups",
        "How a new value moves the mean",
        "Quartiles and the interquartile range",
        "Rank and percentile",
        "Expected winnings",
        "Standard deviation: the easy sets",
        "Variance",
        "Standard deviation from a data set",
        "z-scores: how many SDs from the mean",
        "From a z-score back to a score",
        "The 68–95 rule for bell curves",
        "Correlation: r² as a percent",
        "Predicting with a fitted line",
        "Test results: how many are flagged?",
        "Test results: a positive, but is it real?",
        "Standard error and poll margins",
    ]

    static let fractions = [
        "Equivalent fractions",
        "Simplifying fractions",
        "Adding fractions",
        "Ratios: find the other part",
        "Sharing in a ratio",
        "Scaling a recipe",
        "Unit rates",
        "Map scales",
        "A fraction of a fraction",
        "Dividing by a fraction",
        "Mixed numbers to fractions",
        "Subtracting fractions",
        "Which fraction is larger?",
        "Fractions as percents",
        "Ratios with three parts",
        "Solving a proportion",
        "Rates as fractions",
        "How many fit in a fraction?",
        "A percent of a percent",
        "Working back from what is left",
    ]

    static let sequences = [
        "Add the same each time",
        "The missing term",
        "Multiply each time",
        "The 10th term and beyond",
        "Adding 1 to n",
        "Sums of odd numbers",
        "Squares, cubes and growing steps",
        "Each term is the sum of the last two",
        "Two sequences woven together",
        "Sums of sequences",
        "Triangular numbers",
        "Terms of a doubling or tripling sequence",
        "What comes next? (pick one)",
        "Growing steps: quadratic patterns",
        "Sums of squares",
        "Two rules in turn",
        "Working backwards in a chain",
        "Which term is it?",
        "Adding powers of 2",
        "True or false: sequences",
    ]

    static let rates = [
        "Distance from speed and time",
        "Time from distance and speed",
        "Speed from distance and time",
        "Average speed there and back",
        "Meeting in the middle",
        "Working together",
        "Ages: sum and difference",
        "Mixing solutions",
        "Doubling",
        "Break-even",
        "Metres per second to km/h",
        "Fuel use",
        "More workers, less time",
        "Diluting a mixture",
        "Catching up",
        "Who is faster?",
        "Tripling",
        "Boats and currents",
        "Ages in the future",
        "A tank that empties",
    ]
}

extension Drills {
    private static func entry(_ prompt: String, _ answer: Int, _ hint: String) -> DrillProblem {
        DrillProblem(prompt: prompt, answer: Double(answer), hint: hint)
    }

    private static func ipow(_ base: Int, _ exponent: Int) -> Int {
        var result = 1
        for _ in 0..<exponent { result *= base }
        return result
    }

    private static func list(_ values: [Int]) -> String { values.map { String($0) }.joined(separator: ", ") }

    private static func shuffled(_ items: [Int], _ r: inout SeededRng) -> [Int] {
        var a = items
        var i = a.count - 1
        while i > 0 {
            let j = r.int(0, i)
            a.swapAt(i, j)
            i -= 1
        }
        return a
    }

    /// `n` different whole numbers between lo and hi.
    private static func distinct(_ r: inout SeededRng, _ n: Int, _ lo: Int, _ hi: Int) -> [Int] {
        var out: [Int] = []
        while out.count < n {
            let v = r.int(lo, hi)
            if !out.contains(v) { out.append(v) }
        }
        return out
    }

    private static func plural(_ n: Int) -> String { n > 1 ? "s" : "" }

    // MARK: Statistics

    private static let spreads: [[Int]] = [
        [-1, 1], [-3, 3], [-2, -2, 2, 2], [-3, -1, 1, 3], [-5, -1, 1, 5], [-4, -2, 2, 4], [-6, -2, 2, 6], [-7, -1, 1, 7],
    ]

    /// [people with it, % of them caught, % of the others wrongly flagged], out of 1,000 people.
    private static let screening: [[Int]] = [
        [40, 60, 10], [40, 80, 5], [40, 80, 10], [50, 60, 10], [100, 60, 10], [100, 60, 20], [100, 70, 20],
        [100, 80, 5], [100, 90, 10], [125, 60, 20], [200, 60, 5], [200, 60, 10], [200, 80, 5], [200, 80, 20],
    ]

    private static let squares: [[Int]] = [[4, 2], [9, 3], [16, 4], [25, 5], [36, 6], [49, 7], [64, 8], [100, 10]]
    private static let polls: [[Int]] = [[100, 10], [400, 20], [625, 25], [2500, 50]]
    private static let lines: [[String]] = [["sales", "temperature"], ["test score", "hours studied"], ["energy use", "people in the house"], ["weight", "height"]]
    private static let weightedGroups: [[Int]] = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1], [1, 4], [4, 1]]

    static func statistics(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        switch min(max(level, 1), MoreLevels.statistics.count) {
        case 1:
            let m = r.int(8, 40), d1 = r.int(1, 6), d2 = r.int(1, 6)
            let values = shuffled([m - d1, m + d2, m + d1 - d2], &r)
            return entry("Mean of \(list(values))", m, "Add them up (\(3 * m)) and divide by 3.")
        case 2:
            let values = distinct(&r, 5, 1, 40)
            let sorted = values.sorted()
            let shown = shuffled(values, &r)
            return entry("Median of \(list(shown))", sorted[2], "Put them in order: \(list(sorted)). The median is the middle one.")
        case 3:
            let d = distinct(&r, 4, 1, 30)
            let v = d[0], u1 = d[1], u2 = d[2], u3 = d[3]
            let values = shuffled([v, v, v, u1, u1, u2, u2, u3], &r)
            return entry("Mode of \(list(values))", v, "The mode is the value that appears most often. \(v) shows up 3 times.")
        case 4:
            let values = distinct(&r, 6, 1, 60)
            let hi = values.max() ?? 0, lo = values.min() ?? 0
            return entry("Range of \(list(values))", hi - lo, "Biggest minus smallest: \(hi) − \(lo).")
        case 5:
            let m = r.int(40, 80)
            let dev = [r.int(-8, 8), r.int(-8, 8), r.int(-8, 8), r.int(-8, 8)]
            let last = -(dev[0] + dev[1] + dev[2] + dev[3])
            let values = shuffled((dev + [last]).map { m + $0 }, &r)
            return entry("Mean of \(list(values))", m, "Guess \(m), then see how far each number is above or below it. The gaps cancel out.")
        case 6:
            let v0 = r.int(1, 10)
            let v1 = v0 + r.int(1, 5)
            let v2 = v1 + r.int(1, 5)
            let v3 = v2 + 2 * r.int(0, 3)
            let v4 = v3 + r.int(1, 5)
            let v5 = v4 + r.int(1, 5)
            let sorted = [v0, v1, v2, v3, v4, v5]
            let shown = shuffled(sorted, &r)
            return entry("Median of \(list(shown))", (v2 + v3) / 2, "In order: \(list(sorted)). With an even count, the median is halfway between the middle two: \(v2) and \(v3).")
        case 7:
            let n = r.int(4, 6), m = r.int(35, 70)
            var known: [Int] = []
            for _ in 0..<(n - 1) { known.append(m + r.int(-6, 6)) }
            let last = n * m - known.reduce(0, +)
            return entry("The mean of \(n) numbers is \(m). \(n - 1) of them are \(list(known)). The last one?", last, "All \(n) must add up to \(n) × \(m) = \(n * m). Take away the ones you know.")
        case 8:
            let n = r.int(3, 12), m = r.int(5, 30)
            if r.next() < 0.5 { return entry("The mean of \(n) test scores is \(m). What do they add up to?", n * m, "Mean times count: \(m) × \(n).") }
            return entry("\(n) numbers add up to \(n * m). Their mean?", m, "Total divided by count: \(n * m) ÷ \(n).")
        case 9:
            let g = r.pick(weightedGroups)
            let n1 = g[0], n2 = g[1]
            let mean = r.int(60, 90), e = r.int(1, 4)
            let g1 = mean + n2 * e, g2 = mean - n1 * e
            return entry(
                "\(n1) student\(plural(n1)) averaged \(g1) and \(n2) student\(plural(n2)) averaged \(g2). The average of all of them?",
                mean,
                "Weight each average by its group: (\(n1) × \(g1) + \(n2) × \(g2)) ÷ \(n1 + n2). Bigger groups pull harder."
            )
        case 10:
            let n = r.int(3, 9), m = r.int(10, 40), d = r.int(1, 6)
            let x = m + (n + 1) * d
            return entry("The mean of \(n) numbers is \(m). You add a \(x). New mean?", m + d, "\(x) is \((n + 1) * d) above \(m). Shared among \(n + 1) numbers, the mean rises by \(d).")
        case 11:
            var sorted = [r.int(1, 10)]
            for i in 1..<7 { sorted.append(sorted[i - 1] + r.int(1, 6)) }
            let shown = shuffled(sorted, &r)
            return entry(
                "Interquartile range (Q3 − Q1) of \(list(shown))",
                sorted[5] - sorted[1],
                "In order: \(list(sorted)). Q1 is the middle of the lower three (\(sorted[1])), Q3 the middle of the upper three (\(sorted[5]))."
            )
        case 12:
            let n = r.pick([20, 25, 50, 100]), rank = r.int(1, n - 1)
            return entry("In a group of \(n), you rank #\(rank) from the top. What percent scored below you?", (n - rank) * 100 / n, "\(n - rank) of \(n) are below you. Each person is worth \(100 / n)%.")
        case 13:
            let x = r.int(1, 20), y = r.int(1, 9)
            return entry("A $\(10 * x) prize with a \(10 * y)% chance. What is the expected win, in dollars?", x * y, "Prize times chance: \(10 * x) × \(10 * y)% = \(x) × \(y).")
        case 14:
            let n = r.pick([4, 6]), m = r.int(20, 60), d = r.int(1, 12)
            var values: [Int] = []
            for _ in 0..<(n / 2) { values.append(m - d); values.append(m + d) }
            let shown = shuffled(values, &r)
            return entry("Standard deviation of \(list(shown))", d, "Every number is exactly \(d) from the mean, \(m). So the typical distance, the SD, is \(d).")
        case 15:
            let dev = r.pick(spreads), m = r.int(20, 60)
            let variance = dev.reduce(0) { $0 + $1 * $1 } / dev.count
            let shown = shuffled(dev.map { m + $0 }, &r)
            return entry("Variance of \(list(shown))", variance, "The mean is \(m). Square each distance from it (\(list(dev.map { $0 * $0 }))) and average those.")
        case 16:
            if r.next() < 0.5 {
                let m = r.int(20, 60)
                let shown = shuffled([-7, -1, 1, 7].map { m + $0 }, &r)
                return entry("Standard deviation of \(list(shown))", 5, "The mean is \(m). Squared distances: 49, 1, 1, 49. Their average is 25, and the square root of 25 is 5.")
            }
            let sd = r.int(2, 12)
            return entry("A data set has a variance of \(sd * sd). Its standard deviation?", sd, "The SD is the square root of the variance.")
        case 17:
            let m = r.int(50, 100), sd = r.int(2, 15), k = r.int(1, 4)
            return entry("Mean \(m), SD \(sd). A score of \(m + k * sd) is how many SDs above the mean?", k, "The gap is \(k * sd). Divide by the SD: \(k * sd) ÷ \(sd).")
        case 18:
            let m = r.int(80, 120), sd = r.int(2, 15), k = r.int(1, 4)
            if r.next() < 0.5 { return entry("Mean \(m), SD \(sd). What score is \(k) SD\(plural(k)) above the mean?", m + k * sd, "\(k) × \(sd) = \(k * sd). Add it to \(m).") }
            return entry("Mean \(m), SD \(sd). What score is \(k) SD\(plural(k)) below the mean?", m - k * sd, "\(k) × \(sd) = \(k * sd). Take it from \(m).")
        case 19:
            let m = r.int(100, 170), sd = r.int(5, 15), kind = r.int(0, 3)
            let wheres = ["between \(m - sd) and \(m + sd)", "between \(m - 2 * sd) and \(m + 2 * sd)", "between \(m) and \(m + sd)", "above \(m + sd)"]
            let answers = [68, 95, 34, 16]
            let hints = [
                "Within 1 SD of the mean is about 68%.",
                "Within 2 SDs of the mean is about 95%.",
                "Half of 68% is on each side of the mean: 34%.",
                "Half the data is above the mean. Take away 34% for the part up to 1 SD above: 50 − 34.",
            ]
            return entry("A bell-shaped set has mean \(m) and SD \(sd). Roughly what percent lie \(wheres[kind])?", answers[kind], hints[kind])
        case 20:
            let t = r.int(2, 9)
            return entry("A correlation of r = 0.\(t). What percent of the variation does it explain (r² × 100)?", t * t, "Square 0.\(t) to get \(String(Double(t * t) / 100)). As a percent, that is \(t * t).")
        case 21:
            let names = r.pick(lines)
            let a = r.int(5, 40), b = r.int(2, 9), x = r.int(5, 30)
            return entry("A fitted line: \(names[0]) = \(a) + \(b) × \(names[1]). Predict the \(names[0]) when \(names[1]) is \(x).", a + b * x, "Put \(x) in: \(a) + \(b) × \(x).")
        case 22:
            let sc = r.pick(screening)
            let sick = sc[0], sens = sc[1], fp = sc[2]
            let caught = sick * sens / 100, wrong = (1000 - sick) * fp / 100
            return entry(
                "Of 1000 people, \(sick) have a condition. The test catches \(sens)% of them and wrongly flags \(fp)% of the rest. How many test positive?",
                caught + wrong,
                "Caught: \(sens)% of \(sick) = \(caught). False alarms: \(fp)% of \(1000 - sick) = \(wrong). Add them."
            )
        case 23:
            let sc = r.pick(screening)
            let sick = sc[0], sens = sc[1], fp = sc[2]
            let caught = sick * sens / 100, wrong = (1000 - sick) * fp / 100
            return entry(
                "Of 1000 people, \(sick) have a condition. The test catches \(sens)% of them and wrongly flags \(fp)% of the rest. If you test positive, what percent chance is it real?",
                100 * caught / (caught + wrong),
                "\(caught) real positives and \(wrong) false alarms. Real share: \(caught) out of \(caught + wrong)."
            )
        default:
            if r.next() < 0.5 {
                let sq = r.pick(squares)
                let n = sq[0], root = sq[1]
                let k = r.int(2, 12)
                return entry("A sample of \(n) has an SD of \(k * root). The standard error of its mean (SD ÷ √n)?", k, "√\(n) = \(root). \(k * root) ÷ \(root).")
            }
            let poll = r.pick(polls)
            let n = poll[0], root = poll[1]
            return entry("A poll of \(n) people. Roughly what is the margin of error in percent (100 ÷ √n)?", 100 / root, "√\(n) = \(root). Then 100 ÷ \(root).")
        }
    }

    // MARK: Fractions and ratios

    private static let lowest: [[Int]] = [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [5, 8]]
    private static let denominators: [[Int]] = [[2, 3, 6], [3, 4, 12], [2, 5, 10], [3, 5, 15], [4, 6, 12], [2, 6, 6], [3, 6, 6], [4, 5, 20]]
    private static let foods = ["eggs", "cups of flour", "tomatoes", "spoons of sugar"]
    private static let mapScales = [2, 5, 10, 20, 25, 50]
    private static let scoops: [[Int]] = [[1, 2], [1, 4], [3, 4], [2, 3], [1, 3], [2, 5]]

    static func fractions(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.fractions.count)
        if lv > 10 { return fractionsDepth(lv, &r) }
        switch lv {
        case 1:
            let b = r.int(2, 9), a = r.int(1, b - 1), k = r.int(2, 6)
            return entry("\(a)/\(b) = ?/\(b * k)", a * k, "\(b) times \(k) is \(b * k), so multiply the top by \(k) as well.")
        case 2:
            let f = r.pick(lowest), g = r.int(2, 9)
            let p = f[0], q = f[1]
            return entry("\(p * g)/\(q * g) in simplest form has what denominator?", q, "Divide top and bottom by \(g): \(p)/\(q).")
        case 3:
            let dd = r.pick(denominators)
            let d1 = dd[0], d2 = dd[1], lcm = dd[2]
            let n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1)
            return entry(
                "\(n1)/\(d1) + \(n2)/\(d2) = ?/\(lcm)",
                n1 * lcm / d1 + n2 * lcm / d2,
                "Rewrite both over \(lcm): \(n1 * lcm / d1)/\(lcm) and \(n2 * lcm / d2)/\(lcm). Add the tops."
            )
        case 4:
            let a = r.int(1, 5), b = r.int(1, 5), k = r.int(2, 9)
            return entry("The ratio is \(a):\(b). If the first part is \(a * k), the second?", b * k, "The first part is \(a) × \(k), so the second is \(b) × \(k).")
        case 5:
            let a = r.int(1, 5), b = r.int(1, 5), k = r.int(2, 12)
            return entry(
                "Share $\((a + b) * k) in the ratio \(a):\(b). The larger share, in dollars?",
                max(a, b) * k,
                "\(a) + \(b) = \(a + b) parts. One part is $\(k). The larger share is \(max(a, b)) parts."
            )
        case 6:
            let food = r.pick(foods), sv = r.pick([2, 4, 6]), k = r.int(1, 5), t = r.int(3, 12)
            return entry("A recipe for \(sv) uses \(sv * k) \(food). How many \(food) for \(t) people?", t * k, "That is \(k) per person. \(k) × \(t).")
        case 7:
            let n = r.int(2, 6), p = r.int(2, 9), m = r.int(n + 1, 12)
            return entry("\(n) notebooks cost $\(n * p). What do \(m) cost, in dollars?", m * p, "One costs $\(p). Then \(m) × \(p).")
        case 8:
            let sc = r.pick(mapScales), c = r.int(2, 12)
            if r.next() < 0.5 { return entry("On a map, 1 cm is \(sc) km. How far is \(c) cm, in km?", c * sc, "\(c) × \(sc).") }
            return entry("A trip of \(c * sc) km. How many cm on a map where 1 cm is \(sc) km?", c, "\(c * sc) ÷ \(sc).")
        case 9:
            let b = r.pick([2, 3, 4]), d = r.pick([2, 3, 4])
            let a = r.int(1, b - 1), c = r.int(1, d - 1), m = r.int(1, 6)
            return entry("\(a)/\(b) of \(c)/\(d) of \(b * d * m)", a * c * m, "\(c)/\(d) of \(b * d * m) is \(c * b * m). Then \(a)/\(b) of that.")
        default:
            let sc = r.pick(scoops), m = r.int(1, 5)
            let n = sc[0], d = sc[1]
            return entry("How many \(n)/\(d)-cup scoops fit in \(n * m) cups?", d * m, "Dividing by \(n)/\(d) means multiplying by \(d)/\(n): \(n * m) × \(d) ÷ \(n).")
        }
    }

    // MARK: Sequences and patterns

    static func sequences(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.sequences.count)
        if lv > 10 { return sequencesDepth(lv, &r) }
        switch lv {
        case 1:
            let a = r.int(1, 30), d = r.int(2, 9)
            return entry("\(a), \(a + d), \(a + 2 * d), \(a + 3 * d), ?", a + 4 * d, "It goes up by \(d) each time.")
        case 2:
            let a = r.int(1, 30), d = r.int(2, 9), hole = r.int(1, 3)
            let terms = (0...4).map { $0 == hole ? "?" : String(a + $0 * d) }
            return entry(terms.joined(separator: ", "), a + hole * d, "The steps are \(d) each. Fill in the gap.")
        case 3:
            let a = r.int(1, 5), q = r.pick([2, 3, 4])
            return entry("\(a), \(a * q), \(a * ipow(q, 2)), \(a * ipow(q, 3)), ?", a * ipow(q, 4), "Each term is \(q) times the one before.")
        case 4:
            let a = r.int(2, 12), d = r.int(2, 9), n = r.int(8, 20)
            return entry("\(a), \(a + d), \(a + 2 * d), \(a + 3 * d), ... What is term number \(n)?", a + (n - 1) * d, "Start at \(a) and take \(n - 1) steps of \(d).")
        case 5:
            let n = r.int(6, 25)
            if r.next() < 0.5 { return entry("1 + 2 + 3 + ... + \(n)", n * (n + 1) / 2, "Pair them up: \(n) × \(n + 1) ÷ 2.") }
            return entry("2 + 4 + 6 + ... + \(2 * n)", n * (n + 1), "That is double 1 + 2 + ... + \(n), which is \(n) × \(n + 1).")
        case 6:
            let n = r.int(4, 15)
            return entry("1 + 3 + 5 + ... (the first \(n) odd numbers)", n * n, "The first \(n) odd numbers always add up to \(n) × \(n).")
        case 7:
            let kind = r.int(0, 2), c = r.int(0, 9)
            if kind == 0 { return entry("\(1 + c), \(4 + c), \(9 + c), \(16 + c), ?", 25 + c, "Squares (1, 4, 9, 16...) plus \(c). The next square is 25.") }
            if kind == 1 { return entry("2, 6, 12, 20, ?", 30, "The steps grow: +4, +6, +8, so the next is +10.") }
            return entry("1, 8, 27, 64, ?", 125, "Cubes: 1³, 2³, 3³, 4³. The next is 5³.")
        case 8:
            let x1 = r.int(1, 6), x2 = r.int(1, 6)
            var terms = [x1, x2]
            for i in 2..<8 { terms.append(terms[i - 1] + terms[i - 2]) }
            return entry(
                "Each term is the sum of the two before: \(terms[0]), \(terms[1]), \(terms[2]), \(terms[3]), ... What is the 8th term?",
                terms[7],
                "Keep adding the last two: \(list(terms))."
            )
        case 9:
            let a = r.int(1, 20), b = r.int(1, 20), d = r.int(2, 6), e = r.int(2, 6)
            return entry(
                "\(a), \(b), \(a + d), \(b + e), \(a + 2 * d), \(b + 2 * e), ?",
                a + 3 * d,
                "Two sequences take turns. The odd places go up by \(d): \(a), \(a + d), \(a + 2 * d), then \(a + 3 * d)."
            )
        default:
            if r.next() < 0.5 {
                let a = r.int(1, 10), d = r.int(2, 6), n = r.int(5, 12)
                return entry(
                    "\(a) + \(a + d) + \(a + 2 * d) + ... (\(n) terms)",
                    n * (2 * a + (n - 1) * d) / 2,
                    "Average of first and last, times the count: (\(a) + \(a + (n - 1) * d)) ÷ 2 × \(n)."
                )
            }
            let q = r.pick([2, 3]), n = r.int(4, 7)
            var sum = 0, term = 1
            for _ in 0..<n {
                sum += term
                term *= q
            }
            return entry("1 + \(q) + \(q * q) + \(ipow(q, 3)) + ... (\(n) terms)", sum, "Each term is \(q) times the last. Add them: \(n) terms.")
        }
    }

    // MARK: Rates and word problems

    private static let roundTrips: [[Int]] = [[30, 60, 40], [40, 60, 48], [60, 90, 72], [20, 30, 24], [60, 120, 80], [30, 45, 36]]
    private static let teams: [[Int]] = [[6, 3, 2], [12, 4, 3], [10, 15, 6], [6, 12, 4], [20, 30, 12], [8, 8, 4], [12, 12, 6]]
    private static let mixGroups: [[Int]] = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1]]

    static func rates(_ level: Int, _ r: inout SeededRng) -> DrillProblem {
        let lv = min(max(level, 1), MoreLevels.rates.count)
        if lv > 10 { return ratesDepth(lv, &r) }
        switch lv {
        case 1:
            let v = 10 * r.int(3, 12), t = r.int(2, 5)
            return entry("A train goes \(v) km/h for \(t) hours. How far?", v * t, "Distance = speed × time: \(v) × \(t).")
        case 2:
            let v = 10 * r.int(3, 12), t = r.int(2, 6)
            return entry("\(v * t) km at \(v) km/h. How many hours?", t, "Time = distance ÷ speed: \(v * t) ÷ \(v).")
        case 3:
            let v = 10 * r.int(3, 12), t = r.int(2, 6)
            return entry("\(v * t) km in \(t) hours. Speed in km/h?", v, "Speed = distance ÷ time: \(v * t) ÷ \(t).")
        case 4:
            let trip = r.pick(roundTrips)
            let v1 = trip[0], v2 = trip[1], avg = trip[2]
            return entry(
                "You drive out at \(v1) km/h and back at \(v2) km/h. Average speed for the round trip, in km/h?",
                avg,
                "It is not the plain average: you spend longer at the slower speed. Use 2 × \(v1) × \(v2) ÷ (\(v1) + \(v2))."
            )
        case 5:
            let v1 = 10 * r.int(3, 9), v2 = 10 * r.int(3, 9), k = r.int(1, 5)
            return entry(
                "Two trains \(k * (v1 + v2)) km apart head toward each other at \(v1) and \(v2) km/h. Hours until they meet?",
                k,
                "They close \(v1 + v2) km every hour. \(k * (v1 + v2)) ÷ \(v1 + v2)."
            )
        case 6:
            let team = r.pick(teams)
            let a = team[0], b = team[1], together = team[2]
            return entry(
                "One pipe fills a tank in \(a) hours and another in \(b) hours. Both open: how many hours?",
                together,
                "Add the speeds: 1/\(a) + 1/\(b) of the tank per hour. Or \(a) × \(b) ÷ (\(a) + \(b))."
            )
        case 7:
            let older = r.int(20, 45), younger = r.int(5, 15)
            return entry(
                "Two ages add up to \(older + younger) and differ by \(older - younger). The older age?",
                older,
                "Add the sum and the difference, then halve: (\(older + younger) + \(older - younger)) ÷ 2."
            )
        case 8:
            let g = r.pick(mixGroups)
            let n1 = g[0], n2 = g[1]
            let mean = r.int(20, 40), e = r.int(1, 4)
            let c1 = mean + n2 * e, c2 = mean - n1 * e
            return entry(
                "\(100 * n1) ml of \(c1)% juice is mixed with \(100 * n2) ml of \(c2)% juice. Percent juice in the mix?",
                mean,
                "Weight each by its volume: (\(n1) × \(c1) + \(n2) × \(c2)) ÷ \(n1 + n2)."
            )
        case 9:
            let start = r.int(2, 20), d = r.int(2, 6), k = r.int(2, 5)
            return entry("A colony of \(start) doubles every \(d) years. How many after \(k * d) years?", start * ipow(2, k), "\(k * d) years is \(k) doublings: \(start) × 2, \(k) times over.")
        default:
            let fixed = r.int(10, 40), per = r.int(2, 9), gb = r.int(3, 12)
            return entry(
                "Plan A: $\(fixed) plus $\(per) per GB. Plan B: $\(fixed + per * gb) flat. At how many GB do they cost the same?",
                gb,
                "Plan A's per-GB charges must fill the gap: $\(fixed + per * gb) − $\(fixed) = $\(per * gb). Divide by $\(per)."
            )
        }
    }
}
