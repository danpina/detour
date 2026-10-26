import SwiftUI

/// A skill-drill round: 3 timed mental-math problems or 2 estimation questions. Generated from rules, no image.
struct DrillView: View {
    @Environment(AppModel.self) private var model
    let spec: DrillSpec
    let index: Int
    let total: Int
    let actions: SessionActions

    @State private var problems: [DrillProblem] = []
    @State private var current = 0
    @State private var answers: [Drills.Judgement] = []
    @State private var input = ""
    @State private var feedback: Drills.Judgement?
    @State private var summary: (progress: SkillProgress, leveledUp: Bool, right: Int)?
    @State private var remaining: Double = 0
    @State private var finished = false
    @FocusState private var focused: Bool

    private var info: TrackInfo { Drills.info(spec.track) }
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    private var gradient: LinearGradient {
        LinearGradient(
            colors: spec.track != .estimation ? [Color(red: 0.19, green: 0.18, blue: 0.51), .black] : [Color(red: 0.02, green: 0.37, blue: 0.27), .black],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    }

    var body: some View {
        ZStack {
            gradient.ignoresSafeArea()

            VStack(spacing: 10) {
                HStack(spacing: 4) {
                    ForEach(0..<total, id: \.self) { i in
                        Capsule().fill(i <= index ? Color.white.opacity(i == index ? 0.9 : 1) : Color.white.opacity(0.3)).frame(height: 4)
                    }
                }
                HStack {
                    chip("Drill · \(info.name)")
                    Spacer()
                    chip("Level \(spec.level)")
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .frame(maxHeight: .infinity, alignment: .top)

            content
                .padding(.horizontal, 24)
                .padding(.top, 90)
                .padding(.bottom, 24)
        }
        .foregroundStyle(.white)
        .onAppear {
            problems = Drills.generateRound(spec)
            remaining = info.timeLimitSeconds ?? 0
            focused = true
        }
        .onReceive(tick) { _ in
            guard let limit = info.timeLimitSeconds, !finished, feedback == nil, !problems.isEmpty else { return }
            remaining = max(0, remaining - 0.1)
            if remaining <= 0 && limit > 0 { finish(answers) }
        }
    }

    @ViewBuilder private var content: some View {
        if let summary {
            summaryView(summary)
        } else if problems.indices.contains(current) {
            let problem = problems[current]
            VStack(spacing: 14) {
                Spacer()
                Text("\(info.levels[spec.level - 1]) · \(current + 1) of \(problems.count)".uppercased())
                    .font(.caption)
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.6))
                if let limit = info.timeLimitSeconds {
                    ProgressViewBar(fraction: remaining / limit)
                }
                Text(problem.prompt)
                    .font(.system(size: spec.track != .estimation ? (problem.prompt.count <= 14 ? 48 : 30) : 22, weight: .semibold))
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)
                TextField(spec.track != .estimation ? "Your answer" : "Your best guess (try 5k or 2m)", text: $input)
                    .keyboardType(spec.track != .estimation ? .decimalPad : .numbersAndPunctuation)
                    .multilineTextAlignment(.center)
                    .font(.title2)
                    .padding(14)
                    .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .focused($focused)
                    .disabled(feedback != nil)
                    .onSubmit { check(problem) }
                if let feedback {
                    feedbackView(feedback, problem: problem)
                } else {
                    Button { check(problem) } label: { Text("Check").whitePill() }
                        .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(input.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
                }
                Spacer()
            }
        }
    }

    private func feedbackView(_ f: Drills.Judgement, problem: DrillProblem) -> some View {
        VStack(spacing: 6) {
            Text("\(f.correct ? "✓ " : "✗ ")\(f.note)")
                .font(.headline)
                .foregroundStyle(f.correct ? Color.green : Color.red)
            if spec.track == .estimation, let guess = f.guess {
                Text("You said \(Scoring.format(guess)) · answer \(Scoring.format(problem.answer)) (\(String(format: "%.1f", Scoring.timesOff(guess, problem.answer)))× off)")
                    .font(.footnote).foregroundStyle(.white.opacity(0.8))
            } else {
                Text("Answer: \(Scoring.format(problem.answer))").font(.footnote).foregroundStyle(.white.opacity(0.8))
            }
            if let hint = problem.hint { Text(hint).font(.footnote).foregroundStyle(.white.opacity(0.7)).multilineTextAlignment(.center) }
            Button(action: advance) { Text(current + 1 >= problems.count ? "Finish" : "Next question").whitePill() }.padding(.top, 8)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }

    private func summaryView(_ s: (progress: SkillProgress, leveledUp: Bool, right: Int)) -> some View {
        VStack(spacing: 10) {
            Spacer()
            Text(info.name.uppercased()).font(.caption).tracking(1.5).foregroundStyle(.white.opacity(0.6))
            Text("\(s.right) of \(problems.count) right").font(.largeTitle.weight(.semibold))
            if s.leveledUp {
                Text("Level up! You're now on level \(s.progress.level): \(info.levels[s.progress.level - 1]).")
                    .padding(14)
                    .background(.green.opacity(0.25), in: RoundedRectangle(cornerRadius: 16))
                    .multilineTextAlignment(.center)
            } else {
                Text("Level \(s.progress.level): \(s.progress.recentResults.filter { $0 }.count) of your last \(s.progress.recentResults.count) right.")
                    .foregroundStyle(.white.opacity(0.85))
                Text(s.progress.level >= info.maxLevel ? "You're on the top level." : "Level up at 80% over 20 attempts.")
                    .font(.footnote).foregroundStyle(.white.opacity(0.6))
            }
            Button { actions.next() } label: { Text("Next").whitePill() }.padding(.top, 24)
            Spacer()
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(.caption).foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 10).padding(.vertical, 5).background(.black.opacity(0.4), in: Capsule())
    }

    // MARK: Flow

    private func check(_ problem: DrillProblem) {
        guard feedback == nil, !input.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let judgement = Drills.judge(spec.track, problem, input: input)
        feedback = judgement
        answers.append(judgement)
    }

    private func advance() {
        let all = answers
        feedback = nil
        input = ""
        if current + 1 >= problems.count { finish(all) } else {
            current += 1
            focused = true
        }
    }

    private func finish(_ all: [Drills.Judgement]) {
        guard !finished else { return }
        finished = true
        // Unanswered problems (time ran out) count as wrong attempts.
        let results = problems.indices.map { all.indices.contains($0) ? all[$0].correct : false }
        let right = results.filter { $0 }.count
        let out = model.recordDrillRound(track: spec.track, results: results)
        summary = (out.progress, out.leveledUp, right)
        actions.complete(right >= (problems.count + 1) / 2)
    }
}

struct ProgressViewBar: View {
    let fraction: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.15))
                Capsule().fill(.white.opacity(0.8)).frame(width: geo.size.width * max(0, min(1, fraction)))
            }
        }
        .frame(height: 6)
        .accessibilityLabel("Time left")
    }
}
