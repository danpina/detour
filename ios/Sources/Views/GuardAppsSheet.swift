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

/// The apps being guarded. Detour works out which app each one is from what iOS says; only for an app it cannot recognise does
/// it ask, and only so it can take the user back to it after a detour. The answer stays on the device.
struct GuardedAppsList: View {
    @Environment(GuardManager.self) private var guardManager

    private var tokens: [ApplicationToken] {
        guardManager.selection.applicationTokens.sorted { (GuardShield.tokenKey(for: $0) ?? "") < (GuardShield.tokenKey(for: $1) ?? "") }
    }

    private var anyUnknown: Bool {
        tokens.contains { guardManager.returnBundle(for: $0).isEmpty }
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
            if anyUnknown {
                Text("Detour couldn't tell which of these is which. Say once, only if you want \"Go back to\" to take you to the right app after a detour.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
