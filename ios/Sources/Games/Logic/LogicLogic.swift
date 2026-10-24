import Foundation

/// One puzzle in content/games/logic.json.
struct LogicItem: Codable, Equatable {
    let id: String
    let kind: String
    let level: Int
    let prompt: String
    let options: [String]
    let answer: String
    let why: String
}

private struct LogicFile: Codable {
    let items: [LogicItem]
}

/// Puzzles solved (by id) and the ones missed last time. Stays on the device.
struct LogicProgress: Codable, Equatable {
    var solved: [String: Int] = [:]
    var missed: [String] = []
}

enum LogicData {
    /// Decodes the logic.json bytes. Rows with a bad level or an answer that is not an option are skipped.
    static func parse(_ data: Data) -> [LogicItem] {
        guard let file = try? JSONDecoder().decode(LogicFile.self, from: data) else { return [] }
        return file.items.filter { $0.level >= 1 && $0.level <= 3 && $0.options.contains($0.answer) }
    }

    /// Loads the bundled puzzles. Returns an empty list (never crashes) when the file is missing.
    static func load() -> [LogicItem] {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "logic", withExtension: "json", subdirectory: "games"),
               let data = try? Data(contentsOf: url) {
                let items = parse(data)
                if !items.isEmpty { return items }
            }
        }
        return []
    }
}

enum LogicStore {
    private static let key = "detour.games.logic"

    static func load(defaults: UserDefaults = .standard) -> LogicProgress {
        guard let data = defaults.data(forKey: key), let value = try? JSONDecoder().decode(LogicProgress.self, from: data) else { return LogicProgress() }
        return value
    }

    static func save(_ progress: LogicProgress, defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(progress) { defaults.set(data, forKey: key) }
    }
}

enum LogicBuilder {
    static func title(forKind kind: String) -> String {
        switch kind {
        case "syllogism": return "Does the conclusion follow?"
        case "fallacy": return "Spot the flaw"
        case "order": return "Work it out"
        default: return "Think it through"
        }
    }

    /// Level 2 opens after 8 puzzles solved, level 3 after 20.
    static func unlockedLevel(_ progress: LogicProgress) -> Int {
        let n = progress.solved.values.filter { $0 > 0 }.count
        if n >= 20 { return 3 }
        if n >= 8 { return 2 }
        return 1
    }

    /// A round: puzzles missed last time come back first (up to half), then unsolved ones within the level (mixing kinds), then a refresher.
    static func round<G: RandomNumberGenerator>(all: [LogicItem], progress: LogicProgress, length: Int, using rng: inout G) -> [LogicItem] {
        let level = unlockedLevel(progress)
        let byId = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var chosen: [LogicItem] = []
        var used: Set<String> = []
        func add(_ item: LogicItem?, newKind: Bool = false) {
            guard let item, !used.contains(item.id), chosen.count < length else { return }
            if newKind, let last = chosen.last, last.kind == item.kind { return }
            used.insert(item.id)
            chosen.append(item)
        }
        let missed = progress.missed.compactMap { byId[$0] }.shuffled(using: &rng)
        for item in missed.prefix((length + 1) / 2) { add(item) }
        let fresh = all.filter { $0.level <= level && (progress.solved[$0.id] ?? 0) == 0 }.shuffled(using: &rng)
        for item in fresh { add(item, newKind: true) }
        for item in fresh { add(item) }
        for item in all.filter({ $0.level <= level }).shuffled(using: &rng) { add(item) }
        return chosen.map { item in
            LogicItem(id: item.id, kind: item.kind, level: item.level, prompt: item.prompt, options: item.options.shuffled(using: &rng), answer: item.answer, why: item.why)
        }
    }

    static func apply(_ progress: LogicProgress, id: String, right: Bool) -> LogicProgress {
        var next = progress
        next.missed.removeAll { $0 == id }
        if right {
            next.solved[id, default: 0] += 1
        } else {
            next.solved[id] = 0
            next.missed.append(id)
        }
        if next.missed.count > 20 { next.missed.removeFirst(next.missed.count - 20) }
        return next
    }
}
