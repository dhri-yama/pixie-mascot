# Behavior spec (v1)

The behavior engine is pure and seeded. A host calls `tick(dtMs)` about 8-12 times a second and draws
the returned pose with `compose`. It is **not** part of the golden file (it depends on call timing), but
ports must follow these rules.

## Pose
`{ mood, gaze: {x,y in -1|0|1}, blink, bob }`

## Priority
`app mood (setMood)` > `reaction (react, poke)` > `idle (neutral, or sleepy when asleep)`.
Asleep also happens only when there is no app mood. Any activity wakes it: react, poke, setMood, focus,
or a cursor move larger than 0.05 (sum of |dx|+|dy|).

## Personality (from traits, integer ms)
- blink gap: `6000 - energy*30` + 0..2499
- bob half period: `clamp(700 - energy*4, 250, 700)`; slower x3 while asleep
- gaze reaction delay: `80 + (100 - energy)*2`
- follow span: `3000 + (100 - chaos)*40` + 0..2999

## Attention
`asleep` > `focus` (locked element) > cursor logic.
Cursor logic: no cursor or mode `never` -> `wander`; mode `always` or reduced motion -> `follow`;
mode `sometimes` alternates follow (span) and wander (1500..3999 ms).
Gaze snaps to 8 directions with a 0.3 deadzone. Wander picks a new random glance every `1500 + chaos*20` ms.

## Reduced motion
No bob, no blink, no wander. Gaze still follows the cursor.

## Rng
`createRng((seed ^ 0x9e3779b9) | 0)`, separate from the generator stream. First draw is the bob phase.
