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

    /// The same apps with their names, for the Settings picker.
    struct PopularApp: Identifiable {
        let bundle: String
        let name: String
        var id: String { bundle }
    }

    static let popular: [PopularApp] = [
        PopularApp(bundle: "com.burbn.instagram", name: "Instagram"),
        PopularApp(bundle: "com.zhiliaoapp.musically", name: "TikTok"),
        PopularApp(bundle: "com.google.ios.youtube", name: "YouTube"),
        PopularApp(bundle: "com.atebits.Tweetie2", name: "X"),
        PopularApp(bundle: "com.facebook.Facebook", name: "Facebook"),
        PopularApp(bundle: "com.reddit.Reddit", name: "Reddit"),
        PopularApp(bundle: "com.toyopagroup.picaboo", name: "Snapchat"),
        PopularApp(bundle: "com.burbn.barcelona", name: "Threads"),
        PopularApp(bundle: "com.hammerandchisel.discord", name: "Discord"),
        PopularApp(bundle: "net.whatsapp.WhatsApp", name: "WhatsApp"),
        PopularApp(bundle: "com.netflix.Netflix", name: "Netflix"),
        PopularApp(bundle: "tv.twitch", name: "Twitch"),
        PopularApp(bundle: "com.linkedin.LinkedIn", name: "LinkedIn"),
        PopularApp(bundle: "pinterest", name: "Pinterest"),
        PopularApp(bundle: "com.facebook.Messenger", name: "Messenger"),
        PopularApp(bundle: "ph.telegra.Telegraph", name: "Telegram"),
        PopularApp(bundle: "com.spotify.client", name: "Spotify"),
        PopularApp(bundle: "Alexis.BeReal", name: "BeReal"),
        PopularApp(bundle: "com.google.chrome.ios", name: "Chrome"),
    ]

    static func displayName(for bundleIdentifier: String) -> String? {
        popular.first { $0.bundle == bundleIdentifier }?.name
    }

    /// The bundle identifier of a known app from the name iOS shows for it (case does not matter; "Twitter" counts as X).
    static func bundle(forName name: String?) -> String? {
        guard let name else { return nil }
        let wanted = name.trimmingCharacters(in: .whitespaces).lowercased()
        if wanted == "twitter" { return "com.atebits.Tweetie2" }
        return popular.first { $0.name.lowercased() == wanted }?.bundle
    }

    /// What iOS told us about an app, turned into a bundle identifier we can open: its bundle if known, else its name.
    static func resolve(bundle: String?, name: String?) -> String? {
        if let bundle, url(for: bundle) != nil { return bundle }
        return self.bundle(forName: name)
    }

    static func url(for bundleIdentifier: String) -> URL? {
        schemes[bundleIdentifier].flatMap { URL(string: $0) }
    }

    /// What the end screen needs, or nil if the shielded app is unknown or has no known way to open it.
    static func returnApp(bundleIdentifier: String?, name: String?) -> ReturnApp? {
        guard let bundleIdentifier, let url = url(for: bundleIdentifier) else { return nil }
        return ReturnApp(name: name, bundleIdentifier: bundleIdentifier, url: url)
    }
}
