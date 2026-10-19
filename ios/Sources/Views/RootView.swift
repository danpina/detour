import SwiftUI

struct SessionRun: Identifiable {
    let id = UUID()
    let items: [SessionItem]
    let feed: Bool
}

enum MainTab: Hashable {
    case home, progress, settings
}

struct RootView: View {
    @Environment(AppModel.self) private var model
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
                    HomeView(start: start)
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
        .fullScreenCover(item: $run) { current in
            SessionView(
                run: current,
                onAnother: { start(feed: false) },
                onProgress: {
                    tab = .progress
                    run = nil
                },
                onNextFeedSet: { start(feed: true) },
                onClose: { run = nil }
            )
            .environment(model)
        }
    }

    private func start(feed: Bool) {
        run = SessionRun(items: model.makeSet(), feed: feed)
    }
}
