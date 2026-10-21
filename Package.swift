// swift-tools-version: 5.9
// Lives at the repo root so SwiftPM can resolve it from the repository URL.
import PackageDescription

let package = Package(
    name: "Pixie",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "Pixie", targets: ["Pixie"]),
    ],
    targets: [
        .target(name: "Pixie", path: "packages/swift/Sources/Pixie"),
        .testTarget(name: "PixieTests", dependencies: ["Pixie"], path: "packages/swift/Tests/PixieTests"),
    ]
)
