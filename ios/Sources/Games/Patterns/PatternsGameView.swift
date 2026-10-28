import SwiftUI

/// "What comes next?": number sequences, easy to hard (the round size, one inside a Game round). Pick the number that continues the pattern.
/// When `embedded` is set the game is played inside a set of cards: no end screen, `embedded(score)` is called when
/// the round is done, and `onExit` means "skip".
struct PatternsGameView: View {
    let onExit: () -> Void
    var embedded: ((Int) -> Void)? = nil

    @State private var round: [PatternPuzzle] = []
    @State private var index = 0
    @State private var picked: Int? = nil
    @State private var score = 0
    @State private var finished = false
    @State private var isBest = false
    @State private var loadFailed = false

    var body: some View {
        Group {
            if loadFailed {
                messageView
            } else if finished {
                endView
            } else if index < round.count {
                playView(round[index])
            } else {
                Color.clear
            }
        }
        .onAppear { startIfNeeded() }
    }

    // MARK: - Flow

    private func startIfNeeded() {
        if !round.isEmpty || loadFailed { return }
        startRound()
    }

    private func startRound() {
        let built = PatternsData.buildRound(from: PatternsData.load(), size: GameStats.size(embedded: embedded != nil))
        if built.isEmpty {
            loadFailed = true
            return
        }
        round = built
        index = 0
        picked = nil
        score = 0
        finished = false
        isBest = false
    }

    private func choose(_ value: Int, for puzzle: PatternPuzzle) {
        if picked != nil { return }
        picked = value
        if value == puzzle.answer { score += 1 }
    }

    private func advance() {
        if index + 1 >= round.count {
            isBest = GameStats.recordRound(.patterns, score: score)
            if let done = embedded {
                done(score)
                return
            }
            finished = true
        } else {
            index += 1
            picked = nil
        }
    }

    private func endLine() -> String {
        if score == round.count { return "Every one. Lovely." }
        if score * 10 >= round.count * 7 { return "Sharp eyes today." }
        if score * 10 >= round.count * 4 { return "Nice work. Patterns get easier the more you spot." }
        return "Good warm-up. A fresh round is always one tap away."
    }

    // MARK: - Screens

    private var messageView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("What comes next?").font(.largeTitle.weight(.semibold))
            Text("The puzzles didn't load. Please try again later.").foregroundStyle(.secondary)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(24)
    }

    private var endView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("\(score)/\(round.count)")
                .scaledFont(64, weight: .semibold, relativeTo: .largeTitle)
            Text(endLine()).font(.title3).multilineTextAlignment(.center)
            if isBest && score > 0 {
                Text("New best!").font(.subheadline.weight(.medium)).foregroundStyle(.teal)
            }
            Spacer()
            Button(action: { startRound() }) {
                Text("Play again").font(.title3.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(.teal)
            Button(action: onExit) {
                Text("Back").font(.title3.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(.bordered)
        }
        .padding(24)
    }

    private func playView(_ puzzle: PatternPuzzle) -> some View {
        VStack(spacing: 0) {
            HStack {
                if embedded != nil {
                    Text("A quick pattern puzzle")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(minHeight: 44)
                } else {
                    Button(action: onExit) { Text("← Back") }
                        .frame(minHeight: 44)
                }
                Spacer()
                Text("\(index + 1) of \(round.count)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if embedded != nil {
                    Button(action: onExit) { Text("Skip").font(.subheadline) }
                        .frame(minWidth: 44, minHeight: 44)
                }
            }

            GameProgressBar(done: index + (picked != nil ? 1 : 0), total: round.count)
                .padding(.top, 6)

            Text("What comes next?")
                .font(embedded != nil ? .title3.weight(.semibold) : .title2.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 16)

            sequenceRow(puzzle)
                .padding(.top, 24)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(puzzle.options, id: \.self) { option in
                    optionButton(option, puzzle: puzzle)
                }
            }
            .padding(.top, 32)

            if let chosen = picked {
                VStack(spacing: 4) {
                    Text(chosen == puzzle.answer ? "Yes, that's it!" : "Close. It was \(puzzle.answer).")
                        .font(.headline)
                    Text("\(puzzle.rule).")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 24)
            }

            Spacer(minLength: 16)

            if picked != nil {
                Button(action: { advance() }) {
                    Text(index + 1 >= round.count ? (embedded != nil ? "Continue" : "See my score") : "Next")
                        .font(.title3.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(.teal)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .answerHaptic(picked: picked != nil, correct: picked == puzzle.answer)
    }

    private func sequenceRow(_ puzzle: PatternPuzzle) -> some View {
        let columns = [GridItem(.adaptive(minimum: 52), spacing: 8)]
        return LazyVGrid(columns: columns, spacing: 8) {
            ForEach(Array(puzzle.shown.enumerated()), id: \.offset) { _, n in
                Text("\(n)")
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
            }
            Text(picked == nil ? "?" : "\(puzzle.answer)")
                .font(.title3.weight(.semibold).monospacedDigit())
                .foregroundStyle(.teal)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color.teal, style: StrokeStyle(lineWidth: 2, dash: [5]))
                )
        }
    }

    private func optionButton(_ option: Int, puzzle: PatternPuzzle) -> some View {
        var fill = Color(.secondarySystemBackground)
        var opacity = 1.0
        if let chosen = picked {
            if option == puzzle.answer {
                fill = Color.teal.opacity(0.25)
            } else if option == chosen {
                fill = Color.orange.opacity(0.25)
            } else {
                opacity = 0.5
            }
        }
        return Button(action: { choose(option, for: puzzle) }) {
            Text("\(option)")
                .scaledFont(30, weight: .semibold, relativeTo: .title, monospaced: true)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, minHeight: 80)
                .background(RoundedRectangle(cornerRadius: 16).fill(fill))
                .opacity(opacity)
        }
        .buttonStyle(.plain)
        .disabled(picked != nil)
        .answerPop(picked != nil && option == puzzle.answer)
    }
}
