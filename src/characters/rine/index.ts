import { rineLines } from "./lines.js";
import { rineProfile } from "./profile.js";
import { rineExpressions } from "./assets/expressions.js";
import { rineAssetMeta } from "./assets/meta.js";
import { rineDefaultScene, rineScenes } from "./assets/scenes.js";
import { rineSurfaces } from "./assets/surfaces.js";
import type { CharacterDefinition } from "../../core/types.js";

export const rine: CharacterDefinition = {
  profile: rineProfile,
  lines: rineLines,
  assets: {
    ...rineAssetMeta,
    expressions: rineExpressions,
    surfaces: rineSurfaces,
    defaultScene: rineDefaultScene,
    scenes: rineScenes,
  },
};

export default rine;
