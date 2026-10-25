import SwiftUI

/// Spanish vocabulary: words you miss come back until they stick, and each word moves from recognising to recalling to using it.
/// When `embedded` is set the game is played inside a set of cards: no end screen, Skip calls onExit.
struct SpanishGameView: View {
    let onExit: () -> Void
    var embedded: ((Int) -> Void)? = nil

    @State private var words: [SpanishWord] = []
    @State private var progress = SpanishProgress()
    @State private var round: [SpanishQuestion] = []
    @State private var index = 0
    @State private var score = 0
    @State private var picked: String? = nil
    @State private var isBest = false
    @State private var started = false

    var body: some View {
        VStack(spacing: 0) {
            if round.isEmpty {
                unavailable
            } else if index >= round.count {
                if embedded == nil { finished }
            } else {
                questionView(round[index])
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            if !started {
                started = true
                words = SpanishData.load()
                progress = SpanishStore.load()
                startRound()
            }
        }
    }

    private func startRound() {
        var rng = SystemRandomNumberGenerator()
        round = SpanishBuilder.round(all: words, progress: progress, length: GameStats.roundSize, using: &rng)
        index = 0
        score = 0
        picked = nil
        isBest = false
    }

    private var learned: Int {
        words.filter { (progress.known[$0.key] ?? 0) >= SpanishBuilder.learnedAt }.count
    }

    private var unavailable: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Spanish is not available right now.").foregroundStyle(.secondary)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
    }

    private var finished: some View {
        VStack(spacing: 18) {
            Spacer()
            Text("🇪🇸").font(.system(size: 64))
            Text("\(score) / \(round.count)").font(.largeTitle.weight(.semibold))
            Text(endLine).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Text("\(learned) of \(words.count) words learned").font(.subheadline).foregroundStyle(.secondary)
            if isBest {
                Text("New best!").font(.subheadline.weight(.medium)).foregroundStyle(.tint)
            }
            Spacer()
            VStack(spacing: 12) {
                Button(action: { startRound() }) {
                    Text("Play again").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.borderedProminent)
                Button(action: onExit) {
                    Text("Back").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.bordered)
            }
            .padding(.bottom, 24)
        }
        .padding(.horizontal, 24)
    }

    private var endLine: String {
        let total = round.count
        if score == total { return "¡Perfecto! Not one slip." }
        if Double(score) >= Double(total) * 0.7 { return "¡Muy bien! Those words are sticking." }
        if Double(score) >= Double(total) * 0.4 { return "Good run. The tricky ones will come back to help." }
        return "Every word you miss comes back until it sticks. Go again?"
    }

    private func questionView(_ q: SpanishQuestion) -> some View {
        let answered = picked != nil
        let isLast = index == round.count - 1
        return VStack(spacing: 0) {
            HStack {
                if embedded != nil {
                    Text("A little Spanish").fontWeight(.medium).frame(minHeight: 44)
                    Spacer()
                    Text("\(index + 1) / \(round.count)")
                    Spacer()
                    Button("Skip", action: onExit).frame(minHeight: 44)
                } else {
                    Button("Back", action: onExit).frame(minHeight: 44)
                    Spacer()
                    Text("\(index + 1) / \(round.count)")
                    Spacer()
                    Text("Score \(score)")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            GameProgressBar(done: index + (answered ? 1 : 0), total: round.count)
                .padding(.top, 6)

            Spacer(minLength: 8)
            VStack(spacing: 8) {
                Text(q.title).foregroundStyle(.secondary)
                Text(q.kind == .toEs ? q.prompt + "?" : q.prompt)
                    .font(.system(size: q.kind == .cloze ? 26 : 34, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
                if let hint = q.hint {
                    Text(hint).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
            }
            Spacer(minLength: 8)

            VStack(spacing: 12) {
                ForEach(q.options, id: \.self) { option in
                    Button(action: { choose(option, in: q) }) {
                        Text(option)
                            .font(.title3.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                            .padding(.horizontal, 16)
                            .background(optionBackground(option, in: q))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(optionBorder(option, in: q), lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.primary)
                    .disabled(answered)
                    .answerPop(answered && option == q.answer)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                if answered {
                    Text(picked == q.answer ? "¡Sí!" : "Not this time.").font(.headline)
                    Text(q.fact).foregroundStyle(.secondary)
                    Button(action: { next(isLast: isLast) }) {
                        Text(isLast ? (embedded != nil ? "Continue" : "See my score") : "Next").font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 6)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
            .padding(.top, 12)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 12)
        .answerHaptic(picked: picked != nil, correct: picked == q.answer)
    }

    private func optionBackground(_ option: String, in q: SpanishQuestion) -> Color {
        guard picked != nil else { return Color(.secondarySystemBackground) }
        if option == q.answer { return Color.green.opacity(0.25) }
        if option == picked { return Color.red.opacity(0.22) }
        return Color(.secondarySystemBackground).opacity(0.5)
    }

    private func optionBorder(_ option: String, in q: SpanishQuestion) -> Color {
        guard picked != nil else { return Color.clear }
        if option == q.answer { return Color.green }
        if option == picked { return Color.red }
        return Color.clear
    }

    private func choose(_ option: String, in q: SpanishQuestion) {
        if picked != nil { return }
        picked = option
        let right = option == q.answer
        if right { score += 1 }
        progress = SpanishBuilder.apply(progress, key: q.key, right: right)
        SpanishStore.save(progress)
    }

    private func next(isLast: Bool) {
        if isLast {
            isBest = GameStats.recordRound(.spanish, score: score)
            if let done = embedded {
                done(score)
                return
            }
        }
        picked = nil
        index += 1
    }
}
