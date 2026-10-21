import Foundation

// Spec: spec/traits.md. Text sound -> four integer traits (0..100). Integer math only.

func computeTraits(_ norm: String, _ rng: Rng) -> Traits {
    let d = [rng.next(), rng.next(), rng.next(), rng.next()].map { Int($0) }
    let small = d.map { $0 % 13 - 6 }
    let big = d.map { $0 % 61 - 30 }

    var round = 0, sharp = 0, heavy = 0, light = 0, rare = 0
    var n = 0, cc = 0, mask = 0
    var prevConsonant = false
    for scalar in norm.unicodeScalars {
        let code = Int(scalar.value)
        if code < 97 || code > 122 {
            prevConsonant = false
            continue
        }
        let row = SpecData.letters[code - 97]
        round += row[0]; sharp += row[1]; heavy += row[2]; light += row[3]; rare += row[4]
        n += 1
        mask |= 1 << (code - 97)
        let consonant = ![97, 101, 105, 111, 117].contains(code)
        if consonant && prevConsonant { cc += 1 }
        prevConsonant = consonant
    }

    if n == 0 {
        return Traits(roundness: clamp(50 + big[0]), heft: clamp(50 + big[1]), energy: clamp(50 + big[2]), chaos: clamp(50 + big[3]))
    }

    let distinct = mask.nonzeroBitCount
    let jr = n < 3 ? big[0] : small[0]
    let jh = n < 3 ? big[1] : small[1]
    let je = n < 3 ? big[2] : small[2]
    let jc = n < 3 ? big[3] : small[3]

    let roundRaw = 50 + (((round - sharp) * 100 / (round + sharp + 1)) * 55 / 100)
    let roundness = clamp(roundRaw + jr)

    let heftRatio = (heavy - light) * 100 / (heavy + light + 1)
    let heft = clamp(50 + heftRatio * 45 / 100 + clamp(n - 6, -6, 10) * 2 + jh)

    let rareD = rare * 100 / n
    let clusterD = cc * 100 / n
    let energy = clamp(25 + rareD * 2 + clusterD / 2 + (50 - roundRaw) / 2 + je)

    let variety = distinct * 100 / (n + 2)
    let chaos = clamp(variety + rareD / 2 + (energy - 50) / 4 + jc)

    return Traits(roundness: roundness, heft: heft, energy: energy, chaos: chaos)
}
