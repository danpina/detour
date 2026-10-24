import FamilyControls
import SwiftUI
import UIKit

/// Settings for guarded apps: which apps, how strict, how long an unlock lasts. Everything stays on the device.
struct GuardSettingsSection: View {
    @Environment(GuardManager.self) private var guardManager
    /// Opens the app picker (a sheet owned by the Settings screen).
    var chooseApps: () -> Void
    @State private var working = false

    private var modeExplanation: String {
        switch guardManager.settings.mode {
        case .gentle:
            return "Nudge me: opening a guarded app shows a quick Detour first, and you can always tap Continue to go straight in."
        case .earnIt:
            return "Earn it: opening a guarded app shows a quick Detour first. Finish a set to unlock it for a while, or use your one skip a day."
        case .strict:
            return "Strict: a last check every time. Take a detour, or tap Open anyway. Open anyway only lasts a few minutes of use, then the check comes back. iOS can't tell when you leave an app, so it can't ask on every single open."
        case .hardLock:
            return "Hard lock: like Earn it, plus a daily allowance of use. Once it's used up, the guarded apps stay shielded until midnight."
        }
    }

    /// A time-of-day binding for one end of the active hours.
    private func hoursBinding(start: Bool, current: ActiveHours) -> Binding<Date> {
        Binding(
            get: {
                var c = DateComponents()
                c.hour = start ? current.startHour : current.endHour
                c.minute = start ? current.startMinute : current.endMinute
                return Calendar.current.date(from: c) ?? Date()
            },
            set: { date in
                let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                guardManager.update {
                    var hours = $0.activeHours ?? ActiveHours()
                    if start {
                        hours.startHour = c.hour ?? 9
                        hours.startMinute = c.minute ?? 0
                    } else {
                        hours.endHour = c.hour ?? 22
                        hours.endMinute = c.minute ?? 0
                    }
                    $0.activeHours = hours
                }
            }
        )
    }

    var body: some View {
        Section {
            Toggle("Guard my apps", isOn: Binding(
                get: { guardManager.settings.enabled },
                set: { on in
                    if on {
                        working = true
                        Task {
                            await guardManager.enable()
                            working = false
                            if guardManager.settings.enabled && !guardManager.hasSelection { chooseApps() }
                        }
                    } else {
                        guardManager.disable()
                    }
                }
            ))
            .disabled(working)

            if guardManager.settings.enabled {
                Button(guardManager.hasSelection ? "Change guarded apps" : "Choose apps to guard") { chooseApps() }
                GuardedAppsList()

                Picker("When I open one", selection: Binding(
                    get: { guardManager.settings.mode },
                    set: { mode in guardManager.update { $0.mode = mode } }
                )) {
                    Text("Nudge me").tag(GuardMode.gentle)
                    Text("Earn it").tag(GuardMode.earnIt)
                    Text("Strict").tag(GuardMode.strict)
                    Text("Hard lock").tag(GuardMode.hardLock)
                }
                Text(modeExplanation)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if guardManager.settings.mode == .hardLock {
                    Picker("Daily allowance", selection: Binding(
                        get: { guardManager.settings.dailyAllowance },
                        set: { minutes in guardManager.update { $0.allowanceMinutes = minutes } }
                    )) {
                        ForEach([15, 30, 45, 60, 90, 120], id: \.self) { Text("\($0) min a day").tag($0) }
                    }
                }

                if guardManager.settings.mode == .strict {
                    Picker("Open anyway allows", selection: Binding(
                        get: { guardManager.settings.strictUseSeconds },
                        set: { seconds in guardManager.update { $0.strictSeconds = seconds } }
                    )) {
                        ForEach([15, 30, 60, 180, 300, 600], id: \.self) { Text(usageLabel($0) + " of use").tag($0) }
                    }
                    Text("The shortest is the strictest: the check comes back after only that much use. If iOS won't accept under a minute, Detour falls back to 1 min and says so in the debug log.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Group {
                    Picker("After a detour, open for", selection: Binding(
                        get: { guardManager.settings.unlockMinutes },
                        set: { minutes in guardManager.update { $0.unlockMinutes = minutes } }
                    )) {
                        ForEach([1, 3, 5, 10, 15, 30, 60], id: \.self) { Text("\($0) min").tag($0) }
                    }
                    Text("Under 15 minutes counts minutes of actual use in the guarded apps; the shield then comes back. From 15 minutes up it is plain clock time.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Picker("Go back to", selection: Binding(
                    get: { guardManager.settings.returnBundle ?? "" },
                    set: { bundle in guardManager.update { $0.returnBundle = bundle.isEmpty ? nil : bundle } }
                )) {
                    Text("Nothing").tag("")
                    ForEach(ReturnApps.popular) { app in Text(app.name).tag(app.bundle) }
                }
                Text("After a detour, Detour offers to open this app for you. Used for any guarded app you haven't named above.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Toggle("Only guard at certain times", isOn: Binding(
                    get: { guardManager.settings.activeHours != nil },
                    set: { on in guardManager.update { $0.activeHours = on ? ActiveHours() : nil } }
                ))
                if let hours = guardManager.settings.activeHours {
                    DatePicker("From", selection: hoursBinding(start: true, current: hours), displayedComponents: .hourAndMinute)
                    DatePicker("Until", selection: hoursBinding(start: false, current: hours), displayedComponents: .hourAndMinute)
                    Text("Outside these hours your apps open as normal. If \"until\" is earlier than \"from\", the window runs past midnight.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if let error = guardManager.lastError {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Guarded apps")
        } footer: {
            Text("Pick the apps you scroll too much. Opening one shows a quick Detour first. You choose the apps with Apple's picker. Detour only notes, on your device, which app the shield was covering so it can take you back to it, and you can turn this off any time.")
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
