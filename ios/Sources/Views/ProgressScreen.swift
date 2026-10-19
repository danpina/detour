import SwiftUI

struct ProgressScreen: View {
    @Environment(AppModel.self) private var model

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
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Your progress").font(.largeTitle.weight(.semibold))

                card {
                    HStack(spacing: 12) {
                        Text("🔥").font(.system(size: 40))
                        VStack(alignment: .leading) {
                            Text("\(snapshot.streak) \(snapshot.streak == 1 ? "day" : "days")").font(.title2.weight(.semibold))
                            Text("Best: \(snapshot.bestStreak) · \(snapshot.freezesLeft) \(snapshot.freezesLeft == 1 ? "freeze" : "freezes") left this week")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    Text("A freeze covers a day you miss, so one off day won't break your streak.").font(.footnote).foregroundStyle(.secondary)
                }

                card {
                    Text("Remembered").font(.subheadline).foregroundStyle(.secondary)
                    if let rate = snapshot.recall.rate {
                        Text("\(Int((rate * 100).rounded()))%").font(.system(size: 40, weight: .semibold))
                        Text("You recalled \(Int((rate * 100).rounded()))% of what you learned this month (\(snapshot.recall.correct) of \(snapshot.recall.total) checks).")
                            .font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Text("Your first recall check unlocks tomorrow. Come back and we'll see what stuck.")
                    }
                }

                card {
                    Text("Knowledge map").font(.subheadline).foregroundStyle(.secondary)
                    ForEach(Interest.allCases, id: \.self) { interest in
                        let cards = snapshot.map[interest] ?? []
                        let solid = cards.filter { $0.state == .solid }.count
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(interest.displayName).font(.headline)
                                Spacer()
                                Text(cards.isEmpty ? "More coming soon" : "\(solid) of \(cards.count) locked in").font(.caption).foregroundStyle(.secondary)
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
                            }
                        }
                    }
                    Text("Not yet · Seen · Sticking · Locked in (21+ days)").font(.caption).foregroundStyle(.secondary)
                }

                card {
                    Text("Skills").font(.subheadline).foregroundStyle(.secondary)
                    ForEach(snapshot.skills) { s in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(s.name).font(.headline)
                                Spacer()
                                Text("Level \(s.level) / \(s.maxLevel)").font(.subheadline)
                            }
                            Text(s.levelName).font(.caption).foregroundStyle(.secondary)
                            ProgressView(value: min(1, Double(s.recentTotal) / 20))
                            Text(s.recentTotal > 0 ? "\(s.recentRight) of \(s.recentTotal) recent answers right (level up at 80% over 20)" : "Practise in your next set")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }

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
            .padding(20)
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
