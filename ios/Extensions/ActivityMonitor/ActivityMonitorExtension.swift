import DeviceActivity

/// Puts the shield back when an unlock window ends.
final class ActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        let store = GuardStore.shared
        store.log("unlock ended")
        if store.settings.enabled { GuardShield.apply(store) }
    }
}
