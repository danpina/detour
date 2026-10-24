import XCTest
@testable import Detour

final class ReturnAppsTests: XCTestCase {
    func testKnownAppsHaveAUrlAndUnknownOnesDoNot() {
        XCTAssertEqual(ReturnApps.url(for: "com.burbn.instagram")?.absoluteString, "instagram://app")
        XCTAssertEqual(ReturnApps.url(for: "com.zhiliaoapp.musically")?.scheme, "tiktok")
        XCTAssertNil(ReturnApps.url(for: "com.example.unknown"))
    }

    func testReturnAppNeedsABundleAndAKnownScheme() {
        XCTAssertNil(ReturnApps.returnApp(bundleIdentifier: nil, name: "Instagram"))
        XCTAssertNil(ReturnApps.returnApp(bundleIdentifier: "com.example.unknown", name: "Example"))
        let app = ReturnApps.returnApp(bundleIdentifier: "com.burbn.instagram", name: "Instagram")
        XCTAssertEqual(app?.name, "Instagram")
        XCTAssertEqual(app?.url.scheme, "instagram")
    }

    func testEverySchemeIsAValidUrl() {
        for (bundle, scheme) in ReturnApps.schemes {
            XCTAssertNotNil(URL(string: scheme), "\(bundle) has an invalid scheme")
        }
    }

    func testTheShieldedAppIsRemembered() {
        let name = "detour.tests.shielded.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        let store = GuardStore(defaults: defaults)
        XCTAssertNil(store.shieldedBundle)
        store.recordShielded(bundle: "com.burbn.instagram", name: "Instagram")
        XCTAssertEqual(store.shieldedBundle, "com.burbn.instagram")
        XCTAssertEqual(store.shieldedName, "Instagram")
        store.recordShielded(bundle: nil, name: nil)
        XCTAssertNil(store.shieldedBundle)
    }
}

final class ReturnAppsPickerTests: XCTestCase {
    func testEveryPopularAppCanBeOpenedAndNamed() {
        XCTAssertFalse(ReturnApps.popular.isEmpty)
        for app in ReturnApps.popular {
            XCTAssertNotNil(ReturnApps.url(for: app.bundle), "\(app.name) has no URL scheme")
            XCTAssertEqual(ReturnApps.displayName(for: app.bundle), app.name)
        }
    }
}

final class IdentifyAppTests: XCTestCase {
    private func makeStore() -> GuardStore {
        let name = "detour.tests.identify." + UUID().uuidString
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return GuardStore(defaults: defaults)
    }

    func testNamesAndBundlesResolveToKnownApps() {
        XCTAssertEqual(ReturnApps.resolve(bundle: nil, name: "LinkedIn"), "com.linkedin.LinkedIn")
        XCTAssertEqual(ReturnApps.resolve(bundle: nil, name: "twitter"), "com.atebits.Tweetie2")
        XCTAssertEqual(ReturnApps.resolve(bundle: "com.burbn.instagram", name: nil), "com.burbn.instagram")
        XCTAssertNil(ReturnApps.resolve(bundle: "com.example.unknown", name: "Some Game"))
        XCTAssertNil(ReturnApps.resolve(bundle: nil, name: nil))
    }

    func testWhatIsLearnedIsRememberedAndTheUsersChoiceWins() {
        let store = makeStore()
        XCTAssertNil(store.identify(tokenKey: "k1", bundle: nil, name: nil))
        XCTAssertEqual(store.identify(tokenKey: "k1", bundle: nil, name: "Instagram"), "com.burbn.instagram")
        // Remembered: no name needed the next time.
        XCTAssertEqual(store.identify(tokenKey: "k1", bundle: nil, name: nil), "com.burbn.instagram")
        // Something already stored is not overwritten.
        store.returnMap = ["k2": "com.facebook.Facebook"]
        XCTAssertEqual(store.identify(tokenKey: "k2", bundle: nil, name: "Instagram"), "com.facebook.Facebook")
    }
}
