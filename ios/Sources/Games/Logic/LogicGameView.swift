import SwiftUI

/// Logic: syllogisms, named fallacies, ordering and small truth puzzles. Puzzles you miss come back; harder ones open as you solve.
/// When `embedded` is set the game is played inside a set of cards: no end screen, Skip calls onExit.
struct LogicGameView: View {
    let onExit: () -> Void
    var embedded: ((Int) -> Void)? = nil

    @State private var items: [LogicItem] = []
    @State private var progress = LogicProgress()
    @State private var round: [LogicItem] = []
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
                items = LogicData.load()
                progress = LogicStore.load()
                startRound()
            }
        }
    }

    private func startRound() {
        var rng = SystemRandomNumberGenerator()
        round = LogicBuilder.round(all: items, progress: progress, length: GameStats.size(embedded: embedded != nil), using: &rng)
        index = 0
        score = 0
        picked = nil
        isBest = false
    }

    private var unavailable: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Logic is not available right now.").foregroundStyle(.secondary)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
    }

    private var finished: some View {
        VStack(spacing: 18) {
            Spacer()
            Text("🧩").font(.system(size: 64)).accessibilityHidden(true)
            Text("\(score) / \(round.count)").font(.largeTitle.weight(.semibold))
            Text(endLine).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Text("\(progress.solved.values.filter { $0 > 0 }.count) of \(items.count) puzzles solved").font(.subheadline).foregroundStyle(.secondary)
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
        if score == total { return "Sharp thinking. Not one slip." }
        if Double(score) >= Double(total) * 0.7 { return "Nicely reasoned." }
        if Double(score) >= Double(total) * 0.4 { return "Good run. The ones you missed will come back." }
        return "Tricky ones. They come back until they click. Go again?"
    }

    private func questionView(_ q: LogicItem) -> some View {
        let answered = picked != nil
        let isLast = index == round.count - 1
        return ScrollView {
            VStack(spacing: 0) {
                HStack {
                    if embedded != nil {
                        Text("A little logic").fontWeight(.medium).frame(minHeight: 44)
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

                VStack(spacing: 8) {
                    Text(LogicBuilder.title(forKind: q.kind)).foregroundStyle(.secondary)
                    Text(q.prompt)
                        .scaledFont(21, weight: .semibold, relativeTo: .title3)
                        .multilineTextAlignment(.center)
                }
                .padding(.vertical, 28)

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
                        Text(picked == q.answer ? "Yes!" : "Not this time.").font(.headline)
                        Text(q.why).foregroundStyle(.secondary)
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
    }

    private func optionBackground(_ option: String, in q: LogicItem) -> Color {
        guard picked != nil else { return Color(.secondarySystemBackground) }
        if option == q.answer { return Color.green.opacity(0.25) }
        if option == picked { return Color.red.opacity(0.22) }
        return Color(.secondarySystemBackground).opacity(0.5)
    }

    private func optionBorder(_ option: String, in q: LogicItem) -> Color {
        guard picked != nil else { return Color.clear }
        if option == q.answer { return Color.green }
        if option == picked { return Color.red }
        return Color.clear
    }

    private func choose(_ option: String, in q: LogicItem) {
        if picked != nil { return }
        picked = option
        let right = option == q.answer
        if right { score += 1 }
        progress = LogicBuilder.apply(progress, id: q.id, right: right)
        LogicStore.save(progress)
    }

    private func next(isLast: Bool) {
        if isLast {
            isBest = GameStats.recordRound(.logic, score: score)
            if let done = embedded {
                done(score)
                return
            }
        }
        picked = nil
        index += 1
    }
}
