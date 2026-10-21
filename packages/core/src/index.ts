export { generate, describe } from "./generate";
export { compose } from "./compose";
export { toSVG, toSmoothSVG, runs, gridToString, type Run, type SvgOptions, type SmoothOptions } from "./render";
export { normalize } from "./normalize";
export { hashText, fnv1a, utf8 } from "./hash";
export { createRng, type Rng } from "./rng";
export { computeTraits, type Traits } from "./traits";
export {
  AXIS, BOB, GROUND, MOODS, SIZE, TOP, VERSION,
  type Anchors, type EyeStyle, type GenerateOptions, type Gaze, type Grid, type Mood,
  type Pose, type PresetName, type Sprite, type Template,
} from "./types";
export {
  createBehavior, snapGaze,
  type Attention, type AttentionMode, type Behavior, type BehaviorOptions, type Vec,
} from "./behavior";
