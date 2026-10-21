import Foundation

/// The app the shield was covering when the user chose a detour, so the end screen can take them back to it.
/// It is read from the shield screen on the device and stays in the App Group container. It never leaves the device.
struct ReturnApp: Equatable {
    /// Name as shown by iOS, if the shield screen could read it.
    let name: String?
    let bundleIdentifier: String
    let url: URL
}

enum ReturnApps {
    /// URL schemes of popular apps, by bundle identifier. An app that is not listed simply gets no "go back" button.
    static let schemes: [String: String] = [
        "com.burbn.instagram": "instagram://app",
        "com.burbn.barcelona": "barcelona://",
        "com.zhiliaoapp.musically": "tiktok://",
        "com.google.ios.youtube": "youtube://",
        "com.atebits.Tweetie2": "twitter://",
        "com.facebook.Facebook": "fb://",
        "com.facebook.Messenger": "fb-messenger://",
        "com.reddit.Reddit": "reddit://",
        "com.toyopagroup.picaboo": "snapchat://",
        "com.hammerandchisel.discord": "discord://",
        "ph.telegra.Telegraph": "tg://",
        "net.whatsapp.WhatsApp": "whatsapp://",
        "com.linkedin.LinkedIn": "linkedin://",
        "pinterest": "pinterest://",
        "com.netflix.Netflix": "nflx://",
        "com.spotify.client": "spotify://",
        "tv.twitch": "twitch://",
        "Alexis.BeReal": "bereal://",
        "com.google.chrome.ios": "googlechrome://",
    ]

    static func url(for bundleIdentifier: String) -> URL? {
        schemes[bundleIdentifier].flatMap { URL(string: $0) }
    }

    /// What the end screen needs, or nil if the shielded app is unknown or has no known way to open it.
    static func returnApp(bundleIdentifier: String?, name: String?) -> ReturnApp? {
        guard let bundleIdentifier, let url = url(for: bundleIdentifier) else { return nil }
        return ReturnApp(name: name, bundleIdentifier: bundleIdentifier, url: url)
    }
}
