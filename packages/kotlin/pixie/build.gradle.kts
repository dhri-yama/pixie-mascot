plugins {
    kotlin("jvm")
}

group = "dev.pixie"
version = "0.1.0"

kotlin {
    explicitApi()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("com.google.code.gson:gson:2.14.0")
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed", "skipped")
        showStandardStreams = true
    }
    // The golden file lives in the repo's spec folder.
    systemProperty("pixie.spec", rootDir.resolve("../../spec").canonicalPath)
}
