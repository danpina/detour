import XCTest
@testable import Detour

final class GeoTests: XCTestCase {
    /// Small deterministic generator so failures are reproducible.
    private struct SeededGenerator: RandomNumberGenerator {
        var state: UInt64
        mutating func next() -> UInt64 {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return state
        }
    }

    private func loadCountries() throws -> [GeoCountry] {
        let countries = GeoData.load()
        XCTAssertGreaterThanOrEqual(countries.count, 130)
        return countries
    }

    func testDataLoadsAndIsSane() throws {
        let countries = try loadCountries()
        XCTAssertEqual(Set(countries.map { $0.name }).count, countries.count)
        XCTAssertEqual(Set(countries.map { $0.capital }).count, countries.count)
        XCTAssertEqual(Set(countries.map { $0.flag }).count, countries.count)
        for country in countries {
            XCTAssertTrue(GeoData.continents.contains(country.continent), country.name)
            XCTAssertTrue([1, 2, 3].contains(country.level), country.name)
            let scalars = Array(country.flag.unicodeScalars)
            XCTAssertEqual(scalars.count, 2, country.name)
            for scalar in scalars {
                XCTAssertTrue(scalar.value >= 0x1F1E6 && scalar.value <= 0x1F1FF, country.name)
            }
        }
    }

    func testQuestionsHaveFourDistinctOptionsIncludingTheAnswer() throws {
        let countries = try loadCountries()
        var rng = SeededGenerator(state: 42)
        let kinds: [GeoKind] = [.flag, .capital, .country]
        for country in countries {
            for kind in kinds {
                let q = GeoBuilder.question(all: countries, answer: country, kind: kind, using: &rng)
                XCTAssertEqual(q.options.count, 4)
                XCTAssertEqual(Set(q.options).count, 4)
                XCTAssertEqual(q.options.filter { $0 == q.answer }.count, 1)
                XCTAssertFalse(q.fact.isEmpty)
            }
        }
    }

    func testRoundsRampThroughLevelsWithoutRepeats() throws {
        let countries = try loadCountries()
        for size in [2, 5, 10] {
            for seed in 1...20 {
                var rng = SeededGenerator(state: UInt64(seed))
                let round = GeoBuilder.round(all: countries, length: size, using: &rng)
                XCTAssertEqual(round.count, size)
                var previous = 0
                for (i, q) in round.enumerated() {
                    XCTAssertEqual(q.level, GeoBuilder.level(forIndex: i, length: size))
                    XCTAssertGreaterThanOrEqual(q.level, previous)
                    previous = q.level
                }
                XCTAssertEqual(Set(round.map { $0.fact }).count, round.count)
            }
        }
    }

    func testRoundKindMix() throws {
        let countries = try loadCountries()
        for seed in 1...20 {
            var rng = SeededGenerator(state: UInt64(seed))
            let two = GeoBuilder.round(all: countries, length: 2, using: &rng)
            XCTAssertTrue(two.contains { $0.kind == .flag })
            XCTAssertTrue(two.contains { $0.kind == .capital })
            for size in [5, 10] {
                let round = GeoBuilder.round(all: countries, length: size, using: &rng)
                XCTAssertTrue(round.contains { $0.kind == .flag })
                XCTAssertTrue(round.contains { $0.kind == .capital })
                XCTAssertTrue(round.contains { $0.kind == .country })
            }
        }
    }
}
