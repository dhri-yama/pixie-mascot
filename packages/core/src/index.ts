export { generate, describe } from "./generate";
export { compose, applyMotion } from "./compose";
export { toSVG, toSmoothSVG, runs, gridToString, type Run, type SvgOptions, type SmoothOptions } from "./render";
export { normalize } from "./normalize";
export { hashText, fnv1a, utf8 } from "./hash";
export { createRng, type Rng } from "./rng";
export { computeTraits, type Traits } from "./traits";
export {
  AXIS, GROUND, MAX_LIFT, MOODS, SIZE, TOP, VERSION,
  type Anchors, type EyeStyle, type GenerateOptions, type Gaze, type Grid, type Mood,
  type Mark, type Pose, type PresetName, type Sprite, type Template,
} from "./types";
export {
  createBehavior, motionFor, snapGaze,
  type Attention, type AttentionMode, type Behavior, type BehaviorOptions, type Motion, type Vec,
} from "./behavior";
