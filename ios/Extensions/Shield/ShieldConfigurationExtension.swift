import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen shown over a guarded app: "Quick one?" with a Start button.
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration { make() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { make() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { make() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { make() }

    private func make() -> ShieldConfiguration {
        let store = GuardStore.shared
        let settings = store.settings
        let teal = UIColor(red: 0.06, green: 0.46, blue: 0.43, alpha: 1)
        let secondary: String
        switch settings.mode {
        case .gentle: secondary = "Continue"
        case .earnIt: secondary = store.skipsLeft() > 0 ? "Skip this time (\(store.skipsLeft()) left today)" : "Not today"
        case .strict: secondary = "Open anyway"
        }
        let subtitle: String
        switch settings.mode {
        case .gentle: subtitle = "A few small cards first? Or carry on, no pressure."
        case .earnIt: subtitle = "A few small cards, then this is yours for \(settings.unlockMinutes) min" + (settings.unlockMinutes < 15 ? " of use." : ".")
        case .strict: subtitle = "A last check. Take a quick detour, or open it for real (\(settings.strictUseMinutes) min)."
        }
        let title = settings.mode == .strict ? "Last check" : "Quick one?"
        let primary = settings.mode == .strict ? "Take a detour" : "Do a quick one"
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor.black.withAlphaComponent(0.55),
            icon: nil,
            title: ShieldConfiguration.Label(text: title, color: .white),
            subtitle: ShieldConfiguration.Label(text: subtitle, color: UIColor.white.withAlphaComponent(0.8)),
            primaryButtonLabel: ShieldConfiguration.Label(text: primary, color: .white),
            primaryButtonBackgroundColor: teal,
            secondaryButtonLabel: ShieldConfiguration.Label(text: secondary, color: UIColor.white.withAlphaComponent(0.8))
        )
    }
}
