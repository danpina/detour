import Foundation

/// A rolling debug log kept on the device, shared with the Screen Time extensions (they write to the same store).
/// It records what happens in the app (screens, sets built, cards shown and answered) so problems can be traced from
/// Settings → Debug log. It never leaves the device unless the user copies or shares it.
enum AppLog {
    static func log(_ message: String) {
        GuardStore.shared.log("app: " + message)
    }
}
