import SwiftUI

/// Memory: two small span games, digit span and a 3x3 pattern grid.
struct MemoryGameView: View {
    let onExit: () -> Void
    /// Set when played inside a set of cards: a short round that ends by calling this with the score. `onExit` then means skip.
    var embedded: ((Int) -> Void)? = nil

    private enum Mode {
        case digits
        case grid
    }

    private enum Phase {
        case menu
        case watch
        case turn
        case result
        case over
    }

    @State private var mode: Mode = .digits
    @State private var phase: Phase = .menu
    @State private var run = MemoryLogic.Run()
    @State private var sequence: [Int] = []
    @State private var shown: Int? = nil
    @State private var input: [Int] = []
    @State private var lastWasRight = true
    @State private var isNewBest = false
    /// Changing this restarts the timed task below; leaving the screen cancels it.
    @State private var token = 0
    @State private var short: MemoryLogic.ShortRound? = nil
    @State private var finished = false

    private let embeddedDoneSeconds = 1.2
    private let digitSeconds = 0.8
    private let tileSeconds = 0.6
    private let gapSeconds = 0.25
    private let introSeconds = 0.9
    private let resultSeconds = 1.1
    private let gridColumns: [GridItem] = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        VStack(spacing: 0) {
            if embedded != nil {
                embeddedBar
            } else {
                topBar
            }
            content
        }
        .task(id: token) {
            await runTimeline()
        }
        .onAppear {
            if embedded != nil && short == nil {
                startEmbedded()
            }
        }
    }

    private func startEmbedded() {
        let newShort = MemoryLogic.ShortRound(target: GameStats.embeddedRoundSize)
        short = newShort
        run = newShort.run
        mode = Bool.random() ? .digits : .grid
        isNewBest = false
        startRound()
    }

    // MARK: Timeline

    private func pause(_ seconds: Double) async -> Bool {
        do {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        } catch {
            return false
        }
        return !Task.isCancelled
    }

    private func runTimeline() async {
        if phase == .watch {
            let showFor = (mode == .digits) ? digitSeconds : tileSeconds
            if await pause(introSeconds) == false { return }
            for value in sequence {
                shown = value
                if await pause(showFor) == false { return }
                shown = nil
                if await pause(gapSeconds) == false { return }
            }
            input = []
            phase = .turn
        } else if phase == .result {
            if let current = short, let finish = embedded {
                let wait = current.done ? embeddedDoneSeconds : resultSeconds
                if await pause(wait) == false { return }
                if current.done {
                    if finished { return }
                    finished = true
                    // A short round inside a set of cards is not a run, so it is not saved as a best.
                    finish(current.score)
                } else {
                    startRound()
                }
                return
            }
            if await pause(resultSeconds) == false { return }
            if run.over {
                isNewBest = GameStats.recordRound(.memory, score: run.best, of: 0)
                phase = .over
            } else {
                startRound()
            }
        }
    }

    // MARK: Game flow

    private func startRound() {
        if mode == .digits {
            sequence = MemoryLogic.generateDigits(length: run.length)
        } else {
            sequence = MemoryLogic.generateTiles(length: run.length)
        }
        input = []
        shown = nil
        phase = .watch
        token += 1
    }

    private func start(_ newMode: Mode) {
        mode = newMode
        run = MemoryLogic.Run()
        isNewBest = false
        startRound()
    }

    private func finishRound(success: Bool) {
        if let current = short {
            let updated = MemoryLogic.applyShort(current, success: success)
            short = updated
            run = updated.run
        } else {
            run = MemoryLogic.apply(run, success: success)
        }
        lastWasRight = success
        phase = .result
        token += 1
    }

    private func press(_ value: Int) {
        if phase != .turn { return }
        let next = input + [value]
        input = next
        if mode == .grid && MemoryLogic.isPrefix(expected: sequence, given: next) == false {
            finishRound(success: false)
            return
        }
        if next.count == sequence.count {
            finishRound(success: MemoryLogic.checkAnswer(expected: sequence, given: next))
        }
    }

    private func backspace() {
        if phase == .turn && mode == .digits && input.isEmpty == false {
            input.removeLast()
        }
    }

    private func backToModes() {
        phase = .menu
        token += 1
    }

    // MARK: Views

    private var topBar: some View {
        HStack {
            Button(action: {
                if phase == .menu {
                    onExit()
                } else {
                    backToModes()
                }
            }) {
                Text("Back")
                    .frame(minWidth: 44, minHeight: 44)
            }
            Spacer()
            if phase != .menu && phase != .over {
                Text("Round \(run.round) \u{00B7} \(sequence.count) to remember")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var embeddedBar: some View {
        HStack {
            Text("A quick memory check")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
            Spacer()
            if let current = short {
                Text("\(min(current.played + 1, current.target)) of \(current.target)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Button(action: { onExit() }) {
                Text("Skip")
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 44, minHeight: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .menu:
            if embedded != nil {
                Spacer()
            } else {
                menuView
            }
        case .over:
            overView
        default:
            playView
        }
    }

    private var menuView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Memory").font(.largeTitle.weight(.semibold))
            Text("Pick one. Take your time.").foregroundStyle(.secondary)
            modeButton(title: "Digit span", subtitle: "Watch the digits, then type them back", mode: .digits)
            modeButton(title: "Pattern grid", subtitle: "Watch the tiles light up, then tap them in order", mode: .grid)
            if GameStats.plays(.memory) > 0 {
                Text("Your best: \(GameStats.best(.memory))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func modeButton(title: String, subtitle: String, mode: Mode) -> some View {
        Button(action: { start(mode) }) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(subtitle).font(.subheadline).opacity(0.9)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .foregroundStyle(Color.white)
            .background(Color.teal)
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
    }

    private var overView: some View {
        VStack(spacing: 12) {
            Spacer()
            Text(mode == .digits ? "Digit span" : "Pattern grid").foregroundStyle(.secondary)
            Text("\(run.best)").font(.system(size: 72, weight: .bold))
            Text(run.best > 0 ? "in a row remembered" : "Nice try. Warm up and go again.")
                .font(.title3)
            if isNewBest && run.best > 0 {
                Text("New best!").font(.headline).foregroundStyle(Color.teal)
            }
            Spacer().frame(height: 16)
            Button(action: { start(mode) }) {
                Text("Play again")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .foregroundStyle(Color.white)
                    .background(Color.teal)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            Button(action: { backToModes() }) {
                Text("Back to modes")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            Button(action: { onExit() }) {
                Text("Done for now")
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private var statusText: String {
        switch phase {
        case .watch:
            return "Watch..."
        case .turn:
            return "Your turn"
        case .result:
            if lastWasRight { return "Nice!" }
            return run.misses >= 1 ? "Not quite. One more try." : "Not quite."
        default:
            return ""
        }
    }

    private var playView: some View {
        VStack(spacing: 16) {
            Text(statusText)
                .font(.title3.weight(.medium))
                .padding(.top, 16)
            if mode == .digits {
                digitsPlay
            } else {
                gridPlay
            }
            Spacer()
        }
    }

    private var digitsPlay: some View {
        VStack(spacing: 16) {
            ZStack {
                if phase == .watch {
                    Text(shown == nil ? " " : "\(shown ?? 0)")
                        .font(.system(size: 96, weight: .bold))
                } else {
                    Text(input.isEmpty ? " " : String(repeating: "\u{2022}", count: input.count))
                        .font(.system(size: 44, weight: .bold))
                }
            }
            .frame(height: 160)
            LazyVGrid(columns: gridColumns, spacing: 12) {
                ForEach(1..<10, id: \.self) { n in
                    padKey(label: "\(n)", action: { press(n) })
                }
                Color.clear.frame(height: 64)
                padKey(label: "0", action: { press(0) })
                padKey(label: "\u{232B}", action: { backspace() })
            }
            .frame(maxWidth: 320)
            .padding(.horizontal, 16)
        }
    }

    private func padKey(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.title.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 64)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .disabled(phase != .turn)
        .opacity(phase == .turn ? 1 : 0.4)
    }

    private func tileColor(_ index: Int) -> Color {
        if phase == .watch && shown == index { return Color.teal }
        if phase == .result && input.last == index {
            return lastWasRight ? Color.teal : Color.red
        }
        // A clear grey, darker than the page, so the grid is easy to see before and after the tiles light up.
        return Color(.systemGray4)
    }

    private var gridPlay: some View {
        return LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(0..<MemoryLogic.gridTiles, id: \.self) { index in
                Button(action: { press(index) }) {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(tileColor(index))
                        .aspectRatio(1, contentMode: .fit)
                }
                .buttonStyle(.plain)
                // Not .disabled: iOS fades a disabled button to about a third, which made the grid hard to see while watching.
                .allowsHitTesting(phase == .turn)
                .accessibilityLabel("Tile \(index + 1)")
            }
        }
        .frame(maxWidth: 320)
        .padding(.horizontal, 16)
        .padding(.top, 24)
    }
}
