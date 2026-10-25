import DeviceActivity

/// Puts the shield back when an unlock window ends.
final class ActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        let store = GuardStore.shared
        if activity == GuardShield.hoursActivity {
            store.log("monitor: active hours started")
            if store.settings.enabled { GuardShield.apply(store, reason: "active hours started") }
        } else if activity == GuardShield.allowanceActivity {
            store.log("monitor: new day, daily allowance counter started")
        } else {
            store.log("monitor: unlock window started")
        }
    }

    /// Strict mode: the apps were used for the allowed number of minutes, so the shield goes back.
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        let store = GuardStore.shared
        if activity == GuardShield.allowanceActivity {
            // Hard lock: the day's allowance is used up. The apps stay shielded until midnight.
            store.markHardLocked()
            store.log("monitor: daily allowance used up, shield stays on for the rest of the day")
            if store.settings.enabled { GuardShield.apply(store, reason: "daily allowance used") }
            return
        }
        if store.usageSignalIsTooEarly() {
            // The apps can't have been used for longer than the window has been open, so this signal is spurious.
            store.log("monitor: ignored an early usage signal (limit " + usageLabel(store.usageSeconds) + ", window just opened)")
            return
        }
        store.log("monitor: usage limit reached (" + event.rawValue + ")")
        if store.settings.enabled { GuardShield.apply(store, reason: "usage limit reached") }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let store = GuardStore.shared
        if activity == GuardShield.hoursActivity {
            store.log("monitor: active hours ended")
            GuardShield.removeShield(store, reason: "active hours ended")
            return
        }
        if activity == GuardShield.allowanceActivity {
            store.log("monitor: day ended")
            return
        }
        // Replacing a running timer also reports "ended" for the old one. Ignore that, or the shield would come straight back.
        guard store.windowReallyEnded() else {
            store.log("monitor: ignored a stale 'ended' (a newer unlock is running)")
            return
        }
        store.log("monitor: unlock window ended")
        if store.settings.enabled { GuardShield.apply(store, reason: "window ended") }
    }
}
