import SwiftUI
import WidgetKit

// The Home Screen and Lock Screen widget: your streak, what is due, and a one-tap way into a round.
// It only reads the snapshot the app writes (WidgetSnapshot). Tapping opens Detour at the round choice, or straight into a round.

struct DetourEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct DetourProvider: TimelineProvider {
    func placeholder(in context: Context) -> DetourEntry {
        DetourEntry(date: Date(), snapshot: WidgetSnapshot(streakByDay: [WidgetSnapshot.dayKey(Date()): 5], lastActiveDay: "", dueCount: 3, roundSize: 5))
    }

    func getSnapshot(in context: Context, completion: @escaping (DetourEntry) -> Void) {
        completion(DetourEntry(date: Date(), snapshot: WidgetSnapshot.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DetourEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        let snapshot = WidgetSnapshot.read()
        // One entry now, and one at the start of each of the next few days, so the streak and "today" roll over at midnight.
        var entries = [DetourEntry(date: now, snapshot: snapshot)]
        for offset in 1...3 {
            if let midnight = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) {
                entries.append(DetourEntry(date: midnight, snapshot: snapshot))
            }
        }
        let refresh = calendar.date(byAdding: .hour, value: 6, to: now) ?? now.addingTimeInterval(21_600)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

private enum Deep {
    static let chooser = URL(string: "detour://round")!
    static let learning = URL(string: "detour://learning")!
    static let math = URL(string: "detour://math")!
    static let games = URL(string: "detour://games")!
}

private extension DetourEntry {
    var streak: Int { snapshot?.streak(on: date) ?? 0 }
    var done: Bool { snapshot?.doneToday(date) ?? false }
    var due: Int { snapshot?.dueCount ?? 0 }

    var dayWord: String { streak == 1 ? "day" : "days" }

    /// The one line under the streak: what to do next, in the app's warm voice.
    var nudge: String {
        if due > 0 { return "\(due) to check if they stuck" }
        return done ? "Done for today" : "Quick one?"
    }
}

struct DetourWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DetourEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(systemName: "flame.fill").font(.caption)
                Text("\(entry.streak)").font(.title2.weight(.semibold)).minimumScaleFactor(0.6)
            }
            .widgetURL(Deep.chooser)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Streak: \(entry.streak) \(entry.dayWord)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("\(entry.streak) \(entry.dayWord) in a row").font(.headline)
                Text(entry.nudge).font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(Deep.chooser)
        case .systemMedium:
            HStack(spacing: 16) {
                streakBlock
                VStack(spacing: 8) {
                    roundLink("Learn", symbol: "book.fill", url: Deep.learning)
                    roundLink("Math", symbol: "plusminus", url: Deep.math)
                    roundLink("Games", symbol: "gamecontroller.fill", url: Deep.games)
                }
            }
        default:
            streakBlock
                .frame(maxWidth: .infinity, alignment: .leading)
                .widgetURL(Deep.chooser)
        }
    }

    private var streakBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "flame.fill").font(.title2).foregroundStyle(.orange).accessibilityHidden(true)
            Text("\(entry.streak)").font(.system(size: 44, weight: .semibold, design: .rounded)).minimumScaleFactor(0.6)
            Text("day streak").font(.caption).foregroundStyle(.secondary)
            Spacer(minLength: 0)
            Text(entry.nudge).font(.footnote.weight(.medium)).lineLimit(2)
        }
        .accessibilityElement(children: .combine)
    }

    private func roundLink(_ title: String, symbol: String, url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 8) {
                Image(systemName: symbol).frame(width: 20).accessibilityHidden(true)
                Text(title).font(.subheadline.weight(.medium))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(Color.teal.opacity(0.18), in: RoundedRectangle(cornerRadius: 10))
        }
    }
}

struct DetourWidget: Widget {
    let kind = "DetourWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DetourProvider()) { entry in
            DetourWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Detour")
        .description("Your streak, what is due, and a quick way into a round.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct DetourWidgetBundle: WidgetBundle {
    var body: some Widget {
        DetourWidget()
    }
}
