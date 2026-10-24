import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    private enum SettingsSheet: String, Identifiable {
        case interests, apps
        var id: String { rawValue }
    }

    @State private var sheet: SettingsSheet?
    @State private var confirmErase = false
    @State private var reminderDenied = false

    private var reminderTime: Binding<Date> {
        Binding(
            get: {
                var c = DateComponents()
                c.hour = model.settings.reminderHour
                c.minute = model.settings.reminderMinute
                return Calendar.current.date(from: c) ?? Date()
            },
            set: { date in
                let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                model.updateSettings {
                    $0.reminderHour = c.hour ?? 20
                    $0.reminderMinute = c.minute ?? 0
                }
                if model.settings.reminderEnabled { Reminders.schedule(hour: c.hour ?? 20, minute: c.minute ?? 0) }
            }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Your interests") {
                    Text(model.settings.interests.map { $0.displayName }.joined(separator: " · "))
                    Button("Change interests") { sheet = .interests }
                }

                Section("Cards per set") {
                    Picker("Cards per set", selection: Binding(
                        get: { model.settings.setSize },
                        set: { size in model.updateSettings { $0.setSize = size } }
                    )) {
                        ForEach([3, 5, 8], id: \.self) { Text("\($0)").tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Text("Five is about a minute.").font(.footnote).foregroundStyle(.secondary)
                }

                Section {
                    Toggle("Mental math", isOn: Binding(
                        get: { model.drillsEnabled },
                        set: { on in model.updateSettings { $0.drills = on } }
                    ))
                    Text("Add a quick mental-math round to the end of a set. Estimation and Games are topics you can pick under your interests.").font(.footnote).foregroundStyle(.secondary)
                    Picker("How often", selection: Binding(
                        get: { model.extrasEvery },
                        set: { n in model.updateSettings { $0.extrasEvery = n } }
                    )) {
                        Text("Every set").tag(1)
                        Text("Every 2nd").tag(2)
                        Text("Every 3rd").tag(3)
                        Text("Every 5th").tag(5)
                    }
                    Text("How often mental math, estimation and a quick game show up in your sets.").font(.footnote).foregroundStyle(.secondary)
                }

                GuardSettingsSection(chooseApps: { sheet = .apps })

                Section("Daily reminder") {
                    Toggle("Remind me", isOn: Binding(
                        get: { model.settings.reminderEnabled },
                        set: { on in
                            if on {
                                Task {
                                    let granted = await Reminders.requestAndSchedule(hour: model.settings.reminderHour, minute: model.settings.reminderMinute)
                                    model.updateSettings { $0.reminderEnabled = granted }
                                    reminderDenied = !granted
                                }
                            } else {
                                Reminders.cancel()
                                model.updateSettings { $0.reminderEnabled = false }
                            }
                        }
                    ))
                    if model.settings.reminderEnabled {
                        DatePicker("Time", selection: reminderTime, displayedComponents: .hourAndMinute)
                    }
                    if reminderDenied {
                        Text("Notifications are turned off for Detour. You can allow them in the Settings app.").font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section("Your data") {
                    Text("Everything stays on this device. No account, nothing uploaded.").font(.footnote).foregroundStyle(.secondary)
                    Button("Erase everything", role: .destructive) { confirmErase = true }
                }

                Section {
                    Link("Privacy", destination: URL(string: "https://danpina.github.io/detour/privacy.html")!)
                } footer: {
                    let info = Bundle.main.infoDictionary
                    Text("Detour " + ((info?["CFBundleShortVersionString"] as? String) ?? "?") + " (build " + ((info?["CFBundleVersion"] as? String) ?? "?") + ")")
                }

                DebugLogSection()
            }
            .navigationTitle("Settings")
            .confirmationDialog("Erase all progress on this device?", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Erase everything", role: .destructive) {
                    Reminders.cancel()
                    model.eraseEverything()
                }
            }
            .sheet(item: $sheet) { which in
                switch which {
                case .interests:
                    OnboardingView(initial: model.settings.interests, confirmLabel: "Save") { picked in
                        model.updateSettings { $0.interests = picked }
                        sheet = nil
                    }
                case .apps:
                    GuardAppsSheet { sheet = nil }
                }
            }
        }
    }
}
