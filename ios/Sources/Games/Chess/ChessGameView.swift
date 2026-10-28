import SwiftUI

/// Chess tactics: find the checkmate, in one move or (hard) in two or three. A round has `GameStats.roundSize` puzzles, easy to hard.
/// When `embedded` is set the game is played inside a set of cards: it skips the end screen and calls
/// `embedded(score)` when the round is finished; `onExit` then means "skip".
struct ChessGameView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let onExit: () -> Void
    var embedded: ((Int) -> Void)? = nil

    private enum Status {
        case playing
        case correct
        case revealed
    }

    private let maxTries = 2

    @State private var data: ChessData?
    @State private var round: [ChessPuzzle]
    @State private var index = 0
    @State private var score = 0
    @State private var wrong = 0
    @State private var status: Status = .playing
    @State private var selected: String? = nil
    @State private var answer: String? = nil
    /// Every move played so far in this puzzle: yours and the opponent's replies.
    @State private var moves: [String] = []
    @State private var waiting = false
    @State private var done = false
    @State private var isBest = false
    @State private var shakeOffset: CGFloat = 0

    init(onExit: @escaping () -> Void, embedded: ((Int) -> Void)? = nil) {
        self.onExit = onExit
        self.embedded = embedded
        let loaded = ChessLogic.load()
        _data = State(initialValue: loaded)
        if let loaded = loaded {
            _round = State(initialValue: ChessLogic.buildRound(loaded.puzzles(forLevel: ChessData.currentLevel), count: GameStats.size(embedded: embedded != nil)))
        } else {
            _round = State(initialValue: [])
        }
    }

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            if data == nil || round.isEmpty {
                missingView
            } else if done && embedded == nil {
                doneView
            } else {
                playView
            }
        }
    }

    // MARK: - Screens

    private var missingView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Chess tactics").font(.largeTitle.weight(.semibold))
            Text("The puzzles didn't load this time. Try again a little later.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(32)
    }

    private var doneView: some View {
        VStack(spacing: 18) {
            Spacer()
            Text("\u{265F}\u{FE0F}").font(.system(size: 56)).accessibilityHidden(true)
            Text("\(score) of \(round.count)").font(.largeTitle.weight(.semibold))
            Text(doneMessage())
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(action: playAgain) {
                Text("Play again").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            Button(action: onExit) {
                Text("Back").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(.bordered)
            Text(data?.credit ?? "")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private var playView: some View {
        let puzzle = round[index]
        let parsed = ChessLogic.parseFen(puzzle.fen)
        return VStack(spacing: 12) {
            HStack {
                if embedded != nil {
                    Text("A quick board puzzle").font(.subheadline.weight(.semibold))
                } else {
                    Button("Close", action: onExit)
                        .frame(minHeight: 44)
                }
                Spacer()
                Text("\(index + 1) of \(round.count)").font(.subheadline).foregroundStyle(.secondary)
                if embedded != nil {
                    Button("Skip", action: onExit)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(minHeight: 44)
                }
            }
            Text(messageText(puzzle))
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
                .frame(minHeight: 52)
            if let parsed = parsed {
                boardView(puzzle: puzzle, parsed: parsed)
                    .offset(x: shakeOffset)
            } else {
                Text("That one got lost.").foregroundStyle(.secondary)
                Button("Next") { advance(finalScore: score) }.buttonStyle(.borderedProminent)
            }
            if status == .revealed && !(embedded != nil && index + 1 >= round.count) {
                Button(action: { advance(finalScore: score) }) {
                    Text("Next").font(.headline).frame(maxWidth: 220, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func boardView(puzzle: ChessPuzzle, parsed: ParsedFen) -> some View {
        let side = puzzle.sideToMove
        let order = ChessLogic.displayOrder(side: side)
        let squares = ChessLogic.boardAfter(parsed.squares, moves)
        let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 8)
        return LazyVGrid(columns: columns, spacing: 0) {
            ForEach(order, id: \.self) { i in
                squareView(index: i, piece: squares[i], puzzle: puzzle)
            }
        }
        .frame(maxWidth: 390)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.4), lineWidth: 1))
    }

    private func squareView(index i: Int, piece: Character?, puzzle: ChessPuzzle) -> some View {
        let name = ChessLogic.squareName(i)
        let file = i % 8
        let rank = i / 8
        let light = (file + rank) % 2 == 0
        var fill = light ? Color(red: 0.96, green: 0.90, blue: 0.75) : Color(red: 0.18, green: 0.45, blue: 0.43)
        if let a = answer, a.count >= 4 {
            let from = String(a.prefix(2))
            let to = String(a.dropFirst(2).prefix(2))
            if name == from || name == to { fill = Color(red: 0.30, green: 0.80, blue: 0.55) }
        }
        // The opponent's last move stays marked, so you can see what changed.
        if status == .playing, let last = moves.last, last.count >= 4 {
            let from = String(last.prefix(2))
            let to = String(last.dropFirst(2).prefix(2))
            if name == from || name == to { fill = light ? Color(red: 0.80, green: 0.92, blue: 0.55) : Color(red: 0.40, green: 0.62, blue: 0.20) }
        }
        if selected == name { fill = Color(red: 0.98, green: 0.85, blue: 0.25) }
        return Button(action: { tap(name, piece, puzzle) }) {
            ZStack {
                fill
                // A thick ring and a lifted piece, so the chosen piece is clear on light and dark squares alike.
                if selected == name {
                    Rectangle().strokeBorder(Color.red, lineWidth: 4)
                }
                if let piece = piece {
                    Text(ChessLogic.glyph(piece))
                        .font(.system(size: 34))
                        .foregroundColor(ChessLogic.isWhite(piece) ? Color.white : Color.black)
                        .shadow(color: ChessLogic.isWhite(piece) ? Color.black : Color.clear, radius: 1)
                        .scaleEffect(selected == name ? 1.25 : 1)
                        .animation(.spring(duration: 0.2), value: selected)
                }
            }
            .aspectRatio(1, contentMode: .fit)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(name)
    }

    // MARK: - Logic

    private func messageText(_ puzzle: ChessPuzzle) -> String {
        let sideName = puzzle.sideToMove == "w" ? "White" : "Black"
        let total = ChessLogic.matePlies(puzzle)
        let ply = moves.count
        if status == .correct { return "Checkmate! Lovely." }
        if status == .revealed { return puzzle.line != nil ? "Here's the move. On to the next one." : "Here's the mate. On to the next one." }
        if wrong > 0 { return "Not that one, try again" }
        if ply > 0 {
            if waiting { return "Good move. Watching the reply…" }
            return total - ply / 2 == 1 ? "Good. Now find the mating move." : "Good. Now find your next move."
        }
        let words = ["", "one", "two", "three", "four"]
        return "\(sideName) to move. Find checkmate in \(total < words.count ? words[total] : String(total))."
    }

    private func doneMessage() -> String {
        var line = "solved on the first try. "
        let share = round.isEmpty ? 0.0 : Double(score) / Double(round.count)
        if share >= 0.9 {
            line += "Sharp eyes."
        } else if share >= 0.6 {
            line += "Nicely done."
        } else if share >= 0.3 {
            line += "Good practice."
        } else {
            line += "Every board teaches something."
        }
        if isBest && score > 0 { line += " That's a new best!" }
        return line
    }

    private func tap(_ name: String, _ piece: Character?, _ puzzle: ChessPuzzle) {
        if status != .playing || waiting { return }
        let side = puzzle.sideToMove
        guard let current = selected else {
            if ChessLogic.isOwnPiece(piece, side: side) { selected = name }
            return
        }
        if name == current {
            selected = nil
            return
        }
        if ChessLogic.isOwnPiece(piece, side: side) {
            selected = name
            return
        }
        let ply = moves.count
        if let step = ChessLogic.acceptStep(puzzle, ply: ply, from: current, to: name), !ChessLogic.isFinalStep(puzzle, ply: ply) {
            // Right, but not the mate yet: play it, then the opponent answers and it is your turn again.
            let played = moves + [step]
            moves = played
            selected = nil
            if let line = puzzle.line, line.indices.contains(ply + 1) {
                let reply = line[ply + 1]
                let shownIndex = index
                waiting = true
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 700_000_000)
                    if index == shownIndex && status == .playing && !done {
                        moves = played + [reply]
                        waiting = false
                    }
                }
            }
            return
        }
        if let mate = ChessLogic.acceptStep(puzzle, ply: ply, from: current, to: name) {
            let newScore = wrong == 0 ? score + 1 : score
            score = newScore
            answer = mate
            moves = moves + [mate]
            status = .correct
            selected = nil
            let shownIndex = index
            let isLastEmbedded = embedded != nil && index + 1 >= round.count
            let delay: UInt64 = isLastEmbedded ? 1_200_000_000 : 1_100_000_000
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: delay)
                if index == shownIndex && status == .correct && !done {
                    advance(finalScore: newScore)
                }
            }
            return
        }
        wrong += 1
        selected = nil
        shake()
        if wrong >= maxTries {
            if let line = puzzle.line, !ChessLogic.isFinalStep(puzzle, ply: ply), line.indices.contains(ply) {
                answer = line[ply]
            } else {
                answer = puzzle.mates.first
            }
            status = .revealed
            if embedded != nil && index + 1 >= round.count {
                let shownIndex = index
                let currentScore = score
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    if index == shownIndex && status == .revealed && !done {
                        advance(finalScore: currentScore)
                    }
                }
            }
        }
    }

    private func shake() {
        if reduceMotion { return }
        Task { @MainActor in
            let steps: [CGFloat] = [-8, 8, -5, 5, 0]
            for dx in steps {
                withAnimation(.linear(duration: 0.06)) { shakeOffset = dx }
                try? await Task.sleep(nanoseconds: 70_000_000)
            }
        }
    }

    private func advance(finalScore: Int) {
        if index + 1 >= round.count {
            isBest = GameStats.recordRound(.chess, score: finalScore)
            if let handler = embedded {
                done = true
                handler(finalScore)
                return
            }
            done = true
            return
        }
        index += 1
        wrong = 0
        status = .playing
        selected = nil
        answer = nil
        moves = []
        waiting = false
    }

    private func playAgain() {
        guard let data = data else { return }
        round = ChessLogic.buildRound(data.puzzles(forLevel: ChessData.currentLevel), count: GameStats.size(embedded: embedded != nil))
        index = 0
        score = 0
        wrong = 0
        status = .playing
        selected = nil
        answer = nil
        moves = []
        waiting = false
        isBest = false
        done = false
    }
}
