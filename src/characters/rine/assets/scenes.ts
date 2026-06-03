import type { CharacterAssets } from "../../../core/types.js";

export const rineDefaultScene = "";

export const rineScenes = {
  "rine-demo-scene": {
    "id": "rine-demo-scene",
    "layers": [
      {
        "id": "background",
        "role": "background",
        "depth": 0,
        "color": "linear-gradient(180deg, rgba(255, 247, 232, 0.96), rgba(237, 247, 244, 0.86))"
      },
      {
        "id": "character-slot",
        "role": "character",
        "depth": 20
      }
    ]
  }
} satisfies NonNullable<CharacterAssets["scenes"]>;
