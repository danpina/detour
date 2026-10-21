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
