// Plugins are declared once here so every module shares one Kotlin plugin class loader.
plugins {
    kotlin("jvm") apply false
    kotlin("plugin.compose") apply false
    id("org.jetbrains.compose") apply false
}
