import SwiftUI

/// Progress, in three parts that match the three rounds on the home screen: Learning (cards), Math (skills with levels) and Games.
struct ProgressScreen: View {
    @Environment(AppModel.self) private var model

    private enum Part: String, CaseIterable, Identifiable {
        case learning = "📚 Learning"
        case math = "🔢 Math"
        case games = "🎮 Games"
        var id: String { rawValue }
    }

    @State private var section: Part = .learning

    /// What the coloured squares say, in words: "12 cards: 3 locked in, 2 sticking, 5 seen, 2 not yet".
    private func mapSummary(_ cards: [(id: String, state: ProgressStats.CardState)]) -> String {
        let parts: [(ProgressStats.CardState, String)] = [(.solid, "locked in"), (.learning, "sticking"), (.seen, "seen"), (.new, "not yet")]
        return "\(cards.count) cards: " + parts.map { state, name in "\(cards.filter { $0.state == state }.count) \(name)" }.joined(separator: ", ")
    }

    private func color(_ state: ProgressStats.CardState) -> Color {
        switch state {
        case .new: return .clear
        case .seen: return Color.accentColor.opacity(0.25)
        case .learning: return Color.accentColor.opacity(0.6)
        case .solid: return Color.accentColor
        }
    }

    var body: some View {
        let snapshot = model.progress()
        NavigationStack {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Your progress").font(.largeTitle.weight(.semibold))

                card {
                    HStack(spacing: 12) {
                        Text("🔥").font(.system(size: 40)).accessibilityHidden(true)
                        VStack(alignment: .leading) {
                            Text("\(snapshot.streak) \(snapshot.streak == 1 ? "day" : "days")").font(.title2.weight(.semibold))
                            Text("Best: \(snapshot.bestStreak) · \(snapshot.freezesLeft) \(snapshot.freezesLeft == 1 ? "freeze" : "freezes") left this week")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    Text("A freeze covers a day you miss, so one off day won't break your streak.").font(.footnote).foregroundStyle(.secondary)
                }

                Picker("Part", selection: $section) {
                    ForEach(Part.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                switch section {
                case .learning: learning(snapshot)
                case .math: math(snapshot)
                case .games: GamesProgressView()
                }
            }
            .padding(20)
        }
        .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: Learning

    @ViewBuilder private func learning(_ snapshot: ProgressSnapshot) -> some View {
        card {
            Text("Remembered").font(.subheadline).foregroundStyle(.secondary)
            if let rate = snapshot.recall.rate {
                Text("\(Int((rate * 100).rounded()))%").scaledFont(40, weight: .semibold, relativeTo: .largeTitle)
                Text("You recalled \(Int((rate * 100).rounded()))% of what you learned this month (\(snapshot.recall.correct) of \(snapshot.recall.total) checks).")
                    .font(.footnote).foregroundStyle(.secondary)
            } else {
                Text("Your first recall check unlocks tomorrow. Come back and we'll see what stuck.")
            }
        }

        card {
            Text("Knowledge map").font(.subheadline).foregroundStyle(.secondary)
            ForEach(Interest.allCases.filter { $0 != .estimation && $0 != .games }, id: \.self) { interest in
                let cards = snapshot.map[interest] ?? []
                let solid = cards.filter { $0.state == .solid }.count
                let learnedCount = cards.filter { $0.state != .new }.count
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(interest.displayName).font(.headline)
                        Spacer()
                        Text(cards.isEmpty ? "More coming soon" : "\(learnedCount) of \(cards.count) learned · \(solid) locked in").font(.caption).foregroundStyle(.secondary)
                    }
                    if !cards.isEmpty {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 16), spacing: 6)], alignment: .leading, spacing: 6) {
                            ForEach(cards, id: \.id) { c in
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(color(c.state))
                                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.secondary.opacity(c.state == .new ? 0.5 : 0), lineWidth: 1))
                                    .frame(width: 16, height: 16)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(mapSummary(cards))
                    }
                }
            }
            Text("Not yet · Seen · Sticking · Locked in (21+ days)").font(.caption).foregroundStyle(.secondary)
        }

        NavigationLink {
            LearnedView()
        } label: {
            HStack {
                Text("Browse what you've learned").font(.headline).foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right").font(.footnote).foregroundStyle(.secondary).accessibilityHidden(true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)

        VStack(alignment: .leading, spacing: 12) {
            Text("Your week").font(.subheadline).foregroundStyle(.white.opacity(0.7))
            let r = snapshot.recap
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 14) {
                stat("\(r.cards)", "cards")
                stat(r.recallRate.map { "\(Int(($0 * 100).rounded()))%" } ?? "–", "recalled")
                stat(r.minutes < 1 ? "<1" : "\(r.minutes)", "minutes learning")
                stat("\(r.streak)", "day streak")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Color(red: 0.06, green: 0.24, blue: 0.23), .black], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 18))
        .foregroundStyle(.white)
    }

    // MARK: Math

    @ViewBuilder private func math(_ snapshot: ProgressSnapshot) -> some View {
        card {
            Text("Your math levels").font(.subheadline).foregroundStyle(.secondary)
            ForEach(snapshot.skills) { s in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(s.name).font(.headline)
                        Spacer()
                        Text("Level \(s.level) / \(s.maxLevel)").font(.subheadline)
                    }
                    Text(s.levelName + " · " + String(s.attempts) + (s.attempts == 1 ? " problem" : " problems") + " answered").font(.caption).foregroundStyle(.secondary)
                    ProgressView(value: min(1, Double(s.recentTotal) / 20))
                    Text(s.recentTotal > 0 ? "\(s.recentRight) of \(s.recentTotal) recent answers right (level up at 80% over 20)" : "Practise in a Math round")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func stat(_ big: String, _ small: String) -> some View {
        VStack(alignment: .leading) {
            Text(big).font(.title.weight(.semibold)).monospacedDigit()
            Text(small).font(.caption).foregroundStyle(.white.opacity(0.7))
        }
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

// MARK: - Games

/// The Games part of Progress: how much you have played, your best rounds, and how far you are in the learning games.
private struct GamesProgressView: View {
    /// Words learned per language (by id) and level, loaded once.
    @State private var learned: [String: [Int: Int]] = [:]
    /// Words answered right once, not yet learned.
    @State private var practising: [String: [Int: Int]] = [:]
    @State private var totals: [String: [Int: Int]] = [:]

    var body: some View {
        let plays = GameId.allCases.reduce(0) { $0 + GameStats.plays($1) }
        card {
            Text("Rounds played").font(.subheadline).foregroundStyle(.secondary)
            Text("\(plays)").scaledFont(40, weight: .semibold, relativeTo: .largeTitle, monospaced: true)
            Text(plays == 0 ? "Try a Game round from the home screen." : "Across all your games.").font(.footnote).foregroundStyle(.secondary)
        }

        card {
            Text("Languages").font(.subheadline).foregroundStyle(.secondary)
            ForEach(LanguageInfo.all) { info in
                VStack(alignment: .leading, spacing: 8) {
                    Text(info.flag + " " + info.name).font(.headline)
                    ForEach([1, 2, 3], id: \.self) { level in
                        let done = learned[info.id]?[level] ?? 0
                        let inProgress = practising[info.id]?[level] ?? 0
                        let total = totals[info.id]?[level] ?? 0
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(LanguageBuilder.levelName(level)).font(.caption).foregroundStyle(.secondary)
                                Spacer()
                                Text("\(done) of \(total) learned" + (inProgress > 0 ? " · \(inProgress) practising" : "")).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                            }
                            ProgressView(value: total > 0 ? min(1, Double(done) / Double(total)) : 0)
                        }
                    }
                }
            }
        }

        card {
            Text("Logic").font(.subheadline).foregroundStyle(.secondary)
            let solved = LogicStore.load().solved.values.filter { $0 > 0 }.count
            Text("\(solved) of \(LogicData.load().count) puzzles solved").font(.title3.weight(.semibold))
        }

        card {
            Text("Your games").font(.subheadline).foregroundStyle(.secondary)
            ForEach(GameId.allCases) { game in
                HStack(spacing: 12) {
                    Text(game.emoji).font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(game.name).font(.headline)
                        let n = GameStats.plays(game)
                        Text(n == 0 ? "Not played yet" : "\(n) \(n == 1 ? "round" : "rounds")").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let best = GameStats.bestLabel(game) {
                        Text("Best " + best).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .task { await loadLanguages() }
    }

    /// The word lists are read here, off the main thread, and only to count what is learned per level.
    private func loadLanguages() async {
        let result = await Task.detached { () -> ([String: [Int: Int]], [String: [Int: Int]], [String: [Int: Int]]) in
            var done: [String: [Int: Int]] = [:]
            var again: [String: [Int: Int]] = [:]
            var total: [String: [Int: Int]] = [:]
            for info in LanguageInfo.all {
                let words = LanguageData.load(info)
                let known = LanguageStore.load(info).known
                var d: [Int: Int] = [:]
                var p: [Int: Int] = [:]
                var t: [Int: Int] = [:]
                for w in words {
                    t[w.level, default: 0] += 1
                    let n = known[w.key] ?? 0
                    if n >= LanguageBuilder.learnedAt { d[w.level, default: 0] += 1 } else if n >= 1 { p[w.level, default: 0] += 1 }
                }
                done[info.id] = d
                again[info.id] = p
                total[info.id] = t
            }
            return (done, again, total)
        }.value
        learned = result.0
        practising = result.1
        totals = result.2
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}
