# Traits spec (v1)

Traits are integers 0..100, computed from the **normalized** text only (never the raw text).
All division truncates toward zero. See `spec/letters.json` for the per-letter table
`[round, sharp, heavy, light, rare]`.

Four rng draws happen first, always: `d0..d3`. `small_i = d_i % 13 - 6`, `big_i = d_i % 61 - 30`.
Only letters `a-z` count. `n` = number of such letters. Vowels are `aeiou`; every other letter is a
consonant. `cc` = adjacent consonant pairs (letters directly next to each other).

If `n == 0`: every trait is `clamp(50 + big_i)`.

Otherwise jitter is `big_i` when `n < 3`, else `small_i`.

```
roundRaw  = 50 + ((R - S) * 100 / (R + S + 1)) * 55 / 100
roundness = clamp(roundRaw + j0)
heft      = clamp(50 + ((H - L) * 100 / (H + L + 1)) * 45 / 100 + clamp(n - 6, -6, 10) * 2 + j1)
rareD     = rare * 100 / n
clusterD  = cc * 100 / n
energy    = clamp(25 + rareD * 2 + clusterD / 2 + (50 - roundRaw) / 2 + j2)
chaos     = clamp(distinct * 100 / (n + 2) + rareD / 2 + (energy - 50) / 4 + j3)
slink     = (count of letters in "szxhwyl") * 100 / n          (0 when n == 0)
```

R, S, H, L, rare are sums over the table. `distinct` is the number of different letters.

## From traits to a sprite
- Body template from `eff = clamp(roundness + int(15) - 7)`: `>=68` blob, `>=45` box, `>=25` wedge, else gem.
- Size from heft: `<34` slim, `<67` medium, else wide.
- Part tone: soft if `eff >= 50`, flipped when `tone roll < 20 + chaos / 5`.
- Extra top part when `energy >= 60`; side parts more likely with higher energy.
- Mutations (asymmetry) = `chaos / 25`.
- Palette group: `energy >= 60` vivid, else `roundness >= 50` pastel, else deep.
- Eye style: `clamp(roundness + int(40) - 20) >= 50` big, else dot.
