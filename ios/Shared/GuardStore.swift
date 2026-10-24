import Foundation

/// How a guarded app behaves when opened.
enum GuardMode: String, Codable, CaseIterable {
    /// Like "earn it", plus a daily allowance of use. When it is used up, the guarded apps stay shielded for the rest of the day.
    case hardLock
    /// "Continue" is always available on the shield.
    case gentle
    /// A finished set unlocks the apps for a while. One emergency skip a day.
    case earnIt
    /// A last check every time: take a detour, or open the app anyway. "Open anyway" only lasts a few minutes of use.
    case strict
}

struct GuardSettings: Codable, Equatable {
    var enabled = false
    var mode: GuardMode = .earnIt
    var unlockMinutes = 15
    var dailySkips = 1
    /// Minutes of use that "Open anyway" allows in strict mode. Optional so settings saved before strict mode existed still load.
    var strictMinutes: Int? = nil
    /// How long "Open anyway" lasts, in seconds of use. nil falls back to the older minutes setting, then to 3 minutes.
    var strictSeconds: Int? = nil
    /// The app to offer "Go back to" when the shield cannot tell which app it covered. Chosen once in Settings.
    var returnBundle: String? = nil
    /// Guard only during these hours. nil means all day. Optional so older saved settings still load.
    var activeHours: ActiveHours? = nil
    /// Minutes of use per day in hard-lock mode. Optional so older saved settings still load.
    var allowanceMinutes: Int? = nil

    var strictUseSeconds: Int { strictSeconds ?? (strictMinutes ?? 3) * 60 }
    var dailyAllowance: Int { allowanceMinutes ?? 30 }

    /// The system will not schedule a wall-clock window shorter than 15 minutes. A shorter unlock is therefore measured in
    /// minutes of actual use: the window stays open for 15 minutes at most, and ends sooner once the apps were used that long.
    var unlockWindow: (minutes: Int, usage: Int?) {
        unlockMinutes < 15 ? (15, unlockMinutes) : (unlockMinutes, nil)
    }
}

/// A short label for an amount of use: "15 s" or "3 min".
func usageLabel(_ seconds: Int) -> String {
    seconds < 60 ? String(seconds) + " s" : String(seconds / 60) + " min"
}

/// A daily window in which the guard is on, for example 09:00 to 22:00. The end may be earlier than the start (overnight).
struct ActiveHours: Codable, Equatable {
    var startHour = 9
    var startMinute = 0
    var endHour = 22
    var endMinute = 0

    /// Whether `date` falls inside the window. Start and end being equal means all day.
    func contains(_ date: Date, calendar: Calendar = .current) -> Bool {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let now = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        let start = startHour * 60 + startMinute
        let end = endHour * 60 + endMinute
        if start == end { return true }
        if start < end { return now >= start && now < end }
        return now >= start || now < end
    }
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
        static let lockedDay = "guard.lockedDay"
        static let returnMap = "guard.returnMap"
        static let shieldedToken = "guard.shieldedToken"
        static let shieldLogStamp = "guard.shieldLogStamp"
        static let hoursSignature = "guard.hoursSignature"
        static let allowanceSignature = "guard.allowanceSignature"
        static let shieldedBundle = "guard.shieldedBundle"
        static let shieldedName = "guard.shieldedName"
    }

    // MARK: The app the shield was covering (so the end screen can take the user back to it)

    var shieldedBundle: String? {
        get { defaults.string(forKey: Key.shieldedBundle) }
        set { defaults.set(newValue, forKey: Key.shieldedBundle) }
    }

    var shieldedName: String? {
        get { defaults.string(forKey: Key.shieldedName) }
        set { defaults.set(newValue, forKey: Key.shieldedName) }
    }

    /// Remembers the app the shield is covering right now. Pass nil when it cannot be told (a category or a website).
    func recordShielded(bundle: String?, name: String?) {
        shieldedBundle = bundle
        shieldedName = name
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

    /// True when an "unlock ended" signal really means the window is over. Starting a new unlock stops the old timer, which
    /// also fires "ended" for the old one; in that case `unlockUntil` already points to the future and the signal is stale.
    func windowReallyEnded(now: Date = Date(), slack: TimeInterval = 60) -> Bool {
        guard let until = unlockUntil else { return true }
        return until <= now.addingTimeInterval(slack)
    }

    // MARK: Which guarded app is which (so the end screen can take the user back to it)

    /// iOS never tells the shield which app it is covering, but each guarded app has a stable anonymous token. The user says
    /// once, in Settings, what each token is; this maps the token (as text) to a bundle identifier. It stays on the device.
    var returnMap: [String: String] {
        get {
            guard let data = defaults.data(forKey: Key.returnMap), let map = try? JSONDecoder().decode([String: String].self, from: data) else { return [:] }
            return map
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) { defaults.set(data, forKey: Key.returnMap) }
        }
    }

    /// Which app a token is: what the user set, else what iOS told us (its bundle or its name), which is then remembered.
    /// So the user rarely has to say; they only do for apps iOS keeps anonymous. Returns the bundle identifier, or nil.
    @discardableResult
    func identify(tokenKey key: String?, bundle: String?, name: String?) -> String? {
        guard let key else { return ReturnApps.resolve(bundle: bundle, name: name) }
        var map = returnMap
        if let known = map[key] { return known }
        guard let found = ReturnApps.resolve(bundle: bundle, name: name) else { return nil }
        map[key] = found
        returnMap = map
        return found
    }

    /// The token (as text) of the app the shield was last shown for, if the shield told us.
    var shieldedTokenKey: String? {
        get { defaults.string(forKey: Key.shieldedToken) }
        set { defaults.set(newValue, forKey: Key.shieldedToken) }
    }

    /// Used to log what the shield screen was told at most once every few seconds.
    var shieldLogStamp: Date? {
        get { defaults.object(forKey: Key.shieldLogStamp) as? Date }
        set { defaults.set(newValue, forKey: Key.shieldLogStamp) }
    }

    // MARK: Which daily monitors are running (so they are only restarted when their settings change)

    var hoursSignature: String? {
        get { defaults.string(forKey: Key.hoursSignature) }
        set { defaults.set(newValue, forKey: Key.hoursSignature) }
    }

    var allowanceSignature: String? {
        get { defaults.string(forKey: Key.allowanceSignature) }
        set { defaults.set(newValue, forKey: Key.allowanceSignature) }
    }

    // MARK: Active hours

    func isWithinActiveHours(now: Date = Date()) -> Bool {
        guard let hours = settings.activeHours else { return true }
        return hours.contains(now, calendar: calendar)
    }

    // MARK: Hard lock (daily allowance)

    /// True once today's allowance has been used up. It ends by itself at midnight, because it is tied to the day.
    func isHardLocked(now: Date = Date()) -> Bool {
        defaults.string(forKey: Key.lockedDay) == dayKey(now)
    }

    func markHardLocked(now: Date = Date()) {
        defaults.set(dayKey(now), forKey: Key.lockedDay)
    }

    func clearHardLock() {
        defaults.removeObject(forKey: Key.lockedDay)
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
        if lines.count > 400 { lines.removeFirst(lines.count - 400) }
        defaults.set(lines, forKey: Key.log)
    }

    func clearLog() { defaults.removeObject(forKey: Key.log) }
}
