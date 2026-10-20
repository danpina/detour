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
        case .earnIt: secondary = store.skipsLeft() > 0 ? "Skip (\(store.skipsLeft()) left today)" : "Not today"
        }
        let subtitle = settings.mode == .gentle
            ? "A few small cards first? Or carry on, no pressure."
            : "A few small cards, then this is yours for \(settings.unlockMinutes) minutes."
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor.black.withAlphaComponent(0.55),
            icon: nil,
            title: ShieldConfiguration.Label(text: "Quick one?", color: .white),
            subtitle: ShieldConfiguration.Label(text: subtitle, color: UIColor.white.withAlphaComponent(0.8)),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Start", color: .white),
            primaryButtonBackgroundColor: teal,
            secondaryButtonLabel: ShieldConfiguration.Label(text: secondary, color: UIColor.white.withAlphaComponent(0.8))
        )
    }
}
