import ManagedSettings

/// What the shield's two buttons do.
/// - Start: ask the app to open a short session (through a notification) and close the guarded app.
/// - Secondary: Continue (gentle) or the one emergency skip of the day (earn it). Lifts the shield for a while.
final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        // Note which app this is, so the end screen can offer to take the user back to it. Stays on the device.
        let store = GuardStore.shared
        let app = Application(token: application)
        let key = GuardShield.tokenKey(for: application)
        let mapped = key.flatMap { store.returnMap[$0] }
        store.shieldedTokenKey = key
        if let mapped {
            store.recordShielded(bundle: mapped, name: ReturnApps.displayName(for: mapped))
        } else if app.bundleIdentifier != nil || app.localizedDisplayName != nil {
            store.recordShielded(bundle: app.bundleIdentifier, name: app.localizedDisplayName)
        } else {
            // Not told which app this is: forget the last one rather than take the user back to the wrong app.
            store.recordShielded(bundle: nil, name: nil)
        }
        store.log("button: token=" + GuardShield.shortKey(key) + " mapped=" + (mapped ?? "nil") + " bundle=" + (app.bundleIdentifier ?? "nil") + " name=" + (app.localizedDisplayName ?? "nil"))
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
        store.log("shield button pressed")
        switch action {
        case .primaryButtonPressed:
            store.pendingSession = true
            store.log("start pressed on the shield")
            GuardShield.notifyToStart()
            return .close
        case .secondaryButtonPressed:
            let settings = store.settings
            if store.isHardLocked() {
                store.log("secondary refused: today's allowance is used up")
                return .close
            }
            if settings.mode == .strict {
                store.log("strict: open anyway for " + usageLabel(settings.strictUseSeconds) + " of use")
                GuardShield.unlock(minutes: 15, usageSeconds: settings.strictUseSeconds, store: store)
                return .defer
            }
            let allowed = settings.mode == .gentle || store.useSkip()
            guard allowed else {
                store.log("skip refused: none left today")
                return .close
            }
            store.log(settings.mode == .gentle ? "continue pressed (nudge)" : "skip used")
            let window = settings.unlockWindow
            GuardShield.unlock(minutes: window.minutes, usageSeconds: window.usage.map { $0 * 60 }, store: store)
            return .defer
        @unknown default:
            return .close
        }
    }
}
