import FamilyControls
import SwiftUI
import UIKit

/// Settings for guarded apps: which apps, how strict, how long an unlock lasts. Everything stays on the device.
struct GuardSettingsSection: View {
    @Environment(GuardManager.self) private var guardManager
    @State private var picking = false
    @State private var working = false

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

        if guardManager.settings.enabled {
            Section {
                DisclosureGroup("Guard log") {
                    let lines = guardManager.logLines
                    if lines.isEmpty {
                        Text("Nothing yet.").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        ForEach(Array(lines.suffix(40).enumerated()), id: \.offset) { _, line in
                            Text(line).font(.system(.caption2, design: .monospaced))
                        }
                        Button("Copy log") { UIPasteboard.general.string = lines.joined(separator: "\n") }
                        ShareLink(item: lines.joined(separator: "\n"), subject: Text("Detour guard log")) { Text("Share log") }
                        Button("Clear log") { guardManager.clearLog() }
                    }
                }
            }
        }
    }
}
