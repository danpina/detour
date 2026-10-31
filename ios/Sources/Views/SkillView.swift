import SwiftUI

/// One math skill, level by level: what each level asks, an example, and a way to practise any of them.
struct SkillView: View {
    @Environment(AppModel.self) private var model
    let track: TrackId
    let start: (_ specific: AppModel.Specific, _ kind: AppModel.RoundKind) -> Void

    private func formatTag(_ example: DrillProblem?) -> String {
        guard let choices = example?.choices else { return "" }
        return choices == ["True", "False"] ? "True or false" : "Pick one"
    }

    var body: some View {
        let info = Drills.info(track)
        let status = model.skillStatus(track)
        let started = status.attempts > 0
        List {
            Section {
                Button { start(.skill(track), .math) } label: {
                    Text(started ? "Play level \(status.level)" : "Start with level 1").font(.headline)
                }
            } footer: {
                Text(info.blurb + ". " + (started ? "You're on level \(status.level) of \(info.maxLevel)." : "Not started yet."))
            }
            Section("Levels") {
                ForEach(Array(info.levels.enumerated()), id: \.offset) { index, name in
                    let level = index + 1
                    let example = Drills.generateRound(DrillSpec(track: track, level: level, seed: UInt32(1000 + level), count: 1)).first
                    let state = level < status.level ? "Done" : (level == status.level && started ? "You're here" : "")
                    let tag = [state, formatTag(example)].filter { !$0.isEmpty }.joined(separator: " · ")
                    Button { start(.level(track, level), .math) } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(alignment: .firstTextBaseline) {
                                Text("\(level). \(name)").font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                                Spacer()
                                Text(tag).font(.caption).foregroundStyle(.secondary)
                            }
                            if let example {
                                Text("For example: \(example.prompt)").font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                            }
                            Text("Practise this level").font(.caption.weight(.medium)).foregroundStyle(.teal)
                        }
                    }
                }
            }
        }
        .navigationTitle(info.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
