import XCTest
@testable import Detour

final class WidgetSnapshotTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    func testDayKeyMatchesTheAppsStreakDays() {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(WidgetSnapshot.dayKey(date, calendar: calendar), Days.key(date, calendar: calendar))
    }

    func testReadsTheStreakForTodayAndShowsNothingBeyondTheDaysWorkedOut() {
        let today = Date(timeIntervalSince1970: 1_800_000_000)
        let snapshot = WidgetSnapshot(
            streakByDay: [WidgetSnapshot.dayKey(today, calendar: calendar): 7],
            lastActiveDay: WidgetSnapshot.dayKey(today, calendar: calendar),
            dueCount: 2,
            roundSize: 5
        )
        XCTAssertEqual(snapshot.streak(on: today, calendar: calendar), 7)
        XCTAssertTrue(snapshot.doneToday(today, calendar: calendar))
        let later = calendar.date(byAdding: .day, value: 30, to: today)!
        XCTAssertEqual(snapshot.streak(on: later, calendar: calendar), 0)
        XCTAssertFalse(snapshot.doneToday(later, calendar: calendar))
    }

    func testSurvivesBeingSavedAndReadBack() throws {
        let snapshot = WidgetSnapshot(streakByDay: ["2026-10-28": 3, "2026-10-29": 3], lastActiveDay: "2026-10-28", dueCount: 4, roundSize: 8)
        let data = try JSONEncoder().encode(snapshot)
        XCTAssertEqual(try JSONDecoder().decode(WidgetSnapshot.self, from: data), snapshot)
    }

    func testTheAppWorksOutTheStreakAheadWithoutAnyData() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("detour-test-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let model = AppModel(store: DataStore(url: url), content: ContentStore.load(), clock: { now }, calendar: calendar)
        let snapshot = model.widgetSnapshot()
        XCTAssertEqual(snapshot.streakByDay.count, WidgetSnapshot.daysAhead)
        XCTAssertEqual(snapshot.streak(on: now, calendar: calendar), 0)
        XCTAssertEqual(snapshot.lastActiveDay, "")
        XCTAssertEqual(snapshot.roundSize, model.settings.setSize)
    }
}
