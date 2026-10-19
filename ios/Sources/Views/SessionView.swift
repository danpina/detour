import SwiftUI

/// Plays one set of cards, then shows the end screen (or rolls straight into the next set in free-scroll mode).
struct SessionView: View {
    @Environment(AppModel.self) private var model
    let run: SessionRun
    let onAnother: () -> Void
    let onProgress: () -> Void
    let onNextFeedSet: () -> Void
    let onClose: () -> Void

    @State private var index = 0
    @State private var done = Set<String>()
    @State private var shownAt = Date()
    @State private var finishedCount: Int?

    private var items: [SessionItem] { run.items }

    var body: some View {
        ZStack {
            if let finishedCount {
                EndView(learned: finishedCount, onAnother: onAnother, onProgress: onProgress)
            } else if items.indices.contains(index) {
                screen(for: items[index])
                    .id(items[index].key)
                    .transition(.opacity)
            }

            if run.feed && finishedCount == nil {
                Button("Done for now", action: onClose)
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.black.opacity(0.5), in: Capsule())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .padding(14)
            }
        }
        .background(Color.black.ignoresSafeArea())
        .onAppear { shown() }
        .onChange(of: index) { _, _ in shown() }
    }

    // MARK: Flow

    private func shown() {
        guard items.indices.contains(index) else { return }
        shownAt = Date()
        model.viewed(items[index])
    }

    private var actions: SessionActions {
        SessionActions(
            complete: { correct in complete(correct) },
            next: { next() },
            previous: { index = max(0, index - 1) }
        )
    }

    private func complete(_ correct: Bool?) {
        guard items.indices.contains(index) else { return }
        let item = items[index]
        guard !done.contains(item.key) else { return }
        done.insert(item.key)
        model.completed(item, correct: correct, ms: Int(Date().timeIntervalSince(shownAt) * 1000))
    }

    private func next() {
        guard items.indices.contains(index) else { return }
        let item = items[index]
        if !done.contains(item.key) {
            model.skipped(item, ms: Int(Date().timeIntervalSince(shownAt) * 1000))
        }
        if index + 1 >= items.count {
            model.sessionFinished(cardsDone: done.count, source: "free")
            if run.feed { onNextFeedSet() } else { finishedCount = done.count }
        } else {
            index += 1
        }
    }

    // MARK: Screens

    @ViewBuilder private func screen(for item: SessionItem) -> some View {
        let total = items.count
        switch item {
        case .drill(let spec):
            DrillView(spec: spec, index: index, total: total, actions: actions)
        case .review(let card, let probe, _):
            RecallCardView(card: card, probe: probe, index: index, total: total, actions: actions)
        case .new(let card):
            switch card.body {
            case .story(let panels):
                StoryCardView(card: card, panels: panels, index: index, total: total, actions: actions)
            case .factWhy(let claim, let why):
                FactWhyCardView(card: card, claim: claim, why: why, index: index, total: total, actions: actions)
            case .guessFirst(let question, let options, let answer, let reveal):
                GuessFirstCardView(card: card, question: question, options: options, answer: answer, reveal: reveal, index: index, total: total, actions: actions)
            case .estimate(let question, let unit, let lo, let hi, let scale, let answer, let reveal):
                EstimateCardView(card: card, question: question, unit: unit, lo: lo, hi: hi, scale: scale, answer: answer, reveal: reveal, index: index, total: total, actions: actions)
            }
        }
    }
}

struct EndView: View {
    let learned: Int
    let onAnother: () -> Void
    let onProgress: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("✨").font(.system(size: 56))
            Text("You learned \(learned > 0 ? learned : 5) things.")
                .font(.largeTitle.weight(.semibold))
                .multilineTextAlignment(.center)
            Text("We'll check tomorrow if they stuck.")
                .font(.title3)
                .foregroundStyle(.white.opacity(0.7))
            Spacer().frame(height: 24)
            Button(action: onAnother) { Text("Another quick one").whitePill() }
            Button(action: onProgress) {
                Text("See my progress").font(.body).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 12)
            }
            Spacer()
        }
        .padding(.horizontal, 32)
        .foregroundStyle(.white)
    }
}
