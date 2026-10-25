import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

extension ReturnApps {
    /// Whether the app is on this phone, judged by whether its link can be opened. Only works for the schemes listed in the
    /// app's Info.plist (LSApplicationQueriesSchemes).
    @MainActor
    static func isInstalled(_ bundle: String) -> Bool {
        guard let url = url(for: bundle) else { return false }
        return UIApplication.shared.canOpenURL(url)
    }
}

/// Choosing which apps to guard. iOS never tells Detour which app is which, so the popular apps are picked one at a time:
/// tap an app, and Apple's picker opens asking for exactly that one. Detour then knows what the new app is, with nothing more to
/// say later. Other apps are picked in one go, and Detour can't take you back to those.
struct GuardAppsSheet: View {
    @Environment(GuardManager.self) private var guardManager
    var onClose: () -> Void

    private enum Target: Identifiable {
        case app(ReturnApps.PopularApp)
        case other

        var id: String {
            switch self {
            case .app(let app): return app.bundle
            case .other: return "other"
            }
        }
    }

    @State private var target: Target?
    @State private var confirm: PickedApp?

    private struct PickedApp: Identifiable {
        let token: ApplicationToken
        let expected: String
        var id: String { GuardShield.tokenKey(for: token) ?? expected }
    }

    private var installed: [ReturnApps.PopularApp] {
        ReturnApps.popular.filter { ReturnApps.isInstalled($0.bundle) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(installed) { app in
                        let guarded = guardManager.isGuarded(bundle: app.bundle)
                        HStack {
                            Text(app.name)
                            Spacer()
                            if guarded {
                                Button("Stop guarding", role: .destructive) { guardManager.remove(bundle: app.bundle) }
                                    .buttonStyle(.borderless)
                            } else {
                                Button("Guard") { target = .app(app) }
                                    .buttonStyle(.borderless)
                            }
                        }
                    }
                } header: {
                    Text("Apps on this phone")
                } footer: {
                    Text("Tap Guard, then pick that app in the list Apple shows. That's how Detour learns which app is which, so it can take you back to it after a detour.")
                }

                Section {
                    Button("Other apps…") { target = .other }
                } footer: {
                    Text("Any other app. Detour guards them, but can't take you back to them after a detour.")
                }
            }
            .sheet(item: $confirm) { picked in
                VStack(spacing: 20) {
                    Text("Is this " + picked.expected + "?").font(.title2.weight(.semibold))
                    Label(picked.token)
                        .labelStyle(.titleAndIcon)
                        .font(.title3)
                    Text("Detour uses this to take you back to the right app.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Yes, it's " + picked.expected) {
                        guardManager.confirmJustAdded()
                        confirm = nil
                    }
                    .buttonStyle(.borderedProminent)
                    Button("No, I picked another app", role: .destructive) {
                        guardManager.undo(picked.token)
                        confirm = nil
                    }
                }
                .padding(32)
                .presentationDetents([.medium])
                .interactiveDismissDisabled()
            }
            .navigationTitle("Guarded apps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { onClose() } }
            }
        }
        .sheet(item: $target) { which in
            switch which {
            case .app(let app):
                AppPickerSheet(title: "Pick " + app.name, initial: guardManager.selection) { draft in
                    let problem = guardManager.commit(draft, as: app.bundle)
                    if problem == nil {
                        target = nil
                        if let token = guardManager.justAdded { confirm = PickedApp(token: token, expected: app.name) }
                    }
                    return problem
                } onCancel: { target = nil }
            case .other:
                AppPickerSheet(title: "Other apps", initial: guardManager.selection) { draft in
                    _ = guardManager.commit(draft, as: nil)
                    target = nil
                    return nil
                } onCancel: { target = nil }
            }
        }
    }
}

/// Apple's app picker on its own, with Cancel and Done.
struct AppPickerSheet: View {
    let title: String
    let initial: FamilyActivitySelection
    /// Returns a message to show when the pick can't be used.
    var onDone: (FamilyActivitySelection) -> String?
    var onCancel: () -> Void
    @State private var draft = FamilyActivitySelection()
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            FamilyActivityPicker(selection: $draft)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onCancel() } }
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { problem = onDone(draft) } }
                }
                .alert("One app at a time", isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })) {
                    Button("OK") { problem = nil }
                } message: {
                    Text(problem ?? "")
                }
        }
        .onAppear { draft = initial }
    }
}

/// The apps being guarded, with a tick for each one Detour knows. For the rest, the user can say which app it is.
struct GuardedAppsList: View {
    @Environment(GuardManager.self) private var guardManager

    private var tokens: [ApplicationToken] {
        guardManager.selection.applicationTokens.sorted { (GuardShield.tokenKey(for: $0) ?? "") < (GuardShield.tokenKey(for: $1) ?? "") }
    }

    var body: some View {
        if !tokens.isEmpty {
            ForEach(tokens, id: \.self) { token in
                let bundle = guardManager.returnBundle(for: token)
                HStack {
                    Label(token)
                        .labelStyle(.titleAndIcon)
                    Spacer()
                    if bundle.isEmpty {
                        Picker("Which app?", selection: Binding(
                            get: { guardManager.returnBundle(for: token) },
                            set: { guardManager.setReturnBundle($0, for: token) }
                        )) {
                            Text("Which app?").tag("")
                            ForEach(ReturnApps.popular) { app in Text(app.name).tag(app.bundle) }
                        }
                        .labelsHidden()
                    } else {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint)
                    }
                }
            }
        }
    }
}
