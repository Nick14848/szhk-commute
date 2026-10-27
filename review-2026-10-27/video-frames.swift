import Foundation
import AVFoundation
import AppKit
import CoreGraphics
import CoreText

// Extract actual decoded frames; no browser or screen-capture APIs.
// swift -module-cache-path /tmp/szhk-swift-cache video-frames.swift \
//   input.mp4 new-frame-directory 1,9,16,24,34,43,52,61 --sheet

func failure(_ message: String) -> NSError {
    NSError(domain: "SZHKVideoFrames", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

func writePNG(_ image: CGImage, to url: URL) throws {
    guard !FileManager.default.fileExists(atPath: url.path) else { throw failure("Refusing to replace existing file: \(url.path)") }
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let png = bitmap.representation(using: .png, properties: [:]) else { throw failure("PNG encoding failed") }
    try png.write(to: url, options: .atomic)
}

struct Sample {
    let requested: Double
    let actual: Double
    let image: CGImage
    let path: String
}

func contactSheet(_ samples: [Sample], to url: URL) throws {
    guard let first = samples.first else { throw failure("No samples for contact sheet") }
    let columns = min(4, samples.count)
    let rows = (samples.count + columns - 1) / columns
    let thumbWidth = 240
    let thumbHeight = max(1, Int((Double(thumbWidth) * Double(first.image.height) / Double(first.image.width)).rounded()))
    let gap = 16, captionHeight = 26
    let width = columns * thumbWidth + (columns + 1) * gap
    let height = rows * (thumbHeight + captionHeight) + (rows + 1) * gap
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw failure("Contact sheet context allocation failed")
    }
    context.setFillColor(CGColor(red: 0.94, green: 0.96, blue: 0.96, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    context.interpolationQuality = .none
    let font = CTFontCreateWithName("Helvetica" as CFString, 11, nil)
    let ink = CGColor(red: 0.08, green: 0.18, blue: 0.25, alpha: 1)
    for (index, sample) in samples.enumerated() {
        let column = index % columns, row = index / columns
        let x = gap + column * (thumbWidth + gap)
        let y = height - gap - row * (thumbHeight + captionHeight + gap) - thumbHeight
        context.draw(sample.image, in: CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(thumbWidth), height: CGFloat(thumbHeight)))
        let caption = String(format: "%.3fs  (decoded %.3fs)", sample.requested, sample.actual)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: caption, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): ink
        ]) as CFAttributedString)
        context.textPosition = CGPoint(x: CGFloat(x), y: CGFloat(y - 18))
        CTLineDraw(line, context)
    }
    guard let image = context.makeImage() else { throw failure("Contact sheet rendering failed") }
    try writePNG(image, to: url)
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    if args == ["--help"] {
        print("Usage: video-frames.swift <input.mp4> <new-output-directory> <seconds,seconds,...> [--sheet]")
        exit(0)
    }
    guard args.count >= 3 else { throw failure("Usage: video-frames.swift <input.mp4> <new-output-directory> <seconds,seconds,...> [--sheet]") }
    let source = URL(fileURLWithPath: args[0])
    let directory = URL(fileURLWithPath: args[1], isDirectory: true)
    guard FileManager.default.fileExists(atPath: source.path) else { throw failure("Missing video: \(source.path)") }
    let parts = args[2].split(separator: ",", omittingEmptySubsequences: false)
    let times = parts.compactMap { Double($0) }
    guard !times.isEmpty, times.count == parts.count, times.allSatisfy({ $0.isFinite && $0 >= 0 }) else {
        throw failure("Sample seconds must be a comma-separated list of finite, nonnegative numbers")
    }
    let asset = AVURLAsset(url: source)
    let duration = try await asset.load(.duration).seconds
    guard duration.isFinite, duration > 0, times.allSatisfy({ $0 < duration }) else {
        throw failure("All sample times must be earlier than video duration \(duration)s")
    }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    var samples: [Sample] = []
    for (index, seconds) in times.enumerated() {
        let frame = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 60_000))
        let name = String(format: "frame-%02d-%08.3fs.png", index + 1, seconds)
        let target = directory.appendingPathComponent(name)
        try writePNG(frame.image, to: target)
        samples.append(Sample(requested: seconds, actual: frame.actualTime.seconds, image: frame.image, path: target.path))
    }
    var report: [String: Any] = [
        "video": source.path, "durationSeconds": duration,
        "frames": samples.map { ["requestedSeconds": $0.requested, "actualSeconds": $0.actual,
                                 "width": $0.image.width, "height": $0.image.height, "file": $0.path] as [String: Any] }
    ]
    if args.contains("--sheet") {
        let sheet = directory.appendingPathComponent("contact-sheet.png")
        try contactSheet(samples, to: sheet)
        report["contactSheet"] = sheet.path
    }
    let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    print(String(decoding: json, as: UTF8.self))
} catch {
    FileHandle.standardError.write(Data("Video frame extraction failed: \(error as NSError)\n".utf8))
    exit(1)
}
