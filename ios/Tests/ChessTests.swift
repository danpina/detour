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

    private func manyPuzzles() -> [ChessPuzzle] {
        var all: [ChessPuzzle] = []
        for i in 0..<100 {
            all.append(ChessPuzzle(id: "p\(i)", fen: scholar, sideToMove: "w", mates: ["h5f7"], rating: 500 + i * 10))
        }
        return all
    }

    func testBuildRoundIsEasyToHardForEachSize() {
        for size in [2, 5, 10] {
            let round = ChessLogic.buildRound(manyPuzzles(), count: size)
            XCTAssertEqual(round.count, size)
            for i in 1..<round.count {
                XCTAssertGreaterThanOrEqual(round[i].rating, round[i - 1].rating)
            }
        }
    }

    func testTwoPuzzleRoundIsEasyThenHarderAndGentle() {
        let hard = ChessLogic.buildRound(manyPuzzles(), count: 2, rand: { 0.99 })
        XCTAssertLessThan(hard[0].rating, hard[1].rating)
        XCTAssertLessThanOrEqual(hard[1].rating, 500 + 50 * 10)
        let easy = ChessLogic.buildRound(manyPuzzles(), count: 2, rand: { 0.0 })
        XCTAssertEqual(easy[0].rating, 500)
    }

    func testTenPuzzleRoundReachesHardestBand() {
        let round = ChessLogic.buildRound(manyPuzzles(), count: 10, rand: { 0.99 })
        XCTAssertEqual(round[9].rating, 500 + 99 * 10)
    }

    func testFewerPuzzlesThanSize() {
        let round = ChessLogic.buildRound(Array(manyPuzzles().prefix(3)), count: 5)
        XCTAssertEqual(round.count, 3)
    }

    func testBundledDataIfPresent() {
        guard let data = ChessLogic.load() else { return }
        XCTAssertFalse(data.credit.isEmpty)
        for p in data.puzzles {
            XCTAssertNotNil(ChessLogic.parseFen(p.fen), p.id)
            XCTAssertFalse(p.mates.isEmpty, p.id)
        }
    }

    // MARK: Mates in two or three

    private func squares(_ fen: String) -> [Character?] { ChessLogic.parseFen(fen)!.squares }

    private func at(_ board: [Character?], _ name: String) -> Character? { board[ChessLogic.squareIndex(name)] }

    func testApplyUciHandlesPromotionCastlingAndEnPassant() {
        let promoted = ChessLogic.applyUci(squares("4k3/P7/8/8/8/8/8/R3K2R w KQ - 0 1"), "a7a8q")
        XCTAssertEqual(at(promoted, "a8"), "Q")
        XCTAssertNil(at(promoted, "a7"))

        let board = squares("4k3/8/8/3pP3/8/8/8/R3K2R w KQ d6 0 1")
        let kingside = ChessLogic.applyUci(board, "e1g1")
        XCTAssertEqual(at(kingside, "g1"), "K")
        XCTAssertEqual(at(kingside, "f1"), "R")
        XCTAssertNil(at(kingside, "h1"))
        let queenside = ChessLogic.applyUci(board, "e1c1")
        XCTAssertEqual(at(queenside, "d1"), "R")
        XCTAssertNil(at(queenside, "a1"))
        let enPassant = ChessLogic.applyUci(board, "e5d6")
        XCTAssertEqual(at(enPassant, "d6"), "P")
        XCTAssertNil(at(enPassant, "d5"))
        XCTAssertEqual(at(ChessLogic.boardAfter(board, ["e1g1", "e8d8"]), "d8"), "k")
    }

    func testALineAcceptsOnlyItsOwnMovesUntilTheLastOne() {
        let line = ChessPuzzle(id: "t", fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", sideToMove: "w", mates: ["a1a8"], rating: 1500, line: ["e1d1", "e8d7", "a1a8"])
        XCTAssertEqual(ChessLogic.matePlies(line), 2)
        XCTAssertEqual(ChessLogic.matePlies(puzzle(mates: ["h5f7"])), 1)
        XCTAssertFalse(ChessLogic.isFinalStep(line, ply: 0))
        XCTAssertTrue(ChessLogic.isFinalStep(line, ply: 2))
        XCTAssertEqual(ChessLogic.acceptStep(line, ply: 0, from: "e1", to: "d1"), "e1d1")
        XCTAssertNil(ChessLogic.acceptStep(line, ply: 0, from: "a1", to: "a8"))
        XCTAssertEqual(ChessLogic.acceptStep(line, ply: 2, from: "a1", to: "a8"), "a1a8")
        XCTAssertNil(ChessLogic.acceptStep(line, ply: 2, from: "d1", to: "d2"))
    }

    func testHardPuzzlesAreLinesThatReplayWithTheRightColoursMoving() {
        guard let hard = ChessLogic.load()?.hard, !hard.isEmpty else { return }
        for p in hard {
            guard let line = p.line, let parsed = ChessLogic.parseFen(p.fen) else { return XCTFail("a hard puzzle is a line: " + p.id) }
            XCTAssertTrue([3, 5].contains(line.count), p.id)
            XCTAssertTrue(p.mates.contains(line[line.count - 1]), p.id)
            var board = parsed.squares
            for (i, move) in line.enumerated() {
                guard let piece = board[ChessLogic.squareIndex(String(move.prefix(2)))] else { return XCTFail("empty start square in " + p.id) }
                XCTAssertEqual(piece.isUppercase, (i % 2 == 0) == (p.sideToMove == "w"), p.id)
                board = ChessLogic.applyUci(board, move)
            }
        }
    }
}
