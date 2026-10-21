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

final class HardLockAndHoursTests: XCTestCase {
    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func makeStore() -> GuardStore {
        let name = "detour.tests.hardlock." + UUID().uuidString
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return GuardStore(defaults: defaults, calendar: calendar)
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    func testDaytimeWindow() {
        let hours = ActiveHours(startHour: 9, startMinute: 0, endHour: 22, endMinute: 0)
        XCTAssertTrue(hours.contains(date(2026, 3, 2, 9), calendar: calendar))
        XCTAssertTrue(hours.contains(date(2026, 3, 2, 21, 59), calendar: calendar))
        XCTAssertFalse(hours.contains(date(2026, 3, 2, 22), calendar: calendar))
        XCTAssertFalse(hours.contains(date(2026, 3, 2, 8, 59), calendar: calendar))
    }

    func testOvernightWindowRunsPastMidnight() {
        let hours = ActiveHours(startHour: 22, startMinute: 0, endHour: 6, endMinute: 0)
        XCTAssertTrue(hours.contains(date(2026, 3, 2, 23), calendar: calendar))
        XCTAssertTrue(hours.contains(date(2026, 3, 3, 2), calendar: calendar))
        XCTAssertFalse(hours.contains(date(2026, 3, 3, 6), calendar: calendar))
        XCTAssertFalse(hours.contains(date(2026, 3, 3, 12), calendar: calendar))
    }

    func testEqualStartAndEndMeansAllDay() {
        let hours = ActiveHours(startHour: 8, startMinute: 0, endHour: 8, endMinute: 0)
        XCTAssertTrue(hours.contains(date(2026, 3, 2, 3), calendar: calendar))
    }

    func testStoreIsAlwaysActiveWithoutHoursAndRespectsThemWhenSet() {
        let store = makeStore()
        XCTAssertTrue(store.isWithinActiveHours(now: date(2026, 3, 2, 3)))
        var settings = store.settings
        settings.activeHours = ActiveHours(startHour: 9, startMinute: 0, endHour: 22, endMinute: 0)
        store.settings = settings
        XCTAssertFalse(store.isWithinActiveHours(now: date(2026, 3, 2, 3)))
        XCTAssertTrue(store.isWithinActiveHours(now: date(2026, 3, 2, 12)))
    }

    func testHardLockLastsUntilMidnight() {
        let store = makeStore()
        let afternoon = date(2026, 3, 2, 15)
        XCTAssertFalse(store.isHardLocked(now: afternoon))
        store.markHardLocked(now: afternoon)
        XCTAssertTrue(store.isHardLocked(now: date(2026, 3, 2, 23, 59)))
        XCTAssertFalse(store.isHardLocked(now: date(2026, 3, 3, 0, 1)))
        store.clearHardLock()
        XCTAssertFalse(store.isHardLocked(now: afternoon))
    }

    func testNewSettingsFieldsSurviveARoundTripAndHaveDefaults() {
        let store = makeStore()
        XCTAssertEqual(store.settings.dailyAllowance, 30)
        var settings = store.settings
        settings.mode = .hardLock
        settings.allowanceMinutes = 45
        settings.activeHours = ActiveHours()
        store.settings = settings
        XCTAssertEqual(store.settings.mode, .hardLock)
        XCTAssertEqual(store.settings.dailyAllowance, 45)
        XCTAssertEqual(store.settings.activeHours, ActiveHours())
    }
}
