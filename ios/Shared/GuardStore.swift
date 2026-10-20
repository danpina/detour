import Foundation

/// How a guarded app behaves when opened. Hard lock (a daily allowance) comes later.
enum GuardMode: String, Codable, CaseIterable {
    /// "Continue" is always available on the shield.
    case gentle
    /// A finished set unlocks the apps for a while. One emergency skip a day.
    case earnIt
}

struct GuardSettings: Codable, Equatable {
    var enabled = false
    var mode: GuardMode = .earnIt
    var unlockMinutes = 15
    var dailySkips = 1
}

/// Everything the app and its three Screen Time extensions share, kept in the App Group container.
/// Nothing here leaves the device. Apps are stored as Apple's anonymous tokens; Detour never learns which apps they are.
final class GuardStore {
    static let appGroup = "group.com.danpina.detour"
    /// The store every part of the app uses. Falls back to standard defaults if the App Group is unavailable.
    static let shared = GuardStore(defaults: UserDefaults(suiteName: appGroup) ?? .standard)

    private let defaults: UserDefaults
    private let calendar: Calendar

    init(defaults: UserDefaults, calendar: Calendar = .current) {
        self.defaults = defaults
        self.calendar = calendar
    }

    private enum Key {
        static let settings = "guard.settings"
        static let selection = "guard.selection"
        static let pending = "guard.pendingSession"
        static let unlockUntil = "guard.unlockUntil"
        static let skipsDay = "guard.skipsDay"
        static let skipsUsed = "guard.skipsUsed"
        static let log = "guard.log"
    }

    // MARK: Settings

    var settings: GuardSettings {
        get {
            guard let data = defaults.data(forKey: Key.settings), let value = try? JSONDecoder().decode(GuardSettings.self, from: data) else { return GuardSettings() }
            return value
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) { defaults.set(data, forKey: Key.settings) }
        }
    }

    /// The encoded `FamilyActivitySelection` chosen with Apple's picker.
    var selectionData: Data? {
        get { defaults.data(forKey: Key.selection) }
        set { defaults.set(newValue, forKey: Key.selection) }
    }

    // MARK: Session hand-off

    /// Set by the shield's "Start" button; the app starts a set the next time it opens.
    var pendingSession: Bool {
        get { defaults.bool(forKey: Key.pending) }
        set { defaults.set(newValue, forKey: Key.pending) }
    }

    /// Returns true once if a session was requested from the shield, and clears the request.
    func consumePendingSession() -> Bool {
        guard pendingSession else { return false }
        pendingSession = false
        return true
    }

    // MARK: Unlock window

    var unlockUntil: Date? {
        get { defaults.object(forKey: Key.unlockUntil) as? Date }
        set { defaults.set(newValue, forKey: Key.unlockUntil) }
    }

    func isUnlocked(now: Date = Date()) -> Bool {
        guard let until = unlockUntil else { return false }
        return until > now
    }

    // MARK: Emergency skip

    private func dayKey(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    func skipsLeft(now: Date = Date()) -> Int {
        let used = defaults.string(forKey: Key.skipsDay) == dayKey(now) ? defaults.integer(forKey: Key.skipsUsed) : 0
        return max(0, settings.dailySkips - used)
    }

    /// Uses one emergency skip if any are left today. The count resets at midnight (a new day key).
    func useSkip(now: Date = Date()) -> Bool {
        guard skipsLeft(now: now) > 0 else { return false }
        let today = dayKey(now)
        let used = defaults.string(forKey: Key.skipsDay) == today ? defaults.integer(forKey: Key.skipsUsed) : 0
        defaults.set(today, forKey: Key.skipsDay)
        defaults.set(used + 1, forKey: Key.skipsUsed)
        return true
    }

    // MARK: Debug log (the extensions write here so problems can be seen in the app)

    var logLines: [String] { defaults.stringArray(forKey: Key.log) ?? [] }

    func log(_ message: String, now: Date = Date()) {
        var lines = logLines
        let stamp = ISO8601DateFormatter().string(from: now)
        lines.append("\(stamp) \(message)")
        if lines.count > 60 { lines.removeFirst(lines.count - 60) }
        defaults.set(lines, forKey: Key.log)
    }

    func clearLog() { defaults.removeObject(forKey: Key.log) }
}
