import SwiftUI

/// What a new user sees first: a few short steps, each skippable. Which language to learn (and how hard), what they are curious
/// about, and which apps to guard. Everything can be changed later in Games and Settings.
struct FirstRunView: View {
    @Environment(GuardManager.self) private var guardManager
    /// Called with the chosen interests when the last step is done.
    let onDone: ([Interest]) -> Void

    private enum Step { case language, interests, apps }

    @State private var step: Step = .language
    @State private var interests: [Interest] = []
    @State private var language = LanguageInfo.current
    @State private var level = LanguageInfo.currentLevel
    @State private var choosingApps = false
    @State private var working = false

    private let levelBlurbs = [1: "First words", 2: "Everyday talk", 3: "Ideas and nuance"]

    var body: some View {
        switch step {
        case .language:
            languageStep
        case .interests:
            OnboardingView(initial: interests, confirmLabel: "Next", eyebrow: "Step 2 of 3", onBack: { step = .language }) { picked in
                interests = picked
                step = .apps
            }
        case .apps:
            appsStep
        }
    }

    // MARK: Step 1: a language

    private var languageStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Step 1 of 3").font(.subheadline.weight(.medium)).foregroundStyle(.tint)
            Text("Want to pick up a language?")
                .font(.largeTitle.weight(.semibold))
                .padding(.top, 8)
            Text("A few words at a time, between everything else. You can switch any time in Games.")
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            VStack(spacing: 12) {
                ForEach(LanguageInfo.all) { info in
                    let on = language.id == info.id
                    Button {
                        language = info
                        LanguageInfo.current = info
                    } label: {
                        HStack(spacing: 14) {
                            Text(info.flag).font(.largeTitle)
                            Text(info.name).font(.headline)
                            Spacer()
                            if on { Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint) }
                        }
                        .padding(14)
                        .background(on ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? Color.accentColor : Color.clear, lineWidth: 2))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(.top, 20)

            Text("How much do you know?").font(.headline).padding(.top, 24)
            Picker("Level", selection: Binding(
                get: { level },
                set: { n in
                    level = n
                    LanguageInfo.currentLevel = n
                }
            )) {
                ForEach([1, 2, 3], id: \.self) { n in
                    Text(LanguageBuilder.levelName(n)).tag(n)
                }
            }
            .pickerStyle(.segmented)
            .padding(.top, 8)
            Text(levelBlurbs[level] ?? "").font(.footnote).foregroundStyle(.secondary).padding(.top, 6)

            Spacer()

            Button {
                step = .interests
            } label: {
                Text("Next").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
            }
            .buttonStyle(.borderedProminent)
            Button("Not now") { step = .interests }
                .frame(maxWidth: .infinity)
                .padding(.top, 10)
        }
        .padding(24)
    }

    // MARK: Step 3: apps to guard

    private var appsStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Step 3 of 3").font(.subheadline.weight(.medium)).foregroundStyle(.tint)
            Text("Which apps pull you in?")
                .font(.largeTitle.weight(.semibold))
                .padding(.top, 8)
            Text("Pick the ones you scroll too much. When you open one, Detour shows a quick one first. It stays on your phone, and you can change it any time in Settings.")
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            if let error = guardManager.lastError {
                Text(error).font(.footnote).foregroundStyle(.secondary).padding(.top, 12)
            }

            Spacer()

            Button {
                working = true
                Task {
                    await guardManager.enable()
                    working = false
                    if guardManager.settings.enabled { choosingApps = true }
                }
            } label: {
                Text("Choose apps to guard").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
            }
            .buttonStyle(.borderedProminent)
            .disabled(working)
            Button("Maybe later") { onDone(interests) }
                .frame(maxWidth: .infinity)
                .padding(.top, 10)
            Button("Back") { step = .interests }
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
        }
        .padding(24)
        .sheet(isPresented: $choosingApps) {
            GuardAppsSheet {
                choosingApps = false
                onDone(interests)
            }
        }
    }
}
