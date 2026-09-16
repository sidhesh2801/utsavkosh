import Foundation
import Vision
import AppKit

// macOS's own text recognition, so twenty-nine screenshots cost nothing but
// a few seconds of CPU instead of being read as images.
for path in CommandLine.arguments.dropFirst() {
    guard let image = NSImage(contentsOfFile: path),
          let data = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: data),
          let cg = bitmap.cgImage else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])

    print("=== \(URL(fileURLWithPath: path).lastPathComponent)")
    for line in (request.results ?? []).compactMap({ $0.topCandidates(1).first?.string }) {
        print(line)
    }
}
