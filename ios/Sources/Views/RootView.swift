import SwiftUI

struct SessionRun: Identifiable {
    let id = UUID()
    let items: [SessionItem]
    let feed: Bool
    /// Started from the shield's Start button: finishing it unlocks the guarded apps. Sets started inside Detour do not.
    var guarded = false
    /// A practice round for one skill, started from the Practice section.
    var practice: TrackId?
}

enum MainTab: Hashable {
    case home, progress, settings
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(GuardManager.self) private var guardManager
    @Environment(\.scenePhase) private var scenePhase
    @State private var run: SessionRun?
    @State private var tab: MainTab = .home

    var body: some View {
        Group {
            if !model.settings.onboardingDone {
                OnboardingView(initial: []) { interests in
                    model.completeOnboarding(interests: interests)
                    start(feed: false)
                }
            } else {
                TabView(selection: $tab) {
                    HomeView(start: start, practice: startPractice)
                        .tabItem { Label("Home", systemImage: "bolt.fill") }
                        .tag(MainTab.home)
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
                onAnother: {
                    if let track = run?.practice { startPractice(track) } else { start(feed: false) }
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
            .environment(model)
        }
    }

    /// Back in front: put the shield back if its timer never fired, and open a session if the shield's Start button asked for one.
    private func appBecameActive() {
        guardManager.refresh()
        if guardManager.consumePendingSession() {
            AppLog.log("opened from the shield's Start button (session open already: \(run != nil))")
            if model.settings.onboardingDone, run == nil {
                start(feed: false, why: "shield start")
            } else if run != nil {
                run?.guarded = true
                AppLog.log("the open session now counts as the guarded one")
            }
        }
    }

    private func start(feed: Bool) {
        start(feed: feed, why: "button")
    }

    private func start(feed: Bool, why: String) {
        let items = model.makeSet()
        AppLog.log("start set: feed=\(feed) why=\(why) items=\(items.count)")
        run = SessionRun(items: items, feed: feed, guarded: why == "shield start")
    }

    private func startPractice(_ track: TrackId) {
        let items = model.makeDrillSet(track)
        AppLog.log("start practice: track=\(track.rawValue)")
        run = SessionRun(items: items, feed: false, practice: track)
    }
}
