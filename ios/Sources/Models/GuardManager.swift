import FamilyControls
import Foundation
import Observation
import UserNotifications

/// The app side of "guarded apps": asks Apple for permission, remembers the apps chosen with Apple's picker, and
/// puts the shield on or takes it off. The shield screen and its buttons live in the three extensions.
@MainActor
@Observable
final class GuardManager {
    var selection = FamilyActivitySelection()
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
        GuardShield.syncMonitors(store)
        if settings.enabled && !store.isUnlocked() { GuardShield.apply(store, reason: "apps changed") }
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
        reloadLog()
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
