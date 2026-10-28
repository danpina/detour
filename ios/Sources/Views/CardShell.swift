import SwiftUI

/// What a card screen can ask the session to do.
struct SessionActions {
    /// The user engaged with the card (revealed, answered, read to the end). `correct` is nil for cards with no answer.
    var complete: (_ correct: Bool?) -> Void
    var next: () -> Void
    var previous: () -> Void
}

/// Full-screen frame: image background, readable scrims, progress, and credit / sources / report actions.
struct CardShell<Content: View>: View {
    @Environment(AppModel.self) private var model
    let card: Card
    let index: Int
    let total: Int
    let label: String
    let actions: SessionActions
    var dim = false
    @ViewBuilder let content: () -> Content

    @State private var sheet: ShellSheet?

    enum ShellSheet: Identifiable {
        case credit, sources, report
        var id: Int {
            switch self {
            case .credit: return 0
            case .sources: return 1
            case .report: return 2
            }
        }
    }

    private var uiImage: UIImage? { ContentStore.image(for: card, root: model.content.root) }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            GeometryReader { geo in
                if let uiImage {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                        .accessibilityLabel(card.image?.alt ?? "")
                }
            }
            .ignoresSafeArea()

            Color.black.opacity(dim ? 0.55 : 0).ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.7), .clear], startPoint: .top, endPoint: .bottom).frame(height: 170).frame(maxHeight: .infinity, alignment: .top).ignoresSafeArea()
            LinearGradient(colors: [.clear, .black.opacity(0.6), .black.opacity(0.9)], startPoint: .top, endPoint: .bottom).frame(height: 480).frame(maxHeight: .infinity, alignment: .bottom).ignoresSafeArea()

            content()

            VStack(spacing: 10) {
                HStack(spacing: 4) {
                    ForEach(0..<total, id: \.self) { i in
                        Capsule().fill(i <= index ? Color.white.opacity(i == index ? 0.9 : 1) : Color.white.opacity(0.3)).frame(height: 4)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Card \(index + 1) of \(total)")
                HStack(spacing: 6) {
                    // The topic first, so it is always clear which section a card belongs to; then what kind of card it is.
                    chip(card.interest.topicEmoji + " " + card.interest.topicName, bold: true)
                    chip(label)
                    Spacer()
                    Button { sheet = .sources } label: { chip("Sources") }
                    Button { sheet = .report } label: { chip("Report") }.accessibilityLabel("Report an error")
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8) // sits below the status bar and camera area: only the backdrop ignores the safe area
            .frame(maxHeight: .infinity, alignment: .top)

            if card.image != nil {
                Button { sheet = .credit } label: {
                    Image(systemName: "info.circle")
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.9))
                        .padding(8)
                        .background(.black.opacity(0.5), in: Circle())
                }
                .accessibilityLabel("Image credit and license")
                .padding(12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
        }
        .foregroundStyle(.white)
        // Swipe left = next card, right = previous. Children with their own drags (the estimate slider) win.
        .gesture(
            DragGesture(minimumDistance: 40).onEnded { value in
                guard abs(value.translation.width) > 70, abs(value.translation.width) > abs(value.translation.height) * 1.6 else { return }
                if value.translation.width < 0 { actions.next() } else { actions.previous() }
            }
        )
        .sheet(item: $sheet) { which in
            switch which {
            case .credit: CreditSheet(card: card)
            case .sources: SourcesSheet(card: card)
            case .report: ReportSheet(card: card)
            }
        }
    }

    private func chip(_ text: String, bold: Bool = false) -> some View {
        Text(text)
            .font(bold ? .caption.weight(.semibold) : .caption)
            .foregroundStyle(.white.opacity(bold ? 1 : 0.85))
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.black.opacity(bold ? 0.55 : 0.4), in: Capsule())
    }
}

extension Interest {
    /// The emoji shown with a card's topic. Matches the topic picker.
    var topicEmoji: String {
        switch self {
        case .history: return "🏛️"
        case .science: return "🔭"
        case .money: return "🪙"
        case .tech: return "💡"
        case .mind: return "🧠"
        case .numbers: return "🔢"
        case .estimation: return "⚖️"
        case .games: return "🎮"
        }
    }

    /// A short name that fits in the card header.
    var topicName: String {
        switch self {
        case .money: return "Money"
        case .mind: return "Mind"
        case .numbers: return "Numbers"
        default: return displayName
        }
    }
}

// MARK: Sheets

struct CreditSheet: View {
    let card: Card
    var body: some View {
        NavigationStack {
            List {
                if let image = card.image {
                    LabeledContent("Credit", value: image.kind == "generated" ? "Illustration" : image.credit)
                    LabeledContent("License", value: image.license)
                    LabeledContent("Type", value: image.kind == "generated" ? "Generated illustration" : image.kind == "artwork" ? "Artwork" : "Photo")
                    if let url = image.source_url.flatMap(URL.init(string:)) {
                        Link("View original", destination: url)
                    }
                }
            }
            .navigationTitle("Image credit")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }
}

struct SourcesSheet: View {
    let card: Card
    var body: some View {
        NavigationStack {
            List(card.sources, id: \.url) { source in
                if let url = URL(string: source.url) {
                    Link(source.title, destination: url)
                } else {
                    Text(source.title)
                }
            }
            .navigationTitle("Where this comes from")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }
}

struct ReportSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let card: Card
    @State private var sent = false

    private let reasons: [(code: String, label: String)] = [
        ("wrong_fact", "Something here is wrong"),
        ("unclear", "It's confusing"),
        ("bad_image", "The image doesn't fit"),
        ("other", "Something else"),
    ]

    var body: some View {
        NavigationStack {
            List {
                if sent {
                    Text("Thanks. We'll take a look.")
                } else {
                    Section(footer: Text("Pick the closest one. Nothing else is sent.")) {
                        ForEach(reasons, id: \.code) { reason in
                            Button(reason.label) {
                                model.reported(cardId: card.id, reason: reason.code)
                                sent = true
                            }
                        }
                    }
                }
            }
            .navigationTitle("Spotted a problem?")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }
}

// MARK: Shared button style for primary actions on cards

struct WhitePill: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white, in: RoundedRectangle(cornerRadius: 16))
    }
}

extension View {
    func whitePill() -> some View { modifier(WhitePill()) }
}
