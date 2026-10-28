import SwiftUI

/// A horizontal shake used when a guess is wrong.
struct WordsShakeEffect: GeometryEffect {
    var shakes: CGFloat

    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let offset = 10 * sin(shakes * .pi * 6)
        return ProjectionTransform(CGAffineTransform(translationX: offset, y: 0))
    }
}

private enum WordStatus {
    case playing, wrong, correct, skipped
}

struct WordsGameView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let onExit: () -> Void
    /// Set when played inside a set of cards: called with the score when the round is finished.
    var embedded: ((Int) -> Void)? = nil

    @State private var round: [WordPuzzle]
    @State private var index = 0
    @State private var placed: [Int] = []
    @State private var status: WordStatus = .playing
    @State private var hinted = false
    @State private var score = 0
    @State private var finished = false
    @State private var isBest = false
    @State private var shakeCount = 0
    @State private var recorded = false

    init(onExit: @escaping () -> Void, embedded: ((Int) -> Void)? = nil) {
        self.onExit = onExit
        self.embedded = embedded
        _round = State(initialValue: WordsGameView.makeRound(embedded: embedded != nil))
    }

    private static func makeRound(embedded: Bool) -> [WordPuzzle] {
        var rng = SystemRandomNumberGenerator()
        return WordsLogic.buildRound(WordsLogic.loadPuzzles(), size: GameStats.size(embedded: embedded), using: &rng)
    }

    private var locked: Bool { status == .correct || status == .skipped }

    var body: some View {
        Group {
            if round.isEmpty {
                emptyView
            } else if finished {
                endView
            } else {
                playView(round[index])
            }
        }
        .background(Color(.systemBackground))
    }

    // MARK: Screens

    private var emptyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Word scramble").font(.title.weight(.semibold))
            Text("The words are not available right now.").foregroundStyle(.secondary)
            Button(embedded != nil ? "Skip" : "Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(24)
    }

    private var endView: some View {
        VStack(spacing: 12) {
            Spacer()
            Text(score >= round.count - 1 ? "🌟" : "🔤").font(.system(size: 64)).accessibilityHidden(true)
            Text("Nice round!").font(.title.weight(.semibold))
            Text("\(score) / \(round.count)")
                .scaledFont(52, weight: .bold, relativeTo: .largeTitle)
                .monospacedDigit()
            Text(isBest ? "That's a new best for you." : "Every word is practice.")
                .foregroundStyle(.secondary)
            Spacer().frame(height: 16)
            Button(action: playAgain) {
                Text("Play again")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(.teal)
            Button(action: onExit) {
                Text("Back")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private func playView(_ puzzle: WordPuzzle) -> some View {
        let slots = puzzle.answer.count
        let scrambleChars = Array(puzzle.scramble)
        let answerChars = Array(puzzle.answer)
        return VStack(spacing: 0) {
            if embedded != nil {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A quick word puzzle")
                            .font(.headline)
                        Text("Word \(index + 1) of \(round.count) · \(score) pts")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(action: onExit) {
                        Text("Skip")
                            .font(.subheadline.weight(.semibold))
                            .frame(minWidth: 44, minHeight: 44)
                    }
                }
                .padding(.horizontal, 20)
            } else {
                HStack {
                    Button(action: onExit) {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Back")
                    Spacer()
                    Text("Word \(index + 1) of \(round.count)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(score) pts")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .frame(minWidth: 44, alignment: .trailing)
                }
                .padding(.horizontal, 12)
            }

            Spacer()

            Text((hinted || locked) ? puzzle.clue : "Tap the letters in order to spell the word.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(minHeight: 56)
                .padding(.horizontal, 32)
                .padding(.bottom, 24)

            // Answer slots
            HStack(spacing: 6) {
                ForEach(0..<slots, id: \.self) { slot in
                    slotView(slot: slot, scrambleChars: scrambleChars, answerChars: answerChars)
                }
            }
            .padding(.horizontal, 16)
            .modifier(WordsShakeEffect(shakes: CGFloat(shakeCount)))
            .padding(.bottom, 32)

            // Scrambled tiles
            HStack(spacing: 6) {
                ForEach(0..<scrambleChars.count, id: \.self) { tile in
                    tileView(tile: tile, letter: scrambleChars[tile], puzzle: puzzle)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)

            messageView(puzzle)
                .frame(minHeight: 24)
                .padding(.horizontal, 24)

            Spacer()

            bottomButtons
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
        }
    }

    private func slotView(slot: Int, scrambleChars: [Character], answerChars: [Character]) -> some View {
        var letter = ""
        if status == .skipped {
            letter = String(answerChars[slot])
        } else if slot < placed.count {
            letter = String(scrambleChars[placed[slot]])
        }
        let filled = slot < placed.count
        return Button(action: { tapSlot(slot) }) {
            Text(letter)
                .font(.system(size: 26, weight: .bold))
                .frame(maxWidth: 48, minHeight: 56)
                .background(slotFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(slotStroke, lineWidth: 2)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(locked || !filled)
        .accessibilityLabel(letter.isEmpty ? "Empty slot \(slot + 1)" : "Letter \(slot + 1): \(letter). Tap to take back.")
    }

    private func tileView(tile: Int, letter: Character, puzzle: WordPuzzle) -> some View {
        let used = placed.contains(tile)
        return Button(action: { tapTile(tile, puzzle: puzzle) }) {
            Text(String(letter))
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(used ? Color.clear : Color.white)
                .frame(maxWidth: 48, minHeight: 56)
                .background(used ? Color.gray.opacity(0.2) : Color.teal)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(used || locked)
        .accessibilityLabel(String(letter))
    }

    private var slotFill: Color {
        switch status {
        case .correct: return Color.teal.opacity(0.18)
        case .skipped: return Color.gray.opacity(0.2)
        case .wrong: return Color.red.opacity(0.1)
        case .playing: return Color(.secondarySystemBackground)
        }
    }

    private var slotStroke: Color {
        switch status {
        case .correct: return Color.teal
        case .skipped: return Color.gray
        case .wrong: return Color.red.opacity(0.7)
        case .playing: return Color.gray.opacity(0.4)
        }
    }

    @ViewBuilder
    private func messageView(_ puzzle: WordPuzzle) -> some View {
        switch status {
        case .wrong:
            Text("Not quite. Tap a letter to swap it.")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.red)
        case .correct:
            Text(hinted ? "Got it! No point this time, but you got there." : "Got it! +1")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.teal)
        case .skipped:
            Text("That one was \(puzzle.answer). On to the next.")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
        case .playing:
            Text(" ").font(.subheadline)
        }
    }

    private var bottomButtons: some View {
        HStack(spacing: 12) {
            if locked && embedded != nil && index + 1 >= round.count {
                Text("All done!")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 48)
            } else if locked {
                Button(action: next) {
                    Text(index + 1 < round.count ? "Next word" : "See my score")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(.teal)
            } else {
                Button(action: { hinted = true }) {
                    Text("Hint (-1)")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                .disabled(hinted)
                Button(action: skip) {
                    Text("Skip")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: Actions

    private func tapTile(_ tile: Int, puzzle: WordPuzzle) {
        if locked { return }
        let slots = puzzle.answer.count
        let updated = WordsLogic.placeTile(placed, tile: tile, slots: slots)
        placed = updated
        if status == .wrong { status = .playing }
        if updated.count == slots {
            let guess = WordsLogic.letters(of: puzzle.scramble, placed: updated)
            if WordsLogic.isCorrect(puzzle, guess: guess) {
                score += WordsLogic.wordPoints(solved: true, usedHint: hinted)
                status = .correct
                finishIfEmbeddedAndLast()
            } else {
                status = .wrong
                if reduceMotion {
                    shakeCount += 1
                } else {
                    withAnimation(.linear(duration: 0.4)) {
                        shakeCount += 1
                    }
                }
            }
        }
    }

    private func tapSlot(_ slot: Int) {
        if locked || slot >= placed.count { return }
        placed = WordsLogic.removeSlot(placed, slot: slot)
        if status == .wrong { status = .playing }
    }

    private func skip() {
        placed = []
        status = .skipped
        finishIfEmbeddedAndLast()
    }

    /// Embedded: after the last word, wait a moment, record the round once and report the score.
    private func finishIfEmbeddedAndLast() {
        guard let done = embedded else { return }
        if index + 1 < round.count { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            if recorded { return }
            recorded = true
            _ = GameStats.recordRound(.words, score: score)
            done(score)
        }
    }

    private func next() {
        if index + 1 < round.count {
            index += 1
            placed = []
            status = .playing
            hinted = false
            return
        }
        if !recorded {
            recorded = true
            isBest = GameStats.recordRound(.words, score: score)
        }
        finished = true
    }

    private func playAgain() {
        round = WordsGameView.makeRound(embedded: embedded != nil)
        index = 0
        placed = []
        status = .playing
        hinted = false
        score = 0
        isBest = false
        recorded = false
        finished = false
    }
}
