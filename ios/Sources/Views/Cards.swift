import SwiftUI

// One view per card type. Cards are data: these views only render what the JSON says.

struct StoryCardView: View {
    let card: Card
    let panels: [String]
    let index: Int
    let total: Int
    let actions: SessionActions
    @State private var panel = 0

    private var last: Bool { panel == panels.count - 1 }

    var body: some View {
        CardShell(card: card, index: index, total: total, label: "Story", actions: actions, dim: panel > 0) {
            ZStack {
                // Tap zones: left third = back, the rest = forward. They sit below the top bar.
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        Color.clear.contentShape(Rectangle()).frame(width: geo.size.width / 3).onTapGesture { if panel > 0 { panel -= 1 } }
                        Color.clear.contentShape(Rectangle()).frame(width: geo.size.width * 2 / 3).onTapGesture { forward() }
                    }
                }
                .padding(.top, 100)
                .padding(.bottom, 56)

                VStack(alignment: .leading, spacing: 12) {
                    Spacer()
                    if panel == 0 { Text(card.title).font(.largeTitle.weight(.semibold)) }
                    Text(panels[panel])
                        .font(panel == 0 ? .body : .title3)
                        .foregroundStyle(.white.opacity(panel == 0 ? 0.85 : 1))
                        .frame(minHeight: 110, alignment: .topLeading)
                    HStack {
                        HStack(spacing: 6) {
                            ForEach(0..<panels.count, id: \.self) { i in
                                Capsule().fill(i == panel ? Color.white : Color.white.opacity(0.4)).frame(width: i == panel ? 20 : 6, height: 6)
                            }
                        }
                        Spacer()
                        Text(last ? "Tap for the next card" : "Tap to continue").font(.caption).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.trailing, 44)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
                .allowsHitTesting(false)
            }
        }
    }

    private func forward() {
        if !last { panel += 1; return }
        actions.complete(nil)
        actions.next()
    }
}

struct FactWhyCardView: View {
    let card: Card
    let claim: String
    let why: String
    let index: Int
    let total: Int
    let actions: SessionActions
    @State private var revealed = false

    var body: some View {
        CardShell(card: card, index: index, total: total, label: "Fact + why", actions: actions, dim: revealed) {
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text(card.title.uppercased()).font(.caption).tracking(1.5).foregroundStyle(.white.opacity(0.6))
                Text(claim).font(.title2.weight(.semibold))
                if revealed {
                    Text(why).font(.body).foregroundStyle(.white.opacity(0.9)).padding(.top, 6)
                    Button { actions.next() } label: { Text("Next").whitePill() }.padding(.top, 14)
                } else {
                    Button {
                        revealed = true
                        actions.complete(nil)
                    } label: { Text("Why?").whitePill() }.padding(.top, 14)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
    }
}

struct GuessFirstCardView: View {
    let card: Card
    let question: String
    let options: [String]
    let answer: Int
    let reveal: String
    let index: Int
    let total: Int
    let actions: SessionActions
    @State private var picked: Int?

    var body: some View {
        CardShell(card: card, index: index, total: total, label: "Guess first", actions: actions, dim: picked != nil) {
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text("TAKE A GUESS").font(.caption).tracking(1.5).foregroundStyle(.white.opacity(0.6))
                Text(question).font(.title2.weight(.semibold))
                VStack(spacing: 10) {
                    ForEach(options.indices, id: \.self) { i in
                        Button {
                            picked = i
                            actions.complete(i == answer)
                        } label: {
                            Text(options[i])
                                .font(.body.weight(.medium))
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(background(for: i), in: RoundedRectangle(cornerRadius: 16))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.3)))
                        }
                        .disabled(picked != nil)
                    }
                }
                .padding(.top, 8)
                if let picked {
                    Text("\(picked == answer ? "Nice, that's right. " : "Not quite. ")\(reveal)").font(.subheadline).foregroundStyle(.white.opacity(0.9))
                    Button { actions.next() } label: { Text("Next").whitePill() }.padding(.top, 6)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
    }

    private func background(for i: Int) -> Color {
        guard let picked else { return .white.opacity(0.15) }
        if i == answer { return .green.opacity(0.4) }
        if i == picked { return .red.opacity(0.35) }
        return .white.opacity(0.05)
    }
}

struct EstimateCardView: View {
    let card: Card
    let question: String
    let unit: String
    let lo: Double
    let hi: Double
    let scale: String
    let answer: Double
    let reveal: String
    let index: Int
    let total: Int
    let actions: SessionActions
    @State private var done = false

    var body: some View {
        CardShell(card: card, index: index, total: total, label: "Estimate", actions: actions, dim: true) {
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text("YOUR BEST ESTIMATE").font(.caption).tracking(1.5).foregroundStyle(.white.opacity(0.6))
                Text(question).font(.title3.weight(.semibold)).padding(.bottom, 12)
                SliderGuess(lo: lo, hi: hi, scale: scale, unit: unit, answer: answer) { score in
                    done = true
                    actions.complete(score >= 0.85)
                }
                if done {
                    Text(reveal).font(.subheadline).foregroundStyle(.white.opacity(0.9))
                    Button { actions.next() } label: { Text("Next").whitePill() }.padding(.top, 6)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
    }
}

/// Estimate slider: drag, lock in, see how close you were. Shared by Estimate and Recall cards.
struct SliderGuess: View {
    let lo: Double
    let hi: Double
    let scale: String
    let unit: String
    let answer: Double
    /// Called with closeness (0...1) after the user locks in.
    let onLock: (Double) -> Void
    @State private var t = 0.5
    @State private var locked = false

    private var value: Double { Scoring.tidy(Scoring.value(at: t, lo: lo, hi: hi, scale: scale)) }
    private var unitLabel: String { unit == "%" ? "%" : " \(unit)" }

    var body: some View {
        VStack(spacing: 12) {
            Text("\(Scoring.format(value))\(unitLabel)")
                .font(.system(size: 46, weight: .semibold))
                .monospacedDigit()
                .frame(maxWidth: .infinity)
            Slider(value: $t, in: 0...1)
                .tint(.white)
                .disabled(locked)
                .accessibilityLabel("Your estimate")
            HStack {
                Text(Scoring.format(lo))
                Spacer()
                Text(Scoring.format(hi))
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.6))

            if !locked {
                Button {
                    locked = true
                    onLock(Scoring.closeness(guess: value, answer: answer, lo: lo, hi: hi, scale: scale))
                } label: { Text("Lock it in").whitePill() }
            } else {
                let score = Scoring.closeness(guess: value, answer: answer, lo: lo, hi: hi, scale: scale)
                VStack(spacing: 4) {
                    Text("You said \(Scoring.format(value))\(unitLabel) · Answer \(Scoring.format(answer))\(unitLabel)").font(.footnote).foregroundStyle(.white.opacity(0.7))
                    Text(Scoring.closenessLabel(score)).font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }
}

/// A probe resurfaced later. Uses the source card's image as a visual cue.
struct RecallCardView: View {
    let card: Card
    let probe: Probe
    let index: Int
    let total: Int
    let actions: SessionActions
    @State private var answered: Bool?
    @State private var picked: Int?
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        CardShell(card: card, index: index, total: total, label: "Quick recall", actions: actions, dim: true) {
            VStack(alignment: .leading, spacing: 10) {
                Spacer()
                Text("QUICK ONE: DO YOU REMEMBER?").font(.caption).tracking(1.5).foregroundStyle(.white.opacity(0.6))
                Text(probe.question).font(.title3.weight(.semibold)).padding(.bottom, 10)
                input
                if let answered {
                    Text(answered ? "Nice, you remembered." : "Not this time. It'll come back soon.").font(.subheadline.weight(.medium)).padding(.top, 4)
                    Button { actions.next() } label: { Text("Next").whitePill() }.padding(.top, 6)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
    }

    private func finish(_ correct: Bool) {
        guard answered == nil else { return }
        answered = correct
        actions.complete(correct)
    }

    @ViewBuilder private var input: some View {
        switch probe.kind {
        case .mcq:
            VStack(spacing: 10) {
                ForEach((probe.options ?? []).indices, id: \.self) { i in
                    choice(probe.options![i], index: i, correct: { if case .index(let a) = probe.answer { return a == i } else { return false } }())
                }
            }
        case .tf:
            let truth: Bool = { if case .bool(let a) = probe.answer { return a } else { return true } }()
            VStack(spacing: 10) {
                choice("True", index: 0, correct: truth)
                choice("False", index: 1, correct: !truth)
            }
        case .cloze:
            VStack(spacing: 10) {
                TextField("Type your answer", text: $text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .padding(14)
                    .background(.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
                    .disabled(answered != nil)
                    .onSubmit(checkCloze)
                if answered == nil {
                    Button(action: checkCloze) { Text("Check").whitePill() }
                }
            }
        case .estimate:
            if case .number(let a) = probe.answer {
                SliderGuess(lo: probe.lo ?? 0, hi: probe.hi ?? 100, scale: probe.scale ?? "linear", unit: probe.unit ?? "", answer: a) { score in
                    finish(score >= 0.85)
                }
            }
        }
    }

    private func choice(_ label: String, index: Int, correct: Bool) -> some View {
        Button {
            picked = index
            finish(correct)
        } label: {
            Text(label)
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(choiceBackground(index: index, correct: correct), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.3)))
        }
        .disabled(answered != nil)
    }

    private func choiceBackground(index: Int, correct: Bool) -> Color {
        guard answered != nil else { return .white.opacity(0.15) }
        if correct { return .green.opacity(0.4) }
        if picked == index { return .red.opacity(0.35) }
        return .white.opacity(0.05)
    }

    private func checkCloze() {
        guard answered == nil, !text.trimmingCharacters(in: .whitespaces).isEmpty, case .text(let answer) = probe.answer else { return }
        let accepted = ([answer] + (probe.accept ?? [])).map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        finish(accepted.contains(text.trimmingCharacters(in: .whitespaces).lowercased()))
    }
}
