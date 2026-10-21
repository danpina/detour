import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    let start: (_ feed: Bool) -> Void

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("Quick one?").font(.largeTitle.weight(.semibold))
            Text("\(model.settings.setSize) small cards, about a minute.").foregroundStyle(.secondary)

            if model.dueCount > 0 {
                Text(model.dueCount == 1 ? "1 thing is ready to check if it stuck." : "\(model.dueCount) things are ready to check if they stuck.")
                    .font(.subheadline)
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(Color.accentColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .padding(.top, 8)
            }

            Button {
                start(false)
            } label: {
                Text("Let's go").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 16)
            Spacer()
        }
        .padding(.horizontal, 28)
    }
}
