import SwiftUI

/// Which math skills are in your rounds. A row per skill with your level in it; at least one stays on.
struct MathSkillsView: View {
    @Environment(AppModel.self) private var model
    @State private var note = ""

    private func isOn(_ track: TrackId) -> Bool { !(model.settings.mathOff ?? []).contains(track.rawValue) }

    private func detail(_ track: TrackId) -> String {
        let info = Drills.info(track)
        let status = model.skillStatus(track)
        if status.attempts > 0 { return "Level \(status.level) of \(info.maxLevel)" }
        return "Not started · " + info.blurb.lowercased()
    }

    private func toggle(_ track: TrackId) {
        if isOn(track) && model.mathSkillsOn.count <= 1 {
            note = "Keep at least one skill on, so a math round has something to ask."
            return
        }
        note = ""
        model.updateSettings { settings in
            var off = settings.mathOff ?? []
            off.removeAll { $0 == track.rawValue }
            if isOn(track) { off.append(track.rawValue) }
            settings.mathOff = off
        }
    }

    var body: some View {
        List {
            Section {
                ForEach(TrackId.allCases, id: \.self) { track in
                    Button { toggle(track) } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Drills.info(track).name).foregroundStyle(.primary)
                                Text(detail(track)).font(.footnote).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: isOn(track) ? "checkmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundStyle(isOn(track) ? Color.teal : Color.secondary)
                        }
                    }
                    .accessibilityAddTraits(isOn(track) ? .isSelected : [])
                }
            } header: {
                Text("Math rounds mix the skills you leave on")
            } footer: {
                Text(note.isEmpty ? "Tap a skill to switch it." : note)
            }
        }
        .navigationTitle("Your math skills")
        .navigationBarTitleDisplayMode(.inline)
    }
}
