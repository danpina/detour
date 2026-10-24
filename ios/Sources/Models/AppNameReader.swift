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
    /// What reading one label produced: the words found, and how many pixels differ from the background (zero means a blank picture).
    struct Result {
        var lines: [String] = []
        var inkPixels = 0
        var note = ""
    }

    /// Tries the label on a light background, then on a dark one, and keeps the first picture that shows any text.
    static func read(_ token: ApplicationToken) async -> Result {
        var notes: [String] = []
        for dark in [false, true] {
            let attempt = await readOnce(token, dark: dark)
            notes.append((dark ? "dark" : "light") + ":" + String(attempt.inkPixels) + (attempt.note.isEmpty ? "" : "(" + attempt.note + ")"))
            if attempt.inkPixels > 0 {
                var result = attempt
                result.note = notes.joined(separator: " ")
                return result
            }
        }
        return Result(note: notes.joined(separator: " "))
    }

    private static func readOnce(_ token: ApplicationToken, dark: Bool) async -> Result {
        guard let window = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first else { return Result(note: "no window") }
        let background: Color = dark ? .black : .white
        let label = Label(token)
            .labelStyle(.titleOnly)
            .font(.system(size: 34, weight: .semibold))
            .padding(12)
            .frame(width: 360, height: 90, alignment: .leading)
            .background(background)
            .environment(\.colorScheme, dark ? .dark : .light)
        let host = UIHostingController(rootView: label)
        host.overrideUserInterfaceStyle = dark ? .dark : .light
        host.view.frame = CGRect(x: 0, y: 0, width: 360, height: 90)
        host.view.backgroundColor = dark ? .black : .white
        let container = UIView(frame: host.view.frame)
        container.overrideUserInterfaceStyle = dark ? .dark : .light
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
        guard let cgImage = image.cgImage else { return Result(note: "no image") }
        let ink = inkPixelCount(cgImage, darkBackground: dark)
        return Result(lines: ink > 0 ? await recognize(cgImage) : [], inkPixels: ink, note: String(cgImage.width) + "x" + String(cgImage.height))
    }

    /// How many pixels differ clearly from the plain background. A blank picture has none.
    private static func inkPixelCount(_ image: CGImage, darkBackground: Bool) -> Int {
        let width = image.width
        let height = image.height
        var pixels = [UInt8](repeating: darkBackground ? 0 : 255, count: width * height)
        guard let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return -1 }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pixels.filter { darkBackground ? $0 > 60 : $0 < 195 }.count
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
