plugins {
    kotlin("jvm")
    kotlin("plugin.compose")
    id("org.jetbrains.compose")
}

group = "io.github.dhri-yama"
version = "0.1.0"

kotlin {
    explicitApi()
}

dependencies {
    api(project(":pixie"))
    implementation(compose.runtime)
    implementation(compose.foundation)
    implementation(compose.ui)

    testImplementation(kotlin("test"))
    // Off-screen rendering for tests needs the Skia natives for this machine.
    testImplementation(compose.desktop.currentOs)
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed", "skipped")
        showStandardStreams = true
    }
    systemProperty("pixie.snapshots", rootDir.resolve("../../.build/snapshots").canonicalPath)
}
