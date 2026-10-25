import Foundation

/// Pure logic for the Map game: what to ask, whether a tap is right, and which part of the world to show.
/// Coordinates are map units, 0 to `w` (10000) across, the projection content/games/map.json was built with.

struct MapCountry: Codable, Equatable {
    let id: String
    let name: String
    let continent: String
    let pop: Double
    let area: Int
    let label: [Int]
    /// Each shape is a flat list: x, y, x, y, ...
    let rings: [[Int]]
}

struct MapRiver: Codable, Equatable {
    let name: String
    let lines: [[Int]]
}

struct MapMountain: Codable, Equatable {
    let name: String
    let kind: String
    let continent: String
    let at: [Int]

    var isRange: Bool { kind == "range" }
}

struct MapData: Codable {
    let w: Int
    let h: Int
    let countries: [MapCountry]
    let rivers: [MapRiver]
    let mountains: [MapMountain]
}

enum MapSubject: String, CaseIterable, Identifiable {
    case countries, rivers, mountains, mixed
    var id: String { rawValue }
    var label: String {
        switch self {
        case .countries: return "Countries"
        case .rivers: return "Rivers"
        case .mountains: return "Mountains"
        case .mixed: return "A bit of everything"
        }
    }
}

enum MapRegion: String, CaseIterable, Identifiable {
    case world = "World"
    case europe = "Europe"
    case asia = "Asia"
    case africa = "Africa"
    case northAmerica = "North America"
    case southAmerica = "South America"
    case oceania = "Oceania"
    var id: String { rawValue }
}

struct MapSettings: Equatable {
    var subject: MapSubject = .countries
    var region: MapRegion = .world
    /// 1 easy, 2 medium, 3 hard.
    var difficulty = 1

    private static let key = "detour.games.map"

    static func load(defaults: UserDefaults = .standard) -> MapSettings {
        guard let raw = defaults.dictionary(forKey: key) else { return MapSettings() }
        var s = MapSettings()
        if let v = raw["subject"] as? String, let subject = MapSubject(rawValue: v) { s.subject = subject }
        if let v = raw["region"] as? String, let region = MapRegion(rawValue: v) { s.region = region }
        if let v = raw["difficulty"] as? Int, (1...3).contains(v) { s.difficulty = v }
        return s
    }

    func save(defaults: UserDefaults = .standard) {
        defaults.set(["subject": subject.rawValue, "region": region.rawValue, "difficulty": difficulty], forKey: MapSettings.key)
    }

    static func difficultyName(_ n: Int) -> String { n == 2 ? "Medium" : (n == 3 ? "Hard" : "Easy") }
}

enum MapTarget {
    case country(MapCountry)
    case river(MapRiver)
    case mountain(MapMountain)

    var name: String {
        switch self {
        case .country(let c): return c.name
        case .river(let r): return r.name
        case .mountain(let m): return m.name
        }
    }

    /// The name as asked: rivers get "River" in front, except the ones whose name already says it.
    var prompt: String {
        switch self {
        case .country(let c): return c.name
        case .river(let r): return (r.name == "Yellow River" || r.name == "Orange River") ? r.name : "River " + r.name
        case .mountain(let m): return m.name
        }
    }

    var subjectWord: String {
        switch self {
        case .country: return "Find the country"
        case .river: return "Find the river"
        case .mountain(let m): return m.isRange ? "Find the mountain range" : "Find the mountain"
        }
    }
}

struct MapVerdict: Equatable {
    let correct: Bool
    /// What was under the finger when it was something else.
    let tapped: String?
}

enum MapStore {
    static func decode(_ data: Data) -> MapData? { try? JSONDecoder().decode(MapData.self, from: data) }

    /// Loads the bundled map. Returns nil (never crashes) when the file is missing.
    static func load() -> MapData? {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "map", withExtension: "json", subdirectory: "games"), let data = try? Data(contentsOf: url), let map = decode(data) {
                return map
            }
        }
        return nil
    }
}

enum MapLogic {
    // How close a tap has to be, in map units. A country's whole shape counts; tiny ones get a generous circle.
    static let riverReach = 110.0
    static let peakReach = 150.0
    static let rangeReach = 450.0
    static let tinyCountryArea = 3000
    static let tinyCountryReach = 170.0

    // MARK: Geometry

    static func pointInRings(x: Double, y: Double, rings: [[Int]]) -> Bool {
        var inside = false
        for ring in rings {
            let n = ring.count / 2
            var j = n - 1
            for i in 0..<n {
                let xi = Double(ring[2 * i]), yi = Double(ring[2 * i + 1])
                let xj = Double(ring[2 * j]), yj = Double(ring[2 * j + 1])
                if (yi > y) != (yj > y), x < (xj - xi) * (y - yi) / (yj - yi) + xi { inside.toggle() }
                j = i
            }
        }
        return inside
    }

    private static func distToSegment(_ px: Double, _ py: Double, _ ax: Double, _ ay: Double, _ bx: Double, _ by: Double) -> Double {
        let dx = bx - ax, dy = by - ay
        let len2 = dx * dx + dy * dy
        let t = len2 == 0 ? 0 : max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        return hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    static func distanceToLines(x: Double, y: Double, lines: [[Int]]) -> Double {
        var best = Double.infinity
        for line in lines {
            var i = 0
            while i + 3 < line.count {
                best = min(best, distToSegment(x, y, Double(line[i]), Double(line[i + 1]), Double(line[i + 2]), Double(line[i + 3])))
                i += 2
            }
        }
        return best
    }

    static func countryAt(_ data: MapData, x: Double, y: Double) -> MapCountry? {
        // Small countries first, so a tiny country inside a bigger shape's outline still wins.
        data.countries.sorted { $0.area < $1.area }.first { pointInRings(x: x, y: y, rings: $0.rings) }
    }

    static func judge(_ data: MapData, target: MapTarget, x: Double, y: Double) -> MapVerdict {
        switch target {
        case .country(let c):
            let hit = countryAt(data, x: x, y: y)
            let near = c.area < tinyCountryArea && hypot(x - Double(c.label[0]), y - Double(c.label[1])) <= tinyCountryReach
            let correct = hit?.id == c.id || near
            return MapVerdict(correct: correct, tapped: correct ? nil : hit?.name)
        case .river(let river):
            let correct = distanceToLines(x: x, y: y, lines: river.lines) <= riverReach
            if correct { return MapVerdict(correct: true, tapped: nil) }
            let other = data.rivers.filter { $0.name != river.name }
                .map { (r: $0, d: distanceToLines(x: x, y: y, lines: $0.lines)) }
                .min { $0.d < $1.d }
            return MapVerdict(correct: false, tapped: (other != nil && other!.d <= riverReach) ? other!.r.name : nil)
        case .mountain(let mountain):
            func reach(_ m: MapMountain) -> Double { m.isRange ? rangeReach : peakReach }
            func dist(_ m: MapMountain) -> Double { hypot(x - Double(m.at[0]), y - Double(m.at[1])) }
            if dist(mountain) <= reach(mountain) { return MapVerdict(correct: true, tapped: nil) }
            let other = data.mountains.filter { $0.name != mountain.name && dist($0) <= reach($0) }.min { dist($0) < dist($1) }
            return MapVerdict(correct: false, tapped: other?.name)
        }
    }

    // MARK: Regions

    /// Longitude and latitude in degrees to map units: the same projection the data was built with.
    static func project(lon: Double, lat: Double, w: Double = 10000) -> (x: Double, y: Double) {
        func rad(_ d: Double) -> Double { d * .pi / 180 }
        func miller(_ l: Double) -> Double { 1.25 * log(tan(.pi / 4 + 0.4 * rad(l))) }
        let scale = w / (2 * .pi)
        let la = max(-56, min(84, lat))
        return (((rad(lon) + .pi) / (2 * .pi) * w).rounded(), ((miller(84) - miller(la)) * scale).rounded())
    }

    /// West, south, east, north in degrees.
    private static func degrees(_ region: MapRegion) -> (Double, Double, Double, Double)? {
        switch region {
        case .world: return nil
        case .europe: return (-25, 33, 45, 72)
        case .asia: return (25, -11, 150, 78)
        case .africa: return (-20, -36, 53, 38)
        case .northAmerica: return (-170, 5, -50, 75)
        case .southAmerica: return (-85, -57, -33, 14)
        case .oceania: return (110, -48, 180, 2)
        }
    }

    /// The part of the map to show for a region: x, y, width, height in map units.
    static func regionBox(_ data: MapData, region: MapRegion) -> (x: Double, y: Double, w: Double, h: Double) {
        guard let (w, s, e, n) = degrees(region) else { return (0, 0, Double(data.w), Double(data.h)) }
        let a = project(lon: w, lat: n, w: Double(data.w))
        let b = project(lon: e, lat: s, w: Double(data.w))
        let margin = 80.0
        let x0 = max(0, a.x - margin), y0 = max(0, a.y - margin)
        let x1 = min(Double(data.w), b.x + margin), y1 = min(Double(data.h), b.y + margin)
        return (x0, y0, x1 - x0, y1 - y0)
    }

    private static func inBox(_ box: (x: Double, y: Double, w: Double, h: Double), _ x: Double, _ y: Double) -> Bool {
        x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
    }

    // MARK: Rounds

    static func countryPool(_ data: MapData, region: MapRegion, difficulty: Int) -> [MapCountry] {
        let inRegion = data.countries.filter { region == .world || $0.continent == region.rawValue }
        let share = difficulty == 1 ? 0.4 : (difficulty == 2 ? 0.75 : 1.0)
        let bySize = inRegion.sorted { $0.area > $1.area }
        let count = max(min(6, bySize.count), Int((Double(bySize.count) * share).rounded(.up)))
        return Array(bySize.prefix(count))
    }

    static func riverPool(_ data: MapData, region: MapRegion) -> [MapRiver] {
        if region == .world { return data.rivers }
        let box = regionBox(data, region: region)
        return data.rivers.filter { river in
            river.lines.contains { line in
                var i = 0
                while i + 1 < line.count {
                    if inBox(box, Double(line[i]), Double(line[i + 1])) { return true }
                    i += 2
                }
                return false
            }
        }
    }

    static func mountainPool(_ data: MapData, region: MapRegion, difficulty: Int) -> [MapMountain] {
        let inRegion = data.mountains.filter { region == .world || $0.continent == region.rawValue }
        let ranges = inRegion.filter { $0.isRange }
        return difficulty == 1 && ranges.count >= 3 ? ranges : inRegion
    }

    /// A round of up to `length` questions, none repeated. Short when the region has fewer things to ask about.
    static func round<G: RandomNumberGenerator>(_ data: MapData, settings: MapSettings, length: Int, using rng: inout G) -> [MapTarget] {
        var countries = countryPool(data, region: settings.region, difficulty: settings.difficulty).shuffled(using: &rng).map { MapTarget.country($0) }
        var rivers = riverPool(data, region: settings.region).shuffled(using: &rng).map { MapTarget.river($0) }
        var mountains = mountainPool(data, region: settings.region, difficulty: settings.difficulty).shuffled(using: &rng).map { MapTarget.mountain($0) }
        var pools: [[MapTarget]]
        switch settings.subject {
        case .countries: pools = [countries]
        case .rivers: pools = [rivers]
        case .mountains: pools = [mountains]
        case .mixed: pools = [countries, countries, rivers, mountains]
        }
        countries = []; rivers = []; mountains = []
        var picked: [MapTarget] = []
        var turn = 0
        // Take from the pools in turn, so a mixed round alternates; stop when every pool is empty.
        while picked.count < length, pools.contains(where: { !$0.isEmpty }) {
            let slot = turn % pools.count
            if !pools[slot].isEmpty { picked.append(pools[slot].removeFirst()) }
            turn += 1
        }
        return picked
    }
}
