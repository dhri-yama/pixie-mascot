# Algorithm versions

The algorithm version is separate from package semver. A shipped version never changes.

| Version | Status | Notes |
|---|---|---|
| 1 | **draft** | Still being tuned. Output may change until marked frozen (M4 sign-off). |

Rules once a version is frozen: hashing, normalization, trait rules, parts, palettes, rounding,
and rng call order must not change. Any such change is a new version with its own golden entries.
