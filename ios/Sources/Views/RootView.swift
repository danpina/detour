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

    var body: some View {
        Group {
            if !model.settings.onboardingDone {
                FirstRunView { interests in
                    model.completeOnboarding(interests: interests)
                    start(feed: false)
                }
            } else {
                TabView(selection: $tab) {
                    HomeView { kind in start(feed: false, kind: kind) }
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
                onAnother: { start(feed: false, kind: current.kind) },
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

    /// Back in front: put the shield back if its timer never fired, and open a session if the shield's Start button asked for one.
    private func appBecameActive() {
        guardManager.refresh()
        if guardManager.consumePendingSession() {
            AppLog.log("opened from the shield's Start button (session open already: \(run != nil))")
            // A guarded session is always a fresh, plain set (never the endless feed), replacing anything already open.
            if model.settings.onboardingDone {
                let kind = AppModel.RoundKind(rawValue: guardManager.settings.detourRound ?? "learning") ?? .learning
                start(feed: false, why: "shield start", kind: kind)
            }
        }
    }

    private func start(feed: Bool, why: String = "button", kind: AppModel.RoundKind = .learning) {
        let items = model.makeSet(kind: kind)
        AppLog.log("start set: feed=\(feed) why=\(why) kind=\(kind.rawValue) items=\(items.count)")
        run = SessionRun(items: items, feed: feed, guarded: why == "shield start", kind: kind)
    }

}
