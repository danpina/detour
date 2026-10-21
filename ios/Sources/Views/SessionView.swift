import SwiftUI

/// Plays one set of cards, then shows the end screen (or rolls straight into the next set in free-scroll mode).
struct SessionView: View {
    @Environment(AppModel.self) private var model
    let run: SessionRun
    /// Called when a set is finished. Returns the minutes the guarded apps were unlocked for, if the guard is on.
    let onSetFinished: () -> Int?
    let onAnother: () -> Void
    let onProgress: () -> Void
    let onNextFeedSet: () -> Void
    let onClose: () -> Void

    @State private var index = 0
    @State private var done = Set<String>()
    @State private var shownAt = Date()
    @State private var finishedCount: Int?
    @State private var unlockedMinutes: Int?

    private var items: [SessionItem] { run.items }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                if let finishedCount {
                    EndView(learned: finishedCount, unlockedMinutes: unlockedMinutes, onAnother: onAnother, onProgress: onProgress, onDone: onClose)
                } else if items.indices.contains(index) {
                    screen(for: items[index])
                        .id(items[index].key)
                        .transition(.opacity)
                }
            }

            // Its own strip below the card, so it never covers an answer.
            if run.feed && finishedCount == nil {
                Button("Done for now", action: onClose)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.black)
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
            unlockedMinutes = onSetFinished()
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
    var unlockedMinutes: Int? = nil
    let onAnother: () -> Void
    let onProgress: () -> Void
    let onDone: () -> Void

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
            if let unlockedMinutes {
                Text("You're through. Your apps are open for \(unlockedMinutes) minutes. Tap Done, then switch back to your app (iOS won't let Detour open it for you).")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
            }
            Spacer().frame(height: 24)
            if unlockedMinutes != nil {
                // Guarded-app flow: finishing is the point, so "Done" is the main button and the loop is optional.
                Button(action: onDone) { Text("Done").whitePill() }
                Button(action: onAnother) {
                    Text("Another quick one").font(.body).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 12)
                }
            } else {
                Button(action: onAnother) { Text("Another quick one").whitePill() }
                Button(action: onDone) {
                    Text("Done for now").font(.body).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 12)
                }
            }
            Button(action: onProgress) {
                Text("See my progress").font(.body).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 4)
            }
            Spacer()
        }
        .padding(.horizontal, 32)
        .foregroundStyle(.white)
    }
}
