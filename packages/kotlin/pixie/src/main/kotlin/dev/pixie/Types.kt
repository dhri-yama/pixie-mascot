package dev.pixie

public const val SIZE: Int = 32
/** Last column of the left half. The mascot is mirrored around the line between AXIS and AXIS + 1. */
internal const val AXIS: Int = 15
/** Last row of the body. Feet use the rows below it. */
internal const val GROUND: Int = 25
/** First row parts may use. Rows above it hold the outline and leave room for lifting. */
internal const val TOP: Int = 4
/** Most rows a motion may lift the mascot. Rows 0 until TOP are always empty, so nothing is lost. */
internal const val MAX_LIFT: Int = 3
public const val VERSION: Int = 1

/** Palette indices used in grids. */
internal object Cell {
    const val CLEAR = 0
    const val BODY = 1
    const val OUTLINE = 2
    const val SHADE = 3
    const val LIGHT = 4
    const val ACCENT = 5
    const val INK = 6
    const val WHITE = 7
}

public enum class Mood(public val key: String) {
    Neutral("neutral"), Happy("happy"), Sad("sad"), Surprised("surprised"), Thinking("thinking"), Sleepy("sleepy");

    public companion object {
        /** Friendly names for moods the sprite sheet does not have yet. */
        private val aliases = mapOf(
            "worried" to Sad, "angry" to Sad, "excited" to Happy, "love" to Happy,
            "smug" to Happy, "confused" to Thinking, "shy" to Sleepy,
        )

        public fun named(name: String?): Mood? =
            if (name == null) null else entries.firstOrNull { it.key == name } ?: aliases[name]
    }
}

public enum class Template(public val key: String) {
    Blob("blob"), Egg("egg"), Pear("pear"), Capsule("capsule"), Dome("dome"), Cloud("cloud"), Twin("twin"), Box("box"),
    Mushroom("mushroom"), Bell("bell"), Drop("drop"), Jelly("jelly"),
    Star("star"), Gem("gem"), Wedge("wedge"), Hex("hex"), Kite("kite"), Shield("shield"), Hourglass("hourglass"),
    Serpent("serpent"), Cobra("cobra"), Caterpillar("caterpillar"),
}

/** A decoration on the body. */
public enum class Mark(public val key: String) {
    None("none"), Belly("belly"), Spots("spots"), Stripes("stripes"), Cheeks("cheeks"), Gem("gem"),
}
public enum class EyeStyle(public val key: String) { Dot("dot"), Big("big") }
public enum class Preset(public val key: String) { Gameboy("gameboy"), Mono("mono"), Amber("amber") }

public data class Traits(
    public val roundness: Int,
    public val heft: Int,
    public val energy: Int,
    public val chaos: Int,
    /** Share (0..100) of hissing, slithering letters (s z x h w y l). High values can make a snake. */
    public val slink: Int = 0,
)

public data class Anchors(public val eyeY: Int, public val eyeInner: Int, public val mouthY: Int)

/** -1, 0 or 1 on each axis. */
public data class Gaze(public val x: Int = 0, public val y: Int = 0)

public data class Pose(
    public val mood: Mood = Mood.Neutral,
    public val gaze: Gaze = Gaze(),
    public val blink: Boolean = false,
    /** Rows the whole mascot is lifted (0..3). */
    public val lift: Int = 0,
    /** Columns the whole mascot is shifted right (negative = left). */
    public val dx: Int = 0,
    /** Tilt around the feet: positive leans right at the top (-3..3). */
    public val lean: Int = 0,
    /** Positive presses the body shorter, negative stretches it taller (-3..3). */
    public val squash: Int = 0,
    /** Phase (0..7) of a sideways wave that ripples down the body. */
    public val wave: Int = 0,
    /** Size of that wave in columns (0..2). 0 means none. */
    public val amp: Int = 0,
)

public class Sprite internal constructor(
    public val version: Int,
    public val seed: UInt,
    /** Normalized text this sprite was made from. */
    public val text: String,
    public val traits: Traits,
    public val template: Template,
    public val mark: Mark,
    public val eyeStyle: EyeStyle,
    public val anchors: Anchors,
    /** 32x32 palette indices, row by row, without a face. */
    public val body: IntArray,
    /** 8 CSS colors indexed by palette index; index 0 is "" (clear). */
    public val colors: List<String>,
    public val colorName: String,
) {
    /** Body with the neutral face. This is what the golden file hashes. */
    public var grid: IntArray = body
        internal set

    /** A short description for accessibility. */
    public val summary: String
        get() {
            val shape = SHAPE_WORDS.getValue(template)
            val e = traits.energy
            val mood = if (e < 35) "calm" else if (e < 65) "lively" else "hyper"
            return "A $shape, $mood $colorName pixel mascot"
        }
}

internal fun at(g: IntArray, x: Int, y: Int): Int =
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) 0 else g[y * SIZE + x]

internal fun put(g: IntArray, x: Int, y: Int, v: Int) {
    if (x in 0 until SIZE && y in 0 until SIZE) g[y * SIZE + x] = v
}

internal fun clamp(v: Int, lo: Int = 0, hi: Int = 100): Int = if (v < lo) lo else if (v > hi) hi else v

private val SHAPE_WORDS = mapOf(
    Template.Blob to "round", Template.Egg to "egg-shaped", Template.Pear to "pear-shaped",
    Template.Capsule to "capsule-shaped", Template.Dome to "dome-shaped", Template.Cloud to "cloudy",
    Template.Twin to "two-part", Template.Box to "boxy", Template.Mushroom to "mushroom-shaped",
    Template.Bell to "bell-shaped", Template.Drop to "drop-shaped", Template.Jelly to "jellyfish-like",
    Template.Star to "star-shaped", Template.Gem to "crystal-shaped", Template.Wedge to "wedge-shaped",
    Template.Hex to "hexagonal", Template.Kite to "kite-shaped", Template.Shield to "shield-shaped",
    Template.Hourglass to "hourglass-shaped", Template.Serpent to "snake-like", Template.Cobra to "cobra-like",
    Template.Caterpillar to "caterpillar-like",
)
