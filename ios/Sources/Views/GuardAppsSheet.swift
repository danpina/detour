import FamilyControls
import ManagedSettings
import SwiftUI

/// Apple's app picker in its own sheet. Presenting it from inside the Settings form was unreliable (it sometimes would not open),
/// so Settings shows this sheet instead and the picker is the only thing on it. The choice is kept when Done is tapped.
struct GuardAppsSheet: View {
    @Environment(GuardManager.self) private var guardManager
    @State private var draft = FamilyActivitySelection()
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            FamilyActivityPicker(selection: $draft)
                .navigationTitle("Guarded apps")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onClose() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            guardManager.selection = draft
                            guardManager.saveSelection()
                            onClose()
                        }
                    }
                }
        }
        .onAppear { draft = guardManager.selection }
    }
}

/// The apps being guarded, each with a "which app is this?" choice. iOS keeps the shield blind to app names, so the user says
/// once which app each one is; Detour can then take them back to it after a detour. The choice stays on the device.
struct GuardedAppsList: View {
    @Environment(GuardManager.self) private var guardManager

    private var tokens: [ApplicationToken] {
        guardManager.selection.applicationTokens.sorted { (GuardShield.tokenKey(for: $0) ?? "") < (GuardShield.tokenKey(for: $1) ?? "") }
    }

    var body: some View {
        if !tokens.isEmpty {
            ForEach(tokens, id: \.self) { token in
                HStack {
                    Label(token)
                        .labelStyle(.titleAndIcon)
                    Spacer()
                    Picker("Opens in", selection: Binding(
                        get: { guardManager.returnBundle(for: token) },
                        set: { guardManager.setReturnBundle($0, for: token) }
                    )) {
                        Text("Not set").tag("")
                        ForEach(ReturnApps.popular) { app in Text(app.name).tag(app.bundle) }
                    }
                    .labelsHidden()
                }
            }
            Text("Tell Detour which app each one is, once, and \"Go back to\" will take you to the right one after a detour. iOS doesn't share app names with Detour.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
