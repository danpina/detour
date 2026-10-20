import XCTest
@testable import Detour

final class GuardStoreTests: XCTestCase {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func makeStore() -> GuardStore {
        let name = "detour.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return GuardStore(defaults: defaults, calendar: calendar)
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
    }

    func testDefaultsAndRoundTrip() {
        let store = makeStore()
        XCTAssertEqual(store.settings, GuardSettings())
        XCTAssertFalse(store.settings.enabled)
        var s = store.settings
        s.enabled = true
        s.mode = .gentle
        s.unlockMinutes = 30
        store.settings = s
        XCTAssertEqual(store.settings, s)
    }

    func testOneEmergencySkipPerDayResetsAtMidnight() {
        let store = makeStore()
        let monday = date(2026, 3, 2)
        XCTAssertEqual(store.skipsLeft(now: monday), 1)
        XCTAssertTrue(store.useSkip(now: monday))
        XCTAssertEqual(store.skipsLeft(now: monday), 0)
        XCTAssertFalse(store.useSkip(now: date(2026, 3, 2, 23)))
        XCTAssertEqual(store.skipsLeft(now: date(2026, 3, 3, 0)), 1)
        XCTAssertTrue(store.useSkip(now: date(2026, 3, 3, 8)))
    }

    func testPendingSessionIsConsumedOnce() {
        let store = makeStore()
        XCTAssertFalse(store.consumePendingSession())
        store.pendingSession = true
        XCTAssertTrue(store.consumePendingSession())
        XCTAssertFalse(store.consumePendingSession())
    }

    func testUnlockWindow() {
        let store = makeStore()
        let now = date(2026, 3, 2)
        XCTAssertFalse(store.isUnlocked(now: now))
        store.unlockUntil = now.addingTimeInterval(15 * 60)
        XCTAssertTrue(store.isUnlocked(now: now.addingTimeInterval(14 * 60)))
        XCTAssertFalse(store.isUnlocked(now: now.addingTimeInterval(16 * 60)))
    }

    func testSettingsSavedBeforeStrictModeStillLoad() {
        let name = "detour.tests.legacy.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        // What an earlier build stored: no strictMinutes key.
        let legacy = "{\"enabled\":true,\"mode\":\"earnIt\",\"unlockMinutes\":15,\"dailySkips\":1}"
        defaults.set(Data(legacy.utf8), forKey: "guard.settings")
        let store = GuardStore(defaults: defaults, calendar: calendar)
        XCTAssertTrue(store.settings.enabled)
        XCTAssertEqual(store.settings.mode, .earnIt)
        XCTAssertEqual(store.settings.strictUseMinutes, 3)
    }

    func testStaleEndedSignalIsIgnoredWhileANewUnlockRuns() {
        let store = makeStore()
        let now = date(2026, 3, 2)
        // No unlock recorded: an "ended" signal is real.
        XCTAssertTrue(store.windowReallyEnded(now: now))
        // A new unlock was just requested for 15 minutes: the old timer's "ended" must not re-shield.
        store.unlockUntil = now.addingTimeInterval(15 * 60)
        XCTAssertFalse(store.windowReallyEnded(now: now))
        // The window's own end (within the slack) counts.
        XCTAssertTrue(store.windowReallyEnded(now: now.addingTimeInterval(15 * 60 - 5)))
        XCTAssertTrue(store.windowReallyEnded(now: now.addingTimeInterval(16 * 60)))
    }

    func testLogKeepsTheLatestLines() {
        let store = makeStore()
        for i in 0..<450 { store.log("line \(i)") }
        XCTAssertEqual(store.logLines.count, 400)
        XCTAssertTrue(store.logLines.last!.hasSuffix("line 449"))
        store.clearLog()
        XCTAssertTrue(store.logLines.isEmpty)
    }
}
