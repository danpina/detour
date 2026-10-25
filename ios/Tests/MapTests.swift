import XCTest
@testable import Detour

final class MapTests: XCTestCase {
    private var map: MapData {
        get throws { try XCTUnwrap(MapStore.load(), "map.json should be bundled") }
    }

    func testTheBundledMapHasWhatTheGameNeeds() throws {
        let data = try map
        XCTAssertGreaterThan(data.countries.count, 150)
        XCTAssertGreaterThan(data.rivers.count, 25)
        XCTAssertGreaterThan(data.mountains.count, 20)
        XCTAssertEqual(Set(data.countries.map { $0.id }).count, data.countries.count)
        for c in data.countries {
            XCTAssertFalse(c.rings.isEmpty, c.name)
            for ring in c.rings { XCTAssertEqual(ring.count % 2, 0, c.name) }
        }
    }

    func testFindsTheCountryUnderAPointAndNothingAtSea() throws {
        let data = try map
        let paris = MapLogic.project(lon: 2.35, lat: 48.85)
        XCTAssertEqual(MapLogic.countryAt(data, x: paris.x, y: paris.y)?.name, "France")
        let tokyo = MapLogic.project(lon: 139.7, lat: 35.7)
        XCTAssertEqual(MapLogic.countryAt(data, x: tokyo.x, y: tokyo.y)?.name, "Japan")
        let sea = MapLogic.project(lon: -30, lat: 0)
        XCTAssertNil(MapLogic.countryAt(data, x: sea.x, y: sea.y))
    }

    func testJudgesACountryTapAndNamesWhatWasTapped() throws {
        let data = try map
        let france = try XCTUnwrap(data.countries.first { $0.name == "France" })
        let germany = try XCTUnwrap(data.countries.first { $0.name == "Germany" })
        let paris = MapLogic.project(lon: 2.35, lat: 48.85)
        XCTAssertEqual(MapLogic.judge(data, target: .country(france), x: paris.x, y: paris.y), MapVerdict(correct: true, tapped: nil))
        let wrong = MapLogic.judge(data, target: .country(germany), x: paris.x, y: paris.y)
        XCTAssertFalse(wrong.correct)
        XCTAssertEqual(wrong.tapped, "France")
    }

    func testRiversAndMountainsAreJudgedByDistance() throws {
        let data = try map
        let nile = try XCTUnwrap(data.rivers.first { $0.name == "Nile" })
        let x = Double(nile.lines[0][0]), y = Double(nile.lines[0][1])
        XCTAssertTrue(MapLogic.judge(data, target: .river(nile), x: x + 20, y: y + 20).correct)
        XCTAssertFalse(MapLogic.judge(data, target: .river(nile), x: x + 2000, y: y + 2000).correct)
        let everest = try XCTUnwrap(data.mountains.first { $0.name == "Mount Everest" })
        XCTAssertTrue(MapLogic.judge(data, target: .mountain(everest), x: Double(everest.at[0]) + 50, y: Double(everest.at[1])).correct)
        XCTAssertFalse(MapLogic.judge(data, target: .mountain(everest), x: Double(everest.at[0]) + 1000, y: Double(everest.at[1])).correct)
    }

    func testRegionsAndPools() throws {
        let data = try map
        let europe = MapLogic.regionBox(data, region: .europe)
        let paris = MapLogic.project(lon: 2.35, lat: 48.85)
        let tokyo = MapLogic.project(lon: 139.7, lat: 35.7)
        XCTAssertTrue(paris.x >= europe.x && paris.x <= europe.x + europe.w && paris.y >= europe.y && paris.y <= europe.y + europe.h)
        XCTAssertGreaterThan(tokyo.x, europe.x + europe.w)
        XCTAssertLessThan(MapLogic.countryPool(data, region: .europe, difficulty: 1).count, MapLogic.countryPool(data, region: .europe, difficulty: 3).count)
        XCTAssertTrue(MapLogic.riverPool(data, region: .europe).contains { $0.name == "Danube" })
    }

    func testRoundsNeverRepeatAndStayShortWhenThereIsLittleToAsk() throws {
        let data = try map
        var rng = SystemRandomNumberGenerator()
        var settings = MapSettings()
        settings.difficulty = 2
        let round = MapLogic.round(data, settings: settings, length: 20, using: &rng)
        XCTAssertEqual(round.count, 20)
        XCTAssertEqual(Set(round.map { $0.name }).count, 20)
        settings.subject = .mixed
        let mixed = MapLogic.round(data, settings: settings, length: 12, using: &rng)
        XCTAssertGreaterThan(Set(mixed.map { $0.subjectWord }).count, 1)
        settings.subject = .rivers
        settings.region = .oceania
        XCTAssertLessThan(MapLogic.round(data, settings: settings, length: 20, using: &rng).count, 20)
    }
}
