import FamilyControls
import SwiftUI
import UIKit

/// Settings for guarded apps: which apps, how strict, how long an unlock lasts. Everything stays on the device.
struct GuardSettingsSection: View {
    @Environment(GuardManager.self) private var guardManager
    @State private var picking = false
    @State private var working = false

    private var modeExplanation: String {
        switch guardManager.settings.mode {
        case .gentle:
            return "Nudge me: opening a guarded app shows a quick Detour first, and you can always tap Continue to go straight in."
        case .earnIt:
            return "Earn it: opening a guarded app shows a quick Detour first. Finish a set to unlock it for a while, or use your one skip a day."
        case .strict:
            return "Strict: a last check every time. Take a detour, or tap Open anyway. Open anyway only lasts a few minutes of use, then the check comes back. iOS can't tell when you leave an app, so it can't ask on every single open."
        }
    }

    var body: some View {
        @Bindable var manager = guardManager
        Section {
            Toggle("Guard my apps", isOn: Binding(
                get: { guardManager.settings.enabled },
                set: { on in
                    if on {
                        working = true
                        Task {
                            await guardManager.enable()
                            working = false
                            if guardManager.settings.enabled && !guardManager.hasSelection { picking = true }
                        }
                    } else {
                        guardManager.disable()
                    }
                }
            ))
            .disabled(working)

            if guardManager.settings.enabled {
                Button(guardManager.hasSelection ? "Change guarded apps" : "Choose apps to guard") { picking = true }

                Picker("When I open one", selection: Binding(
                    get: { guardManager.settings.mode },
                    set: { mode in guardManager.update { $0.mode = mode } }
                )) {
                    Text("Nudge me").tag(GuardMode.gentle)
                    Text("Earn it").tag(GuardMode.earnIt)
                    Text("Strict").tag(GuardMode.strict)
                }
                Text(modeExplanation)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if guardManager.settings.mode == .strict {
                    Picker("Open anyway allows", selection: Binding(
                        get: { guardManager.settings.strictUseMinutes },
                        set: { minutes in guardManager.update { $0.strictMinutes = minutes } }
                    )) {
                        ForEach([1, 3, 5, 10], id: \.self) { Text("\($0) min of use").tag($0) }
                    }
                }

                if guardManager.settings.mode == .earnIt {
                    Picker("Unlock for", selection: Binding(
                        get: { guardManager.settings.unlockMinutes },
                        set: { minutes in guardManager.update { $0.unlockMinutes = minutes } }
                    )) {
                        ForEach([15, 30, 60], id: \.self) { Text("\($0) min").tag($0) }
                    }
                }
            }

            if let error = guardManager.lastError {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Guarded apps")
        } footer: {
            Text("Pick the apps you scroll too much. Opening one shows a quick Detour first. You choose the apps with Apple's picker, so Detour never learns which ones they are, and you can turn this off any time.")
        }
        .familyActivityPicker(isPresented: $picking, selection: $manager.selection)
        .onChange(of: picking) { _, isOpen in
            if !isOpen { guardManager.saveSelection() }
        }
    }
}

/// The debug log: what the app and the Screen Time extensions did, newest last. Copy or share it to report a problem.
struct DebugLogSection: View {
    @Environment(GuardManager.self) private var guardManager
    @State private var open = false

    var body: some View {
        Section {
            DisclosureGroup("Debug log (\(guardManager.logLines.count))", isExpanded: $open) {
                let lines = guardManager.logLines
                if lines.isEmpty {
                    Text("Nothing yet.").font(.footnote).foregroundStyle(.secondary)
                } else {
                    ForEach(Array(lines.suffix(80).enumerated()), id: \.offset) { _, line in
                        Text(line).font(.system(.caption2, design: .monospaced))
                    }
                }
                Button("Refresh") { guardManager.reloadLog() }
                Button("Copy all (\(lines.count) lines)") { UIPasteboard.general.string = lines.joined(separator: "\n") }
                ShareLink(item: lines.joined(separator: "\n"), subject: Text("Detour debug log")) { Text("Share log") }
                Button("Clear log", role: .destructive) { guardManager.clearLog() }
            }
        }
        .onAppear { guardManager.reloadLog() }
        .onChange(of: open) { _, isOpen in
            if isOpen { guardManager.reloadLog() }
        }
    }
}
