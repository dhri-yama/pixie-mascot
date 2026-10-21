package dev.pixie

// Spec: spec/traits.md. Text sound -> four integer traits (0..100). Integer math only.

private val VOWELS = intArrayOf(97, 101, 105, 111, 117)

internal fun computeTraits(norm: String, rng: Rng): Traits {
    val d = listOf(rng.next(), rng.next(), rng.next(), rng.next()).map { it.toLong() }
    val small = d.map { (it % 13).toInt() - 6 }
    val big = d.map { (it % 61).toInt() - 30 }

    var round = 0; var sharp = 0; var heavy = 0; var light = 0; var rare = 0
    var n = 0; var cc = 0; var mask = 0
    var prevConsonant = false
    var i = 0
    while (i < norm.length) {
        val code = norm.codePointAt(i)
        i += Character.charCount(code)
        if (code < 97 || code > 122) {
            prevConsonant = false
            continue
        }
        val row = SpecData.letters[code - 97]
        round += row[0]; sharp += row[1]; heavy += row[2]; light += row[3]; rare += row[4]
        n++
        mask = mask or (1 shl (code - 97))
        val consonant = code !in VOWELS
        if (consonant && prevConsonant) cc++
        prevConsonant = consonant
    }

    if (n == 0) {
        return Traits(clamp(50 + big[0]), clamp(50 + big[1]), clamp(50 + big[2]), clamp(50 + big[3]))
    }

    val distinct = Integer.bitCount(mask)
    val jr = if (n < 3) big[0] else small[0]
    val jh = if (n < 3) big[1] else small[1]
    val je = if (n < 3) big[2] else small[2]
    val jc = if (n < 3) big[3] else small[3]

    val roundRaw = 50 + ((round - sharp) * 100 / (round + sharp + 1)) * 55 / 100
    val roundness = clamp(roundRaw + jr)

    val heftRatio = (heavy - light) * 100 / (heavy + light + 1)
    val heft = clamp(50 + heftRatio * 45 / 100 + clamp(n - 6, -6, 10) * 2 + jh)

    val rareD = rare * 100 / n
    val clusterD = cc * 100 / n
    val energy = clamp(25 + rareD * 2 + clusterD / 2 + (50 - roundRaw) / 2 + je)

    val variety = distinct * 100 / (n + 2)
    val chaos = clamp(variety + rareD / 2 + (energy - 50) / 4 + jc)

    return Traits(roundness, heft, energy, chaos)
}
