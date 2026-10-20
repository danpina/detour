import DeviceActivity

/// Puts the shield back when an unlock window ends.
final class ActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        GuardStore.shared.log("monitor: unlock window started")
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
