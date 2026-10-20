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
    }

    var hasSelection: Bool {
        !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty
    }

    var logLines: [String] { store.logLines }

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
        GuardShield.apply(store)
    }

    func disable() {
        change { $0.enabled = false }
        GuardShield.removeAll(store)
    }

    func update(_ edit: (inout GuardSettings) -> Void) {
        change(edit)
    }

    /// Call when the picker closes.
    func saveSelection() {
        store.selectionData = GuardShield.encode(selection)
        if settings.enabled && !store.isUnlocked() { GuardShield.apply(store) }
    }

    // MARK: Sessions

    /// True once if the shield's Start button asked for a session.
    func consumePendingSession() -> Bool { store.consumePendingSession() }

    /// A set was finished: open the apps for a while. Returns the minutes unlocked, or nil if the guard is off.
    @discardableResult
    func unlockAfterSet() -> Int? {
        guard settings.enabled, hasSelection else { return nil }
        GuardShield.unlock(minutes: settings.unlockMinutes, store: store)
        return max(settings.unlockMinutes, 15)
    }

    /// Belt and braces: if the timer never fired, the shield goes back the next time Detour is opened.
    func refresh() {
        settings = store.settings
        guard settings.enabled, hasSelection, !store.isUnlocked() else { return }
        GuardShield.apply(store)
    }

    func clearLog() { store.clearLog() }

    private func change(_ edit: (inout GuardSettings) -> Void) {
        var next = settings
        edit(&next)
        settings = next
        store.settings = next
    }
}
