import Foundation

/// What the Home Screen widget shows. The app writes it into the App Group whenever progress changes; the widget only reads it.
/// It holds counts and day numbers, nothing about which apps are guarded or what was learned.
struct WidgetSnapshot: Codable, Equatable {
    /// The streak the app would show on each of the next days if nothing more is done, keyed by local day ("2026-10-28").
    /// The widget cannot run the freeze rules itself, so the app works the next days out ahead of time.
    var streakByDay: [String: Int]
    /// The local day of the last finished round, or "" if there was none yet.
    var lastActiveDay: String
    /// Recall checks due when the snapshot was written.
    var dueCount: Int
    /// The round length from Settings.
    var roundSize: Int

    static let appGroup = "group.com.danpina.detour"
    static let key = "widget.snapshot"
    /// How many days ahead the streak is worked out.
    static let daysAhead = 15

    /// A local day as "2026-10-28". The same format the app uses for its streak days.
    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// The streak to show on `date`. Past the days worked out, a streak could not have survived.
    func streak(on date: Date, calendar: Calendar = .current) -> Int {
        streakByDay[Self.dayKey(date, calendar: calendar)] ?? 0
    }

    /// Whether a round was finished on `date`.
    func doneToday(_ date: Date, calendar: Calendar = .current) -> Bool {
        lastActiveDay == Self.dayKey(date, calendar: calendar)
    }

    private static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

    static func read() -> WidgetSnapshot? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    func write() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        Self.defaults.set(data, forKey: Self.key)
    }
}
