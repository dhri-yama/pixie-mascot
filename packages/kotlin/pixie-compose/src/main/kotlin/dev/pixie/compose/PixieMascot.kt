package dev.pixie.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import dev.pixie.AttentionMode
import dev.pixie.Mood
import dev.pixie.Preset
import dev.pixie.compose
import dev.pixie.parseHex
import dev.pixie.runs
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/**
 * A pixel mascot made from [text]. Same text, same mascot, on every platform.
 *
 *     PixieMascot(text = user.name, modifier = Modifier.size(96.dp))
 *     PixieMascot(text = "helper", mood = if (loading) Mood.Thinking else Mood.Happy)
 *
 * @param mood A mood set by your app. null lets the mascot decide.
 * @param animated false draws one still frame.
 * @param attention Always, Sometimes or Never follow the pointer while it is over the mascot.
 * @param state Share a state to call `react` / `poke`, or to use [pixieTarget] and [pixieLook].
 */
@Composable
public fun PixieMascot(
    text: String,
    modifier: Modifier = Modifier,
    mood: Mood? = null,
    palette: Preset? = null,
    animated: Boolean = true,
    attention: AttentionMode = AttentionMode.Sometimes,
    state: PixieState = rememberPixieState(text, palette, attention),
) {
    val sprite = state.sprite
    val colors = remember(sprite) { sprite.colors.map { c -> if (c.isEmpty()) Color.Transparent else Color(0xFF000000L or parseHex(c).toLong()) } }

    LaunchedEffect(state, mood) { state.setMood(mood) }
    LaunchedEffect(state, animated, mood) {
        if (!animated) {
            state.showStill(mood ?: Mood.Neutral)
            return@LaunchedEffect
        }
        var last = System.nanoTime()
        state.tick(0)
        while (true) {
            delay(100)
            val now = System.nanoTime()
            state.tick(((now - last) / 1_000_000L).toInt())
            last = now
        }
    }

    Canvas(
        modifier = modifier
            .aspectRatio(1f)
            .semantics {
                contentDescription = sprite.summary
                role = Role.Image
            }
            .onGloballyPositioned { state.centerInRoot = it.boundsInRoot().center }
            .pointerInput(state, animated) {
                if (!animated) return@pointerInput
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val p = event.changes.firstOrNull()?.position
                        val c = state.centerInRoot
                        if (event.type == PointerEventType.Exit || p == null || c == null) {
                            state.lookAt(null)
                        } else {
                            // Position is local to the mascot; convert to root space via its size.
                            state.lookAt(Offset(c.x - size.width / 2f + p.x, c.y - size.height / 2f + p.y))
                        }
                    }
                }
            }
            .pointerInput(state, animated) {
                if (animated) detectTapGestures(onTap = { state.poke() })
            },
    ) {
        val grid = compose(sprite, state.pose)
        val cell = minOf(size.width, size.height) / 16f
        val ox = (size.width - cell * 16f) / 2f
        val oy = (size.height - cell * 16f) / 2f
        for (run in runs(grid)) {
            val x0 = (ox + run.x * cell).roundToInt().toFloat()
            val x1 = (ox + (run.x + run.w) * cell).roundToInt().toFloat()
            val y0 = (oy + run.y * cell).roundToInt().toFloat()
            val y1 = (oy + (run.y + 1) * cell).roundToInt().toFloat()
            drawRect(colors[run.idx], topLeft = Offset(x0, y0), size = Size(x1 - x0, y1 - y0))
        }
    }
}

/** Where a modifier's element sits in root coordinates. Kept across recompositions. */
private class Origin {
    var topLeft: Offset = Offset.Zero
    var center: Offset? = null
}

/** Put this on a larger container (a whole screen, say) so the mascot follows the pointer anywhere inside it. */
@Composable
public fun Modifier.pixieLook(state: PixieState): Modifier {
    val origin = remember { Origin() }
    return this
        .onGloballyPositioned { origin.topLeft = it.boundsInRoot().topLeft }
        .pointerInput(state) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val p = event.changes.firstOrNull()?.position
                    if (event.type == PointerEventType.Exit || p == null) state.lookAt(null) else state.lookAt(origin.topLeft + p)
                }
            }
        }
}

/** Make a mascot notice this element: it looks at it on hover and reacts when it is tapped. */
@Composable
public fun Modifier.pixieTarget(state: PixieState, mood: Mood? = null): Modifier {
    val origin = remember { Origin() }
    return this
        .onGloballyPositioned { origin.center = it.boundsInRoot().center }
        .pointerInput(state, mood) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    when (event.type) {
                        PointerEventType.Enter -> {
                            state.focusOn(origin.center)
                            if (mood != null) state.react(mood, 600_000)
                        }
                        PointerEventType.Exit -> {
                            state.focusOn(null)
                            if (mood != null) state.clearReaction()
                        }
                        else -> Unit
                    }
                }
            }
        }
        .pointerInput(state, mood) { detectTapGestures(onTap = { state.react(mood ?: Mood.Happy, 900) }) }
}
