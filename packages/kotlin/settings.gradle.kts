rootProject.name = "pixie-kotlin"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
    plugins {
        kotlin("jvm") version "2.4.21"
        kotlin("plugin.compose") version "2.4.21"
        id("org.jetbrains.compose") version "1.12.2"
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
    }
}

include(":pixie", ":pixie-compose")
