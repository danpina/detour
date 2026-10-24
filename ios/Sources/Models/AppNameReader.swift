import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit
import Vision

/// iOS shows a guarded app's name and icon in its own sealed view and never hands Detour the name as text. This draws that
/// view off to the side, takes a picture of it and reads the words on the device, so Detour can tell which app it is.
/// It is a best effort: if iOS leaves the picture blank, nothing is read and Detour simply asks the user. Nothing leaves the device.
@MainActor
enum AppNameReader {
    /// The lines of text found in the picture of the token's label, or an empty list.
    static func read(_ token: ApplicationToken) async -> [String] {
        guard let window = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first else { return [] }
        let label = Label(token)
            .labelStyle(.titleOnly)
            .font(.system(size: 34, weight: .semibold))
            .foregroundStyle(Color.black)
            .padding(12)
            .frame(width: 360, height: 90, alignment: .leading)
            .background(Color.white)
            .environment(\.colorScheme, .light)
        let host = UIHostingController(rootView: label)
        host.view.frame = CGRect(x: 0, y: 0, width: 360, height: 90)
        host.view.backgroundColor = .white
        let container = UIView(frame: host.view.frame)
        container.alpha = 0.01
        container.isUserInteractionEnabled = false
        window.addSubview(container)
        container.addSubview(host.view)
        defer {
            host.view.removeFromSuperview()
            container.removeFromSuperview()
        }
        // Give the system view a moment to draw itself.
        try? await Task.sleep(nanoseconds: 700_000_000)
        let renderer = UIGraphicsImageRenderer(size: host.view.bounds.size)
        let image = renderer.image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
        guard let cgImage = image.cgImage else { return [] }
        return await recognize(cgImage)
    }

    private static func recognize(_ image: CGImage) async -> [String] {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false
                let handler = VNImageRequestHandler(cgImage: image)
                try? handler.perform([request])
                let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                continuation.resume(returning: lines)
            }
        }
    }
}
