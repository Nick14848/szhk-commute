import Foundation
import AVFoundation
import CoreMedia
import CoreVideo

// Local macOS helper; no browser, external tools, or package dependencies.
// swift -module-cache-path /tmp/szhk-swift-cache video-inspect.swift movie.mp4
// Add --decode after the filename to verify decoded frames, not only samples.
// --h264 <input.mp4> <new-output.mp4> exports using the native quality preset,
// then checks that the result really is H.264. Existing files are never replaced.

func failure(_ message: String) -> NSError {
    NSError(domain: "SZHKVideoInspect", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

func fourCC(_ value: FourCharCode) -> String {
    String(bytes: [24, 16, 8, 0].map { UInt8((value >> $0) & 0xff) }, encoding: .ascii) ?? String(value)
}

func inspect(_ url: URL, decode: Bool) async throws -> [String: Any] {
    guard FileManager.default.fileExists(atPath: url.path) else { throw failure("Missing file: \(url.path)") }
    let asset = AVURLAsset(url: url)
    let duration = try await asset.load(.duration)
    let videoTracks = try await asset.loadTracks(withMediaType: .video)
    let audioTracks = try await asset.loadTracks(withMediaType: .audio)
    guard !videoTracks.isEmpty else { throw failure("AVFoundation found no readable video track") }
    var videos: [[String: Any]] = []
    for track in videoTracks {
        let size = try await track.load(.naturalSize)
        let transform = try await track.load(.preferredTransform)
        let display = CGRect(origin: .zero, size: size).applying(transform)
        let nominalFPS = try await track.load(.nominalFrameRate)
        let descriptions = try await track.load(.formatDescriptions)
        let reader = try AVAssetReader(asset: asset)
        let settings: [String: Any]? = decode ? [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA] : nil
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else { throw failure("Cannot read video track") }
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? failure("Reader did not start") }
        var frames: Int64 = 0
        var first = Double.greatestFiniteMagnitude
        var last = -Double.greatestFiniteMagnitude
        var lastEnd: Double?
        while let sample = output.copyNextSampleBuffer() {
            frames += Int64(CMSampleBufferGetNumSamples(sample))
            let pts = CMSampleBufferGetPresentationTimeStamp(sample).seconds
            let sampleDuration = CMSampleBufferGetDuration(sample).seconds
            if pts.isFinite {
                first = min(first, pts)
                last = max(last, pts)
                if sampleDuration.isFinite && sampleDuration > 0 {
                    lastEnd = max(lastEnd ?? pts, pts + sampleDuration)
                }
            }
        }
        guard reader.status == .completed else { throw reader.error ?? failure("Incomplete video read: \(reader.status.rawValue)") }
        guard frames > 0 else { throw failure("Video track contains no frames") }
        videos.append([
            "trackID": track.trackID,
            "codecFourCC": descriptions.map { fourCC(CMFormatDescriptionGetMediaSubType($0)) },
            "encodedWidth": Int(size.width.rounded()), "encodedHeight": Int(size.height.rounded()),
            "displayWidth": Int(abs(display.width).rounded()), "displayHeight": Int(abs(display.height).rounded()),
            "nominalFrameRate": nominalFPS.isFinite ? Double(nominalFPS) : 0,
            "frameCount": frames,
            "firstFramePTS": first != Double.greatestFiniteMagnitude ? first as Any : NSNull(),
            "lastFramePTS": last != -Double.greatestFiniteMagnitude ? last as Any : NSNull(),
            "lastSampleEndPTS": lastEnd.map { $0 as Any } ?? NSNull(),
            "decoded": decode
        ])
    }
    let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
    return [
        "file": url.path, "bytes": attrs[.size] ?? 0,
        "durationSeconds": duration.seconds.isFinite ? duration.seconds : 0,
        "videoTracks": videos, "audioTrackCount": audioTracks.count
    ]
}

func exportH264(_ source: URL, _ destination: URL) async throws -> [String: Any] {
    guard FileManager.default.fileExists(atPath: source.path) else { throw failure("Missing source file") }
    guard !FileManager.default.fileExists(atPath: destination.path) else { throw failure("Output already exists; refusing to replace it") }
    guard destination.pathExtension.lowercased() == "mp4" else { throw failure("H.264 destination must end in .mp4") }
    let asset = AVURLAsset(url: source)
    guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
        throw failure("AVFoundation cannot export this input format; WebM is not assumed supported")
    }
    exporter.shouldOptimizeForNetworkUse = true
    try await exporter.export(to: destination, as: .mp4)
    let report = try await inspect(destination, decode: false)
    guard let tracks = report["videoTracks"] as? [[String: Any]],
          let codecs = tracks.first?["codecFourCC"] as? [String], codecs.contains("avc1") else {
        throw failure("Export created a file but its codec is not avc1/H.264; inspect the output before using it")
    }
    return report.merging(["exportedH264": true, "sourceFile": source.path]) { _, new in new }
}

func selfTest() async throws -> [String: Any] {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("szhk-video-probe-\(UUID().uuidString).mp4")
    let exportedURL = FileManager.default.temporaryDirectory.appendingPathComponent("szhk-video-export-probe-\(UUID().uuidString).mp4")
    defer {
        try? FileManager.default.removeItem(at: url)
        try? FileManager.default.removeItem(at: exportedURL)
    }
    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: 120, AVVideoHeightKey: 80
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: 120, kCVPixelBufferHeightKey as String: 80
    ])
    guard writer.canAdd(input) else { throw failure("No H.264 writer input available") }
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? failure("Writer did not start") }
    writer.startSession(atSourceTime: .zero)
    for index in 0..<24 {
        let deadline = Date().addingTimeInterval(10)
        while !input.isReadyForMoreMediaData {
            guard writer.status == .writing, Date() < deadline else { throw writer.error ?? failure("H.264 writer timed out") }
            try await Task.sleep(nanoseconds: 5_000_000)
        }
        var pixel: CVPixelBuffer?
        guard CVPixelBufferCreate(kCFAllocatorDefault, 120, 80, kCVPixelFormatType_32BGRA, nil, &pixel) == kCVReturnSuccess,
              let pixel else { throw failure("Could not allocate test frame") }
        CVPixelBufferLockBaseAddress(pixel, [])
        if let address = CVPixelBufferGetBaseAddress(pixel) {
            memset(address, Int32(40 + index * 5), CVPixelBufferGetBytesPerRow(pixel) * 80)
        }
        CVPixelBufferUnlockBaseAddress(pixel, [])
        guard adaptor.append(pixel, withPresentationTime: CMTime(value: Int64(index), timescale: 24)) else {
            throw writer.error ?? failure("H.264 frame append failed")
        }
    }
    writer.endSession(atSourceTime: CMTime(value: 1, timescale: 1))
    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? failure("H.264 writer did not complete") }
    let result = try await inspect(url, decode: true)
    guard let tracks = result["videoTracks"] as? [[String: Any]],
          tracks.first?["frameCount"] as? Int64 == 24,
          tracks.first?["codecFourCC"] as? [String] == ["avc1"] else {
        throw failure("H.264 self-test frame count / codec mismatch")
    }
    _ = try await exportH264(url, exportedURL)
    let exported = try await inspect(exportedURL, decode: true)
    guard let exportedTracks = exported["videoTracks"] as? [[String: Any]],
          exportedTracks.first?["frameCount"] as? Int64 == 24,
          exportedTracks.first?["displayWidth"] as? Int == 120,
          exportedTracks.first?["displayHeight"] as? Int == 80 else {
        throw failure("Native H.264 export changed the test frame count or size")
    }
    return result.merging(["selfTest": "passed", "nativeH264Export": "passed", "temporaryFileRemovedOnExit": true]) { _, new in new }
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let filename = args.first else { throw failure("Usage: video-inspect.swift <movie.mp4> [--decode] | --self-test | --h264 <source> <new-output.mp4>") }
    let report: [String: Any]
    if filename == "--self-test" {
        report = try await selfTest()
    } else if filename == "--h264" {
        guard args.count == 3 else { throw failure("--h264 requires source and new output filenames") }
        report = try await exportH264(URL(fileURLWithPath: args[1]), URL(fileURLWithPath: args[2]))
    } else {
        report = try await inspect(URL(fileURLWithPath: filename), decode: args.contains("--decode"))
    }
    let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    print(String(decoding: json, as: UTF8.self))
} catch {
    FileHandle.standardError.write(Data("Video inspection failed: \(error as NSError)\n".utf8))
    exit(1)
}
