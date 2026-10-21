import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen shown over a guarded app: "Quick one?" with a Start button.
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        remember(application)
        return make()
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        remember(application)
        return make()
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        GuardStore.shared.recordShielded(bundle: nil, name: nil)
        return make()
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        GuardStore.shared.recordShielded(bundle: nil, name: nil)
        return make()
    }

    /// Notes which app is being covered, so the end screen can offer to take the user back to it. Stays on the device.
    private func remember(_ application: Application) {
        let store = GuardStore.shared
        let bundle = application.bundleIdentifier
        let name = application.localizedDisplayName
        if bundle != store.shieldedBundle || name != store.shieldedName {
            store.log("shield screen: app = " + (bundle ?? "unknown") + " (" + (name ?? "no name") + ")")
        }
        // Keep an earlier answer if this time iOS did not say.
        if bundle != nil || name != nil { store.recordShielded(bundle: bundle, name: name) }
    }

    private func make() -> ShieldConfiguration {
        let store = GuardStore.shared
        let settings = store.settings
        let teal = UIColor(red: 0.06, green: 0.46, blue: 0.43, alpha: 1)
        let secondary: String
        switch settings.mode {
        case .gentle: secondary = "Continue"
        case .earnIt: secondary = store.skipsLeft() > 0 ? "Skip this time (\(store.skipsLeft()) left today)" : "Not today"
        case .strict: secondary = "Open anyway"
        case .hardLock: secondary = store.skipsLeft() > 0 ? "Skip this time (\(store.skipsLeft()) left today)" : "Not today"
        }
        let subtitle: String
        switch settings.mode {
        case .gentle: subtitle = "A few small cards first? Or carry on, no pressure."
        case .earnIt: subtitle = "A few small cards, then this is yours for \(settings.unlockMinutes) min" + (settings.unlockMinutes < 15 ? " of use." : ".")
        case .strict: subtitle = "A last check. Take a quick detour, or open it for real (\(settings.strictUseMinutes) min)."
        case .hardLock: subtitle = "A few small cards, then this is yours. Your allowance today is \(settings.dailyAllowance) min."
        }
        let lockedToday = store.isHardLocked()
        var title = settings.mode == .strict ? "Last check" : "Quick one?"
        var primary = settings.mode == .strict ? "Take a detour" : "Do a quick one"
        var subtitleText = subtitle
        var secondaryText: String? = secondary
        if lockedToday {
            // The allowance is used up: the apps stay shielded until tomorrow. A detour is still on offer, just no way through.
            title = "Done for today"
            primary = "Learn something instead"
            subtitleText = "You've used your \(settings.dailyAllowance) minutes today. See you tomorrow."
            secondaryText = nil
        }
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor.black.withAlphaComponent(0.55),
            icon: nil,
            title: ShieldConfiguration.Label(text: title, color: .white),
            subtitle: ShieldConfiguration.Label(text: subtitleText, color: UIColor.white.withAlphaComponent(0.8)),
            primaryButtonLabel: ShieldConfiguration.Label(text: primary, color: .white),
            primaryButtonBackgroundColor: teal,
            secondaryButtonLabel: secondaryText.map { ShieldConfiguration.Label(text: $0, color: UIColor.white.withAlphaComponent(0.8)) }
        )
    }
}
