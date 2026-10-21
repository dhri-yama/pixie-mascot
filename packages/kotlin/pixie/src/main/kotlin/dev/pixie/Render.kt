package dev.pixie

// Spec: spec/sprite.md "Output". Integer coordinates and hex colors only, so output is stable.

public class Run internal constructor(public val x: Int, public val y: Int, public val w: Int, public val idx: Int)

/** Horizontal runs of equal, non-clear cells. Fewer rects than one per pixel. */
public fun runs(grid: IntArray): List<Run> {
    val out = ArrayList<Run>()
    for (y in 0 until SIZE) {
        var x = 0
        while (x < SIZE) {
            val idx = grid[y * SIZE + x]
            if (idx == 0) { x++; continue }
            var w = 1
            while (x + w < SIZE && grid[y * SIZE + x + w] == idx) w++
            out.add(Run(x, y, w, idx))
            x += w
        }
    }
    return out
}

private fun escapeXml(s: String): String =
    s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

/** SVG markup identical to the TypeScript core's `toSVG`. A null or empty [label] makes it decorative. */
public fun toSVG(grid: IntArray, colors: List<String>, size: Int? = null, label: String? = null): String {
    val dim = if (size == null) "" else " width=\"$size\" height=\"$size\""
    val a11y = if (label.isNullOrEmpty()) " aria-hidden=\"true\"" else " role=\"img\" aria-label=\"${escapeXml(label)}\""
    val rects = runs(grid).joinToString("") { r ->
        "<rect x=\"${r.x}\" y=\"${r.y}\" width=\"${r.w}\" height=\"1\" fill=\"${colors.getOrElse(r.idx) { "#000" }}\"/>"
    }
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 $SIZE $SIZE\"$dim shape-rendering=\"crispEdges\"$a11y>$rects</svg>"
}

/** "#rrggbb" -> 0xRRGGBB. Unknown input gives black. */
public fun parseHex(s: String): Int {
    val h = s.removePrefix("#")
    return if (h.length == 6) h.toIntOrNull(16) ?: 0 else 0
}

/** This sprite in the given pose, drawn into a new grid. */
public fun Sprite.gridFor(pose: Pose): IntArray = compose(this, pose)

/** Static SVG of the sprite in a pose. */
public fun Sprite.svg(pose: Pose = Pose(), size: Int? = null): String = toSVG(compose(this, pose), colors, size, summary)
