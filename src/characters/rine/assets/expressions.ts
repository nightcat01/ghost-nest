import type { CharacterAssets } from "../../../core/types.js";

export const rineExpressions = {
  "neutral": "/src/characters/rine/assets/base/rine_standing_defualt.png",
  "happy": [
    "./src/characters/rine/assets/base/rine_standing_wink.png",
    "./src/characters/rine/assets/base/rine_standing_defualt.png"
  ],
  "thinking": [
    "./src/characters/rine/assets/base/rine_standing_thinking.png",
    "./src/characters/rine/assets/base/rine_standing_wink.png"
  ],
  "surprised": [
    "./src/characters/rine/assets/base/rine_standing_surprise.png",
    "./src/characters/rine/assets/base/rine_standing_shy.png"
  ]
} satisfies CharacterAssets["expressions"];
