import SwiftUI

struct SessionRun: Identifiable {
    let id = UUID()
    let items: [SessionItem]
    let feed: Bool
    /// Started from the shield's Start button: finishing it unlocks the guarded apps. Sets started inside Detour do not.
    var guarded = false
    /// Which kind of round this is, so "Another" starts the same kind again.
    var kind: AppModel.RoundKind = .learning
}

enum MainTab: Hashable {
    case home, games, progress, settings
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(GuardManager.self) private var guardManager
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @State private var run: SessionRun?
    @State private var tab: MainTab = .home
    /// Why the round choice is showing. It is always asked: when Detour is opened from a guarded app's shield, and after a round.
    private enum Choice {
        case shield, another, widget

        var title: String {
            switch self {
            case .shield: return "Quick one first?"
            case .another: return "Another one?"
            case .widget: return "Quick one?"
            }
        }

        var subtitle: String {
            switch self {
            case .shield: return "Pick a round, then your app is yours for a while."
            case .another, .widget: return "Pick a round. Cards, math or games."
            }
        }

        var closeLabel: String {
            switch self {
            case .shield: return "Not now"
            case .another: return "Done for now"
            case .widget: return "Not now"
            }
        }
    }
    @State private var choosing: Choice?

    var body: some View {
        Group {
            if !model.settings.onboardingDone {
                FirstRunView { interests in
                    model.completeOnboarding(interests: interests)
                    start(feed: false)
                }
            } else {
                TabView(selection: $tab) {
                    HomeView(
                        start: { kind in start(feed: false, kind: kind) },
                        startSpecific: { specific, kind in start(feed: false, kind: kind, specific: specific) },
                        openGames: { tab = .games }
                    )
                        .tabItem { Label("Home", systemImage: "bolt.fill") }
                        .tag(MainTab.home)
                    GamesView()
                        .tabItem { Label("Games", systemImage: "gamecontroller.fill") }
                        .tag(MainTab.games)
                    ProgressScreen()
                        .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
                        .tag(MainTab.progress)
                    SettingsView()
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                        .tag(MainTab.settings)
                }
            }
        }
        .overlay {
            if let reason = choosing {
                RoundChooserView(
                    title: reason.title,
                    subtitle: reason.subtitle,
                    closeLabel: reason.closeLabel,
                    start: { kind in
                        choosing = nil
                        start(feed: false, why: reason == .shield ? "shield start" : "button", kind: kind)
                    },
                    onClose: { choosing = nil }
                )
            }
        }
        .onOpenURL { url in openedFromWidget(url) }
        .onAppear { model.publishWidget() }
        .onChange(of: scenePhase) { _, phase in
            AppLog.log("scene: \(String(describing: phase))")
            if phase == .active { appBecameActive() }
        }
        .fullScreenCover(item: $run) { current in
            SessionView(
                run: current,
                onSetFinished: {
                    guard run?.guarded == true else {
                        AppLog.log("set finished: not started from the shield, so the guarded apps stay as they are")
                        return nil
                    }
                    return guardManager.unlockAfterSet()
                },
                returnAppProvider: { run?.guarded == true ? guardManager.returnApp : nil },
                onReturn: { app, completion in
                    AppLog.log("going back to \(app.name ?? app.bundleIdentifier)")
                    openURL(app.url) { accepted in
                        AppLog.log("going back: iOS " + (accepted ? "opened it" : "did not open it"))
                        completion(accepted)
                        if accepted { run = nil }
                    }
                },
                onAnother: {
                    // Always ask which round: close this one and show the three choices.
                    run = nil
                    choosing = .another
                },
                onProgress: {
                    tab = .progress
                    run = nil
                },
                onNextFeedSet: { start(feed: true) },
                onClose: {
                    AppLog.log("session closed by the user")
                    run = nil
                }
            )
            // A new run must start from a clean screen. Without this the old set's progress (including its end screen) was reused.
            .id(current.id)
            .environment(model)
        }
    }

    /// The widget opens detour://round (the three choices) or detour://learning, math, games (straight into that round).
    private func openedFromWidget(_ url: URL) {
        guard url.scheme == "detour", model.settings.onboardingDone else { return }
        AppLog.log("opened from the widget: \(url.absoluteString)")
        run = nil
        switch url.host {
        case "learning": start(feed: false, why: "widget", kind: .learning)
        case "math": start(feed: false, why: "widget", kind: .math)
        case "games": start(feed: false, why: "widget", kind: .games)
        default: choosing = .widget
        }
    }

    /// Back in front: put the shield back if its timer never fired, and open a session if the shield's Start button asked for one.
    private func appBecameActive() {
        guardManager.refresh()
        model.publishWidget()
        if guardManager.consumePendingSession() {
            AppLog.log("opened from the shield's Start button (session open already: \(run != nil))")
            // Coming from a guarded app always asks which round to take (cards, math or games), replacing anything already open.
            if model.settings.onboardingDone {
                run = nil
                choosing = .shield
            }
        }
    }

    private func start(feed: Bool, why: String = "button", kind: AppModel.RoundKind = .learning, specific: AppModel.Specific? = nil) {
        let items = model.makeSet(kind: kind, specific: specific)
        if items.isEmpty {
            AppLog.log("start set: nothing to show for \(String(describing: specific))")
            return
        }
        AppLog.log("start set: feed=\(feed) why=\(why) kind=\(kind.rawValue) items=\(items.count)")
        run = SessionRun(items: items, feed: feed, guarded: why == "shield start", kind: kind)
    }

}
