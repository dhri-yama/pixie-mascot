# Behavior spec (v1)

The behavior engine is pure and seeded. A host calls `tick(dtMs)` about 8-12 times a second and draws
the returned pose with `compose`. It is **not** part of the golden file (it depends on call timing), but
ports must follow these rules.

## Pose
`{ mood, gaze: {x,y in -1|0|1}, blink, lift, dx, lean, squash, wave, amp }` (all integers; see `spec/motion.json`)

## Priority
`app mood (setMood)` > `reaction (react, poke)` > `idle (neutral, or sleepy when asleep)`.
Asleep also happens only when there is no app mood. Any activity wakes it: react, poke, setMood, focus,
or a cursor move larger than 0.05 (sum of |dx|+|dy|).

## Personality (from traits, integer ms)
- blink gap: `4000 - energy*20` + 0..1799; a blink lasts 140 ms and one in four is followed 320 ms later by a second
  (draw `int(100)` then `int(1800)` at every blink)
- motion step: `stepMs = clamp(220 - energy*13/10, 100, 220)`; the idle loop has 8 steps, `step = (now + phase) / stepMs`
- gaze reaction delay: `80 + (100 - energy)*2`
- follow span: `3000 + (100 - chaos)*40` + 0..2999

## Attention
`asleep` > `focus` (locked element) > cursor logic.
Cursor logic: no cursor or mode `never` -> `wander`; mode `always` or reduced motion -> `follow`;
mode `sometimes` alternates follow (span) and wander (1500..3999 ms).
Gaze snaps to 8 directions with a 0.3 deadzone. Wander picks a new random glance every `1500 + chaos*20` ms.

## Motion
The body shape picks a style: serpent, cobra, caterpillar -> slither; cloud, jelly -> float; capsule, twin, box,
shield, hourglass -> waddle; star, gem, hex, kite, wedge -> pulse; everything else bounce if `energy >= 45` else sway.
Each style is a table of 8 steps in `spec/motion.json` (lift, dx, lean, squash, wave, amp). Overrides, in order:
asleep or sleepy mood: slow breathing squash (`step3 = (now + phase) / (stepMs*3)`); a happy or surprised reaction in its first
800 ms: the jump table by `(now - start) / 100`; sad: squash 1; thinking adds 1 to lean. `compose` applies the numbers
(`applyMotion`): squash/stretch keeping the feet on the same row, then per-row lean + wave + dx, then lift.

## Reduced motion
No moving, no blink, no wander. Gaze still follows the cursor.

## Rng
`createRng((seed ^ 0x9e3779b9) | 0)`, separate from the generator stream. First draw is the motion phase `int(stepMs*8)`.
