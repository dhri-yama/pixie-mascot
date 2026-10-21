package dev.pixie

// Spec: spec/sprite.md. Normalization, FNV-1a hash, mulberry32. Must match the TypeScript core bit for bit.

import java.text.Normalizer

private fun isSpace(c: Int): Boolean =
    c in 0x09..0x0d || c == 0x20 || c == 0xa0 || c in 0x2000..0x200a ||
        c == 0x2028 || c == 0x2029 || c == 0x202f || c == 0x205f || c == 0x3000

private const val MAX_CODE_POINTS = 128

/** NFC, ASCII-only lowercase, whitespace runs become one space, trimmed, capped at 128 code points. */
public fun normalize(text: String): String {
    val out = ArrayList<Int>()
    var pending = false
    val nfc = Normalizer.normalize(text, Normalizer.Form.NFC)
    var i = 0
    while (i < nfc.length) {
        var c = nfc.codePointAt(i)
        i += Character.charCount(c)
        if (isSpace(c)) {
            pending = out.isNotEmpty()
            continue
        }
        if (pending) {
            out.add(0x20)
            pending = false
        }
        if (c in 65..90) c += 32
        out.add(c)
    }
    val capped = out.take(MAX_CODE_POINTS).toMutableList()
    if (capped.lastOrNull() == 0x20) capped.removeAt(capped.size - 1)
    val sb = StringBuilder()
    for (c in capped) sb.appendCodePoint(c)
    return sb.toString()
}

/** UTF-8 bytes as the spec defines them: lone surrogates become U+FFFD (Kotlin's own encoder uses '?'). */
public fun utf8(s: String): ByteArray {
    val out = java.io.ByteArrayOutputStream()
    var i = 0
    while (i < s.length) {
        var c = s.codePointAt(i)
        i += Character.charCount(c)
        if (c in 0xd800..0xdfff) c = 0xfffd
        when {
            c < 0x80 -> out.write(c)
            c < 0x800 -> { out.write(0xc0 or (c shr 6)); out.write(0x80 or (c and 63)) }
            c < 0x10000 -> { out.write(0xe0 or (c shr 12)); out.write(0x80 or ((c shr 6) and 63)); out.write(0x80 or (c and 63)) }
            else -> {
                out.write(0xf0 or (c shr 18)); out.write(0x80 or ((c shr 12) and 63))
                out.write(0x80 or ((c shr 6) and 63)); out.write(0x80 or (c and 63))
            }
        }
    }
    return out.toByteArray()
}

public fun fnv1a(bytes: ByteArray): UInt {
    var h = 0x811c9dc5u
    for (b in bytes) {
        h = h xor (b.toUInt() and 0xffu)
        h *= 0x01000193u
    }
    return h
}

public fun hashText(normalized: String): UInt = fnv1a(utf8(normalized))

/** mulberry32 returning uint32. The order of calls is part of the algorithm. */
public class Rng(seed: UInt) {
    private var a: UInt = seed

    public fun next(): UInt {
        a += 0x6d2b79f5u
        var t = (a xor (a shr 15)) * (1u or a)
        t = (t + (t xor (t shr 7)) * (61u or t)) xor t
        return t xor (t shr 14)
    }

    /** Integer in [0, n). */
    public fun int(n: Int): Int = (next() % n.toUInt()).toInt()
}
