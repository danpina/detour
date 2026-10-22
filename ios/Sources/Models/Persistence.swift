import Foundation

/// Everything the app remembers about the user, kept on the device. No accounts, nothing is uploaded.
struct UserSettings: Codable, Hashable {
    var interests: [Interest] = []
    var onboardingDone = false
    /// Cards per set (3, 5 or 8).
    var setSize = SessionEngine.defaultSetSize
    /// Skill drills at the end of a set. nil means: on only if Numbers & Logic is one of the chosen topics.
    var drills: Bool? = nil
    /// How often the extras (mental math, estimation, games) join a set: every Nth set. nil means every 3rd.
    var extrasEvery: Int? = nil
    var reminderEnabled = false
    /// Local time of the daily reminder.
    var reminderHour = 20
    var reminderMinute = 0
}

struct SessionRecord: Codable, Hashable {
    var startedAt: Date
    var cardsDone: Int
    /// "free" for the in-app feed; "guarded" for sessions started from the shield (later).
    var source: String
}

struct AppData: Codable, Hashable {
    var settings = UserSettings()
    var events: [AppEvent] = []
    var sessions: [SessionRecord] = []
    var reviews: [ReviewRow] = []
    var skills: [SkillProgress] = []
    var streak = StreakState()
}

/// Loads and saves `AppData` as one JSON file. Every failure is swallowed so the app still works with empty storage.
final class DataStore {
    private let url: URL

    init(url: URL = DataStore.defaultURL()) {
        self.url = url
    }

    static func defaultURL() -> URL {
        let base = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("detour-data.json")
    }

    func load() -> AppData {
        guard let data = try? Data(contentsOf: url) else { return AppData() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return (try? decoder.decode(AppData.self, from: data)) ?? AppData()
    }

    @discardableResult
    func save(_ data: AppData) -> Bool {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        guard let bytes = try? encoder.encode(data) else { return false }
        do {
            try bytes.write(to: url, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    func erase() {
        try? FileManager.default.removeItem(at: url)
    }
}
