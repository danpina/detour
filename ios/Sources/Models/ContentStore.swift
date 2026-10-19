import Foundation
import UIKit

struct LoadedContent {
    let cards: [Card]
    /// Human-readable problems (a card that failed to decode, a missing image). Empty when everything is fine.
    let issues: [String]
    let root: URL?
}

enum ContentStore {
    /// The bundled `published` folder (cards/*.json, images/*.webp, manifest.json).
    /// Searches every loaded bundle so it also works inside unit tests.
    static func publishedRoot() -> URL? {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "published", withExtension: nil) {
                return url
            }
        }
        return nil
    }

    static func load(from rootOverride: URL? = nil) -> LoadedContent {
        guard let root = rootOverride ?? publishedRoot() else {
            return LoadedContent(cards: [], issues: ["The bundled content folder was not found."], root: nil)
        }
        let cardsDir = root.appendingPathComponent("cards")
        let files: [URL]
        do {
            files = try FileManager.default.contentsOfDirectory(at: cardsDir, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension == "json" }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
        } catch {
            return LoadedContent(cards: [], issues: ["Could not read cards: \(error.localizedDescription)"], root: root)
        }

        var cards: [Card] = []
        var issues: [String] = []
        let decoder = JSONDecoder()
        for file in files {
            do {
                let card = try decoder.decode(Card.self, from: Data(contentsOf: file))
                if let image = card.image {
                    let imagePath = root.appendingPathComponent("images").appendingPathComponent(image.file).path
                    if !FileManager.default.fileExists(atPath: imagePath) {
                        issues.append("\(card.id): image \(image.file) is missing")
                    }
                }
                cards.append(card)
            } catch {
                issues.append("\(file.lastPathComponent): \(error)")
            }
        }
        return LoadedContent(cards: cards, issues: issues, root: root)
    }

    static func image(for card: Card, root: URL?) -> UIImage? {
        guard let root, let file = card.image?.file else { return nil }
        return UIImage(contentsOfFile: root.appendingPathComponent("images").appendingPathComponent(file).path)
    }
}
