import FamilyControls
import Foundation
import ManagedSettings
import Observation
import UserNotifications

/// The app side of "guarded apps": asks Apple for permission, remembers the apps chosen with Apple's picker, and
/// puts the shield on or takes it off. The shield screen and its buttons live in the three extensions.
@MainActor
@Observable
final class GuardManager {
    var selection = FamilyActivitySelection()
    private(set) var returnMap: [String: String] = [:]
    private(set) var settings: GuardSettings
    private(set) var authorized: Bool
    private(set) var lastError: String?
    @ObservationIgnored private let store: GuardStore

    init(store: GuardStore = .shared) {
        self.store = store
        self.settings = store.settings
        self.authorized = AuthorizationCenter.shared.authorizationStatus == .approved
        if let saved = GuardShield.selection(from: store) { self.selection = saved }
        self.logLines = store.logLines
        self.returnMap = store.returnMap
    }

    var hasSelection: Bool {
        !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty
    }

    /// The shared debug log. Kept as a stored property so the screen updates when it is cleared or reloaded.
    private(set) var logLines: [String] = []

    // MARK: Turning it on and off

    /// Asks for Screen Time permission (and notifications, which the shield's Start button needs), then shields the chosen apps.
    func enable() async {
        lastError = nil
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            authorized = AuthorizationCenter.shared.authorizationStatus == .approved
        } catch {
            authorized = false
            lastError = "Detour wasn't given Screen Time access. You can try again any time."
            store.log("authorization failed: \(error.localizedDescription)")
            return
        }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        change { $0.enabled = true }
        saveSelection()
        GuardShield.apply(store, reason: "guard turned on")
        GuardShield.syncMonitors(store)
    }

    func disable() {
        change { $0.enabled = false }
        GuardShield.removeAll(store)
    }

    func update(_ edit: (inout GuardSettings) -> Void) {
        let before = settings
        change(edit)
        store.log("guard settings: mode=\(settings.mode.rawValue) unlockMinutes=\(settings.unlockMinutes) (was \(before.mode.rawValue), \(before.unlockMinutes))")
        GuardShield.syncMonitors(store)
        if settings.enabled && !store.isWithinActiveHours() && GuardShield.isShieldOn() {
            GuardShield.removeShield(store, reason: "active hours now exclude this time")
        }
        // Make sure the shield matches the settings right away (it only goes on if no unlock window is running).
        if settings.enabled && hasSelection && !store.isUnlocked() && !GuardShield.isShieldOn() {
            GuardShield.apply(store, reason: "settings changed and the shield was off")
        }
        reloadLog()
    }

    /// Call when the picker closes.
    func saveSelection() {
        store.selectionData = GuardShield.encode(selection)
        identifyApps()
        GuardShield.syncMonitors(store)
        if settings.enabled && !store.isUnlocked() { GuardShield.apply(store, reason: "apps changed") }
    }

    // MARK: Which guarded app is which

    /// Works out which app each guarded token is, from whatever iOS tells us (its bundle or name), and remembers it.
    /// Apps it cannot tell stay unnamed until the shield sees them or the user says. Logs what iOS said, for debugging.
    /// Bump when the guard code changes, so a pasted log shows which version of it was running.
    private static let codeTag = "name-reading-v3"
    @ObservationIgnored private static var loggedBuild = false

    private func logBuildOnce() {
        guard !Self.loggedBuild else { return }
        Self.loggedBuild = true
        let info = Bundle.main.infoDictionary
        let version = (info?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (info?["CFBundleVersion"] as? String) ?? "?"
        store.log("app: launched, version " + version + " build " + build + ", guard code " + Self.codeTag)
    }

    func identifyApps() {
        for token in selection.applicationTokens {
            let key = GuardShield.tokenKey(for: token)
            let app = Application(token: token)
            let before = key.flatMap { store.returnMap[$0] }
            let found = store.identify(tokenKey: key, bundle: app.bundleIdentifier, name: app.localizedDisplayName)
            if before == nil {
                store.log("identify: token=" + GuardShield.shortKey(key) + " bundle=" + (app.bundleIdentifier ?? "nil") + " name=" + (app.localizedDisplayName ?? "nil") + " -> " + (found ?? "unknown"))
            }
        }
        returnMap = store.returnMap
        let named = selection.applicationTokens.filter { token in GuardShield.tokenKey(for: token).flatMap { store.returnMap[$0] } != nil }.count
        store.log("identify: " + String(selection.applicationTokens.count) + " guarded apps, " + String(named) + " named")
    }

    /// The bundle identifier the user said this guarded app is, or "" if not set.
    func returnBundle(for token: ApplicationToken) -> String {
        guard let key = GuardShield.tokenKey(for: token) else { return "" }
        return returnMap[key] ?? ""
    }

    /// Tokens already tried this launch, so reading is not repeated every time the list appears.
    @ObservationIgnored private var triedReading: Set<String> = []

    /// For guarded apps still unnamed, reads the name off a picture of iOS's own label and remembers the match.
    func identifyByReading() async {
        for token in selection.applicationTokens {
            guard let key = GuardShield.tokenKey(for: token), store.returnMap[key] == nil, !triedReading.contains(key) else { continue }
            triedReading.insert(key)
            store.log("read name: starting for token " + GuardShield.shortKey(key))
            let result = await AppNameReader.read(token)
            let lines = result.lines
            let found = ReturnApps.match(lines: lines)
            store.log("read name: token=" + GuardShield.shortKey(key) + " " + result.note + " ink=" + String(result.inkPixels) + " text=" + (lines.isEmpty ? "nothing" : lines.joined(separator: " | ")) + " -> " + (found ?? "unknown"))
            if let found {
                var map = store.returnMap
                map[key] = found
                store.returnMap = map
                returnMap = map
            }
        }
        reloadLog()
    }

    func setReturnBundle(_ bundle: String, for token: ApplicationToken) {
        guard let key = GuardShield.tokenKey(for: token) else { return }
        var map = returnMap
        if bundle.isEmpty { map.removeValue(forKey: key) } else { map[key] = bundle }
        returnMap = map
        store.returnMap = map
        store.log("guarded app " + GuardShield.shortKey(key) + " set to " + (bundle.isEmpty ? "nothing" : bundle))
    }

    // MARK: Sessions

    /// The app the shield was covering when the detour was chosen, if iOS told the shield screen and it can be reopened.
    var returnApp: ReturnApp? {
        // What the shield screen learned wins; otherwise the app chosen once in Settings.
        var bundle = store.shieldedBundle
        var name = store.shieldedName
        var source = "shield"
        if ReturnApps.url(for: bundle ?? "") == nil, let chosen = settings.returnBundle {
            bundle = chosen
            name = ReturnApps.displayName(for: chosen)
            source = "settings"
        }
        let app = ReturnApps.returnApp(bundleIdentifier: bundle, name: name)
        store.log("return app: source=\(source) bundle=\(bundle ?? "none") name=\(name ?? "none") canOpen=\(app != nil)")
        return app
    }

    /// True once if the shield's Start button asked for a session.
    func consumePendingSession() -> Bool { store.consumePendingSession() }

    /// A set was finished: open the apps for a while. Returns the minutes unlocked, or nil if the guard is off.
    @discardableResult
    func unlockAfterSet() -> Int? {
        guard settings.enabled, hasSelection else { return nil }
        if store.isHardLocked() {
            store.log("guarded set finished, but today's allowance is used up: no unlock")
            return nil
        }
        let window = settings.unlockWindow
        store.log("guarded set finished: unlocking for \(settings.unlockMinutes) min" + (window.usage == nil ? "" : " of use"))
        GuardShield.unlock(minutes: window.minutes, usageSeconds: window.usage.map { $0 * 60 }, store: store)
        return settings.unlockMinutes
    }

    /// Belt and braces: if the timer never fired, the shield goes back the next time Detour is opened.
    func refresh() {
        defer { reloadLog() }
        logBuildOnce()
        returnMap = store.returnMap
        identifyApps()
        settings = store.settings
        guard settings.enabled, hasSelection else { return }
        if !store.isWithinActiveHours() {
            if GuardShield.isShieldOn() { GuardShield.removeShield(store, reason: "opened outside active hours") }
            return
        }
        if store.isUnlocked() {
            store.log("opened: unlocked until " + ISO8601DateFormatter().string(from: store.unlockUntil ?? Date()))
            return
        }
        if GuardShield.isShieldOn() {
            store.log("opened: shield already on")
            return
        }
        GuardShield.apply(store, reason: "opened with the shield off and no unlock running")
    }

    func clearLog() {
        store.clearLog()
        logLines = []
    }

    /// Re-reads the log (the extensions write to it while the app is not running).
    func reloadLog() { logLines = store.logLines }

    private func change(_ edit: (inout GuardSettings) -> Void) {
        var next = settings
        edit(&next)
        settings = next
        store.settings = next
    }
}
