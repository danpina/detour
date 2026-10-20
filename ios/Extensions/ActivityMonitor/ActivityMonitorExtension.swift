import DeviceActivity

/// Puts the shield back when an unlock window ends.
final class ActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        GuardStore.shared.log("monitor: unlock window started")
    }

    /// Strict mode: the apps were used for the allowed number of minutes, so the shield goes back.
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        let store = GuardStore.shared
        store.log("monitor: usage limit reached (" + event.rawValue + ")")
        if store.settings.enabled { GuardShield.apply(store, reason: "usage limit reached") }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let store = GuardStore.shared
        // Replacing a running timer also reports "ended" for the old one. Ignore that, or the shield would come straight back.
        guard store.windowReallyEnded() else {
            store.log("monitor: ignored a stale 'ended' (a newer unlock is running)")
            return
        }
        store.log("monitor: unlock window ended")
        if store.settings.enabled { GuardShield.apply(store, reason: "window ended") }
    }
}
