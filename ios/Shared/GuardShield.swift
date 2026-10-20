import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import UserNotifications

/// Puts the shield on the chosen apps and takes it off again. Used by the app and by the extensions.
enum GuardShield {
    private static let unlockActivity = DeviceActivityName("detour.unlock")

    static func selection(from store: GuardStore) -> FamilyActivitySelection? {
        guard let data = store.selectionData else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func encode(_ selection: FamilyActivitySelection) -> Data? {
        try? JSONEncoder().encode(selection)
    }

    /// Shields everything the user chose. Does nothing if no apps are chosen.
    static func apply(_ store: GuardStore = .shared) {
        guard let selection = selection(from: store) else { return }
        let managed = ManagedSettingsStore()
        if selection.applicationTokens.isEmpty { managed.shield.applications = nil } else { managed.shield.applications = selection.applicationTokens }
        if selection.categoryTokens.isEmpty {
            managed.shield.applicationCategories = nil
        } else {
            managed.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        }
        if selection.webDomainTokens.isEmpty { managed.shield.webDomains = nil } else { managed.shield.webDomains = selection.webDomainTokens }
        store.unlockUntil = nil
        store.log("shield on")
    }

    /// Removes the shield for good (guard turned off).
    static func removeAll(_ store: GuardStore = .shared) {
        ManagedSettingsStore().clearAllSettings()
        DeviceActivityCenter().stopMonitoring([unlockActivity])
        store.unlockUntil = nil
        store.log("shield off")
    }

    /// Lifts the shield for a while, then asks the monitor extension to put it back.
    static func unlock(minutes: Int, store: GuardStore = .shared, now: Date = Date()) {
        // The system only allows schedules of 15 minutes or more.
        let length = max(minutes, 15)
        let managed = ManagedSettingsStore()
        managed.shield.applications = nil
        managed.shield.applicationCategories = nil
        managed.shield.webDomains = nil
        let until = now.addingTimeInterval(TimeInterval(length * 60))
        store.unlockUntil = until

        let parts: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let calendar = Calendar.current
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents(parts, from: now),
            intervalEnd: calendar.dateComponents(parts, from: until),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([unlockActivity])
        do {
            try center.startMonitoring(unlockActivity, during: schedule)
            store.log("unlocked for \(length) min")
        } catch {
            // Without the timer the app re-shields itself the next time it opens, so say so in the log.
            store.log("could not start the unlock timer: \(error.localizedDescription)")
        }
    }

    /// Tells the user (with a local notification) to open Detour. Used by the shield's "Start" button.
    static func notifyToStart() {
        let content = UNMutableNotificationContent()
        content.title = "Quick one?"
        content.body = "Tap to open Detour. A few small cards, then your app is yours."
        content.sound = .default
        let request = UNNotificationRequest(identifier: "detour.guard.start", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        UNUserNotificationCenter.current().add(request)
    }
}
