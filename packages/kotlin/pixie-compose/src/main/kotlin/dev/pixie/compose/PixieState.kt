package dev.pixie.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import dev.pixie.AttentionMode
import dev.pixie.Behavior
import dev.pixie.Mood
import dev.pixie.Pose
import dev.pixie.Preset
import dev.pixie.Sprite
import dev.pixie.Vec
import dev.pixie.generate

private const val FAR = 200.0 // pixels that count as "far away" for gaze vectors

/**
 * Owns a mascot's sprite and behavior. Create one with [rememberPixieState] when you want to drive the
 * mascot from code ([react], [poke], [setMood]) or share it with [pixieTarget] and [pixieLook].
 */
@Stable
public class PixieState internal constructor(
    public val text: String,
    private val palette: Preset?,
    private val attention: AttentionMode,
    private val reducedMotion: Boolean,
    private val sleepAfterMs: Int,
) {
    public val sprite: Sprite = generate(text, palette = palette)
    private var behavior = Behavior(sprite.seed, sprite.traits, sprite.template, attention, reducedMotion, sleepAfterMs)
    private var appMood: Mood? = null

    /** The pose currently on screen. Reading it in a draw block redraws when it changes. */
    public var pose: Pose by mutableStateOf(Pose())
        private set

    /** Center of the mascot in root coordinates, reported by the view. */
    internal var centerInRoot: Offset? = null

    public fun setMood(mood: Mood?) {
        appMood = mood
        behavior.setMood(mood)
    }

    public fun react(mood: Mood, ms: Int = 900): Unit = behavior.react(mood, ms)
    public fun poke(): Unit = behavior.poke()
    public fun setAttention(mode: AttentionMode): Unit = behavior.setAttention(mode)

    /** Look at a point in root coordinates, or pass null to stop. */
    public fun lookAt(point: Offset?) {
        behavior.lookAt(point?.let { vecTo(it) })
    }

    internal fun focusOn(point: Offset?) {
        behavior.focus(point?.let { vecTo(it) })
    }

    internal fun clearReaction(): Unit = behavior.clearReaction()

    private fun vecTo(p: Offset): Vec {
        val c = centerInRoot ?: return Vec(0.0, 0.0)
        return Vec((p.x - c.x) / FAR, (p.y - c.y) / FAR)
    }

    internal fun tick(dtMs: Int) {
        pose = behavior.tick(dtMs)
    }

    internal fun showStill(mood: Mood) {
        pose = Pose(mood)
    }
}

@Composable
public fun rememberPixieState(
    text: String,
    palette: Preset? = null,
    attention: AttentionMode = AttentionMode.Sometimes,
    reducedMotion: Boolean = false,
    sleepAfterMs: Int = 30000,
): PixieState = remember(text, palette, attention, reducedMotion, sleepAfterMs) {
    PixieState(text, palette, attention, reducedMotion, sleepAfterMs)
}
