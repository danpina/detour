import SwiftUI

@main
struct DetourApp: App {
    @State private var model = AppModel()
    @State private var guardManager = GuardManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(guardManager)
        }
    }
}
