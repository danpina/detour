import ManagedSettings

/// What the shield's two buttons do.
/// - Start: ask the app to open a short session (through a notification) and close the guarded app.
/// - Secondary: Continue (gentle) or the one emergency skip of the day (earn it). Lifts the shield for a while.
final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        completionHandler(respond(to: action))
    }

    private func respond(to action: ShieldAction) -> ShieldActionResponse {
        let store = GuardStore.shared
        switch action {
        case .primaryButtonPressed:
            store.pendingSession = true
            store.log("start pressed on the shield")
            GuardShield.notifyToStart()
            return .close
        case .secondaryButtonPressed:
            let settings = store.settings
            let allowed = settings.mode == .gentle || store.useSkip()
            guard allowed else {
                store.log("skip refused: none left today")
                return .close
            }
            store.log("skip used")
            GuardShield.unlock(minutes: settings.unlockMinutes, store: store)
            return .defer
        @unknown default:
            return .close
        }
    }
}
