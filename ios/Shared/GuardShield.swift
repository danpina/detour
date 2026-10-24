import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import UserNotifications

/// Puts the shield on the chosen apps and takes it off again. Used by the app and by the extensions.
enum GuardShield {
    /// The monitors the app starts. The monitor extension tells them apart by these names.
    static let unlockActivity = DeviceActivityName("detour.unlock")
    static let hoursActivity = DeviceActivityName("detour.hours")
    static let allowanceActivity = DeviceActivityName("detour.allowance")
    private static let usageEvent = DeviceActivityEvent.Name("detour.usage")
    private static let allowanceEvent = DeviceActivityEvent.Name("detour.allowanceUsed")

    static func selection(from store: GuardStore) -> FamilyActivitySelection? {
        guard let data = store.selectionData else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    /// A stable text key for an app token, so it can be stored and compared.
    static func tokenKey(for token: ApplicationToken) -> String? {
        (try? JSONEncoder().encode(token))?.base64EncodedString()
    }

    /// The first characters of a key, for the debug log (the full key is long and meaningless).
    static func shortKey(_ key: String?) -> String {
        guard let key else { return "none" }
        return String(key.suffix(8))
    }

    static func encode(_ selection: FamilyActivitySelection) -> Data? {
        try? JSONEncoder().encode(selection)
    }

    /// Shields everything the user chose. Does nothing if no apps are chosen.
    static func apply(_ store: GuardStore = .shared, reason: String = "") {
        guard let selection = selection(from: store) else { return }
        // Outside the chosen active hours the guard is off.
        guard store.isWithinActiveHours() else {
            removeShield(store, reason: "outside active hours (" + reason + ")")
            return
        }
        let managed = ManagedSettingsStore()
        if selection.applicationTokens.isEmpty { managed.shield.applications = nil } else { managed.shield.applications = selection.applicationTokens }
        if selection.categoryTokens.isEmpty {
            managed.shield.applicationCategories = nil
        } else {
            managed.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        }
        if selection.webDomainTokens.isEmpty { managed.shield.webDomains = nil } else { managed.shield.webDomains = selection.webDomainTokens }
        store.unlockUntil = nil
        store.log(reason.isEmpty ? "shield on" : "shield on (" + reason + ")")
    }

    /// Whether the shield is currently on for any chosen app, category or site.
    static func isShieldOn() -> Bool {
        let shield = ManagedSettingsStore().shield
        return shield.applications != nil || shield.applicationCategories != nil || shield.webDomains != nil
    }

    /// Takes the shield off without turning the guard off (for example outside active hours).
    static func removeShield(_ store: GuardStore = .shared, reason: String) {
        ManagedSettingsStore().clearAllSettings()
        store.unlockUntil = nil
        store.log("shield off (" + reason + ")")
    }

    /// Removes the shield and every monitor (guard turned off).
    static func removeAll(_ store: GuardStore = .shared) {
        ManagedSettingsStore().clearAllSettings()
        DeviceActivityCenter().stopMonitoring([unlockActivity, hoursActivity, allowanceActivity])
        store.unlockUntil = nil
        store.clearHardLock()
        store.hoursSignature = nil
        store.allowanceSignature = nil
        store.log("shield off")
    }

    /// A small stable hash (Swift's own hashing changes between launches), used to notice when the chosen apps changed.
    private static func stableHash(_ data: Data?) -> String {
        guard let data else { return "none" }
        var h: UInt64 = 1469598103934665603
        for byte in data { h = (h ^ UInt64(byte)) &* 1099511628211 }
        return String(h)
    }

    /// Starts or stops the daily monitors to match the settings: the active hours, and the daily allowance in hard-lock mode.
    /// A monitor is only restarted when its settings changed. Restarting would reset the day's usage count, which would let
    /// the allowance be reset by opening Settings.
    static func syncMonitors(_ store: GuardStore = .shared) {
        let settings = store.settings
        let center = DeviceActivityCenter()
        guard settings.enabled else {
            center.stopMonitoring([hoursActivity, allowanceActivity])
            store.hoursSignature = nil
            store.allowanceSignature = nil
            return
        }

        // Active hours
        var hoursSignature: String?
        if let hours = settings.activeHours, hours.startHour * 60 + hours.startMinute != hours.endHour * 60 + hours.endMinute {
            hoursSignature = String(hours.startHour) + ":" + String(hours.startMinute) + "-" + String(hours.endHour) + ":" + String(hours.endMinute)
        }
        if hoursSignature != store.hoursSignature {
            center.stopMonitoring([hoursActivity])
            if let hours = settings.activeHours, hoursSignature != nil {
                let schedule = DeviceActivitySchedule(
                    intervalStart: DateComponents(hour: hours.startHour, minute: hours.startMinute),
                    intervalEnd: DateComponents(hour: hours.endHour, minute: hours.endMinute),
                    repeats: true
                )
                do {
                    try center.startMonitoring(hoursActivity, during: schedule)
                    store.log("active hours monitor started: " + (hoursSignature ?? ""))
                } catch {
                    store.log("could not start the active hours monitor: " + error.localizedDescription)
                    hoursSignature = nil
                }
            } else {
                store.log("active hours monitor stopped")
            }
            store.hoursSignature = hoursSignature
        }

        // Daily allowance (hard lock)
        var allowanceSignature: String?
        if settings.mode == .hardLock {
            allowanceSignature = String(settings.dailyAllowance) + "|" + stableHash(store.selectionData)
        }
        if allowanceSignature != store.allowanceSignature {
            center.stopMonitoring([allowanceActivity])
            if allowanceSignature != nil, let chosen = selection(from: store) {
                let allowance = settings.dailyAllowance
                let schedule = DeviceActivitySchedule(
                    intervalStart: DateComponents(hour: 0, minute: 0),
                    intervalEnd: DateComponents(hour: 23, minute: 59),
                    repeats: true
                )
                let event = DeviceActivityEvent(
                    applications: chosen.applicationTokens,
                    categories: chosen.categoryTokens,
                    webDomains: chosen.webDomainTokens,
                    threshold: DateComponents(hour: allowance / 60, minute: allowance % 60)
                )
                do {
                    try center.startMonitoring(allowanceActivity, during: schedule, events: [allowanceEvent: event])
                    store.log("daily allowance monitor started: " + String(allowance) + " min")
                } catch {
                    store.log("could not start the daily allowance monitor: " + error.localizedDescription)
                    allowanceSignature = nil
                }
            } else {
                store.log("daily allowance monitor stopped")
                allowanceSignature = nil
            }
            store.allowanceSignature = allowanceSignature
        }
    }

    /// How a usage threshold is written: whole minutes, plus any seconds.
    static func threshold(seconds: Int) -> DateComponents {
        DateComponents(minute: seconds / 60, second: seconds % 60)
    }

    /// Lifts the shield for a while, then asks the monitor extension to put it back.
    /// With `usageSeconds` the shield also comes back once the chosen apps have been used for that long, whichever happens first.
    /// iOS may refuse a threshold under a minute. The unlock then retries with one minute and says so in the log.
    static func unlock(minutes: Int, usageSeconds: Int? = nil, store: GuardStore = .shared, now: Date = Date()) {
        // Hard lock: once today's allowance is used, nothing unlocks until tomorrow.
        if store.isHardLocked(now: now) {
            store.log("unlock refused: today's allowance is used up")
            return
        }
        // The system only allows schedules of 15 minutes or more.
        let length = max(minutes, 15)
        let managed = ManagedSettingsStore()
        managed.shield.applications = nil
        managed.shield.applicationCategories = nil
        managed.shield.webDomains = nil
        let until = now.addingTimeInterval(TimeInterval(length * 60))
        store.unlockUntil = until
        store.log("unlock requested for " + String(length) + " min")

        let parts: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let calendar = Calendar.current
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents(parts, from: now),
            intervalEnd: calendar.dateComponents(parts, from: until),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([unlockActivity])

        var seconds = usageSeconds
        var attempts = 0
        while attempts < 2 {
            attempts += 1
            var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
            if let seconds, let chosen = selection(from: store) {
                events[usageEvent] = DeviceActivityEvent(
                    applications: chosen.applicationTokens,
                    categories: chosen.categoryTokens,
                    webDomains: chosen.webDomainTokens,
                    threshold: threshold(seconds: seconds)
                )
            }
            do {
                try center.startMonitoring(unlockActivity, during: schedule, events: events)
                let usageNote = seconds.map { ", or " + usageLabel($0) + " of use" } ?? ""
                store.log("unlocked for " + String(length) + " min" + usageNote)
                return
            } catch {
                if let tried = seconds, tried < 60 {
                    store.log("iOS refused a " + usageLabel(tried) + " threshold (" + error.localizedDescription + "), retrying with 1 min")
                    seconds = 60
                    continue
                }
                // Without the timer the app re-shields itself the next time it opens, so say so in the log.
                store.log("could not start the unlock timer: " + error.localizedDescription)
                return
            }
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
