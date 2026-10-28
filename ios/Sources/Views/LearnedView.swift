import SwiftUI

/// Everything you've learned, to search and read again. Reading here records nothing: no progress, no reviews.
struct LearnedView: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var topic: Interest? = nil
    @State private var open: LearnedRow? = nil

    private var topics: [Interest] { Interest.allCases.filter { $0 != .games && $0 != .estimation } }

    var body: some View {
        let rows = model.learnedCards()
        let shown = Learned.filter(rows, query: query, topic: topic)
        let now = Date()
        Group {
            if rows.isEmpty {
                VStack(spacing: 12) {
                    Text("Nothing here yet").font(.title3.weight(.semibold))
                    Text("Every card you finish lands here, so you can read it again.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                chip("All", selected: topic == nil) { topic = nil }
                                ForEach(topics, id: \.self) { interest in
                                    chip(interest.displayName, selected: topic == interest) { topic = interest }
                                }
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                    }
                    Section {
                        ForEach(shown) { row in
                            Button { open = row } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(row.card.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                                    Text("\(row.card.interest.displayName) · \(Learned.stateLabel(row.state)) · learned \(Learned.ago(row.learnedAt, now: now))")
                                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                                }
                            }
                        }
                        if shown.isEmpty {
                            Text("No card matches. Try fewer words.").foregroundStyle(.secondary)
                        }
                    } header: {
                        Text("\(shown.count) \(shown.count == 1 ? "card" : "cards")")
                    }
                }
                .searchable(text: $query, prompt: "Search your cards")
            }
        }
        .navigationTitle("What you've learned")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $open) { row in LearnedDetail(row: row) }
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(selected ? .semibold : .regular))
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(selected ? Color.teal.opacity(0.18) : Color(.secondarySystemBackground), in: Capsule())
                .overlay(Capsule().stroke(selected ? Color.teal : Color.clear, lineWidth: 1.5))
                .foregroundStyle(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A finished card, read-only: the picture, the text and where it comes from.
private struct LearnedDetail: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let row: LearnedRow

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let image = ContentStore.image(for: row.card, root: model.content.root) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .accessibilityLabel(row.card.image?.alt ?? "")
                    }
                    ForEach(Array(Learned.paragraphs(row.card).enumerated()), id: \.offset) { _, text in
                        Text(text).font(.body)
                    }
                    Text("Where this comes from").font(.subheadline).foregroundStyle(.secondary).padding(.top, 8)
                    ForEach(row.card.sources, id: \.url) { source in
                        if let url = URL(string: source.url) {
                            Link(source.title, destination: url)
                        } else {
                            Text(source.title)
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle(row.card.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
