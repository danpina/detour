import XCTest
@testable import Detour

final class ChessTests: XCTestCase {
    private let scholar = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"

    private func puzzle(mates: [String]) -> ChessPuzzle {
        return ChessPuzzle(id: "t", fen: scholar, sideToMove: "w", mates: mates, rating: 600)
    }

    func testParseFenPlacementAndSide() {
        guard let parsed = ChessLogic.parseFen(scholar) else {
            XCTFail("FEN should parse")
            return
        }
        XCTAssertEqual(parsed.squares.count, 64)
        XCTAssertEqual(parsed.sideToMove, "w")
        let first: Character? = parsed.squares[0]
        let last: Character? = parsed.squares[63]
        XCTAssertTrue(first == Character("r"))
        XCTAssertTrue(last == Character("R"))
    }

    func testParseFenBlackToMove() {
        let parsed = ChessLogic.parseFen("4k3/8/8/8/8/8/8/4K3 b - - 0 1")
        XCTAssertEqual(parsed?.sideToMove, "b")
    }

    func testParseFenRejectsGarbage() {
        XCTAssertNil(ChessLogic.parseFen("nonsense"))
        XCTAssertNil(ChessLogic.parseFen("8/8/8/8/8/8/8 w"))
        XCTAssertNil(ChessLogic.parseFen("9/8/8/8/8/8/8/8 w"))
    }

    func testOrientation() {
        let white = ChessLogic.displayOrder(side: "w")
        let black = ChessLogic.displayOrder(side: "b")
        XCTAssertEqual(ChessLogic.squareName(white[0]), "a8")
        XCTAssertEqual(ChessLogic.squareName(white[63]), "h1")
        XCTAssertEqual(ChessLogic.squareName(black[0]), "h1")
        XCTAssertEqual(ChessLogic.squareName(black[63]), "a8")
    }

    func testAcceptMove() {
        let p = puzzle(mates: ["h5f7", "a7a8q"])
        XCTAssertEqual(ChessLogic.acceptMove(p, from: "h5", to: "f7"), "h5f7")
        XCTAssertEqual(ChessLogic.acceptMove(p, from: "a7", to: "a8"), "a7a8q")
        XCTAssertNil(ChessLogic.acceptMove(p, from: "h5", to: "e5"))
    }

    func testBuildRoundIsEasyToHard() {
        var all: [ChessPuzzle] = []
        for i in 0..<100 {
            all.append(ChessPuzzle(id: "p\(i)", fen: scholar, sideToMove: "w", mates: ["h5f7"], rating: 500 + i * 10))
        }
        let round = ChessLogic.buildRound(all, count: 10)
        XCTAssertEqual(round.count, 10)
        for i in 1..<round.count {
            XCTAssertGreaterThanOrEqual(round[i].rating, round[i - 1].rating)
        }
    }

    func testBundledDataIfPresent() {
        guard let data = ChessLogic.load() else { return }
        XCTAssertFalse(data.credit.isEmpty)
        for p in data.puzzles {
            XCTAssertNotNil(ChessLogic.parseFen(p.fen), p.id)
            XCTAssertFalse(p.mates.isEmpty, p.id)
        }
    }
}
