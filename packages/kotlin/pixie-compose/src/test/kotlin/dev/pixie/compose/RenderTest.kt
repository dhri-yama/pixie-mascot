package dev.pixie.compose

import androidx.compose.foundation.layout.size
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.pixie.Mood
import dev.pixie.generate
import dev.pixie.parseHex
import java.io.ByteArrayInputStream
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.jetbrains.skia.EncodedImageFormat

@OptIn(ExperimentalComposeUiApi::class)
class RenderTest {
    private fun render(text: String, mood: Mood?): ByteArray {
        val scene = ImageComposeScene(width = 256, height = 256, density = Density(1f)) {
            PixieMascot(text = text, mood = mood, animated = false, modifier = Modifier.size(256.dp))
        }
        try {
            // Two frames so the effect that sets the still mood has run.
            scene.render(0)
            val image = scene.render(100_000_000)
            return image.encodeToData(EncodedImageFormat.PNG)!!.bytes
        } finally {
            scene.close()
        }
    }

    @Test fun drawsTheSpriteWithCrispPixels() {
        val png = render("bubbanbbebb", Mood.Happy)
        val img = ImageIO.read(ByteArrayInputStream(png))
        assertEquals(256, img.width)

        // Leave a snapshot for a human to look at.
        System.getProperty("pixie.snapshots")?.let { dir ->
            File(dir).mkdirs()
            File(dir, "compose-bubbanbbebb.png").writeBytes(png)
            File(dir, "compose-jsakkkwaakiyy.png").writeBytes(render("jsakkkwaakiyy", null))
        }

        // The first body pixel of the sprite must have the sprite's body color, at the sprite grid scale.
        val sprite = generate("bubbanbbebb")
        val first = sprite.grid.indexOfFirst { it == 1 }
        val cellPx = 256 / dev.pixie.SIZE
        val px = (first % dev.pixie.SIZE) * cellPx + cellPx / 2
        val py = (first / dev.pixie.SIZE) * cellPx + cellPx / 2
        val rgb = img.getRGB(px, py) and 0xffffff
        assertEquals(parseHex(sprite.colors[1]), rgb, "body color at cell $first")

        var opaque = 0
        for (y in 0 until img.height) for (x in 0 until img.width) if ((img.getRGB(x, y) ushr 24) > 0) opaque++
        assertTrue(opaque > 8000, "mascot should cover a good part of the canvas, covered $opaque")
        assertEquals(0, img.getRGB(2, 2) ushr 24, "top-left corner is transparent")
    }
}
