import type { CharacterAssets } from "../../../core/types.js";

export const rineDefaultScene = "test-room";

export const rineScenes = {
  "rine-demo-scene": {
    "id": "rine-demo-scene",
    "layers": [
      {
        "id": "warm-room",
        "role": "background",
        "color": "linear-gradient(180deg, rgba(255, 247, 232, 0.96), rgba(237, 247, 244, 0.86))",
        "depth": 0
      },
      {
        "id": "character-slot",
        "role": "character",
        "depth": 20
      },
      {
        "id": "desk-line",
        "role": "prop",
        "color": "rgba(95, 62, 36, 0.16)",
        "depth": 30,
        "placement": {
          "x": 18,
          "y": 76,
          "width": 64,
          "height": 16,
          "unit": "percent"
        }
      },
      {
        "id": "soft-light",
        "role": "effect",
        "color": "rgba(255, 222, 160, 0.18)",
        "depth": 5,
        "placement": {
          "x": 12,
          "y": 8,
          "width": 38,
          "height": 30,
          "unit": "percent"
        }
      }
    ]
  },
  "test-room": {
    "id": "test-room",
    "layers": [
      {
        "id": "character-slot",
        "role": "character",
        "depth": 20
      },
      {
        "id": "prop-1",
        "role": "prop",
        "image": "./src/characters/rine/assets/parts/rine_eye_close.png",
        "depth": 30,
        "placement": {
          "x": 12.135969414012365,
          "y": 75,
          "width": 80,
          "height": 25,
          "unit": "percent"
        }
      },
      {
        "id": "effect-1",
        "role": "effect",
        "image": "./src/characters/rine/assets/parts/rine_mouth_big.png",
        "depth": 2,
        "placement": {
          "x": 50.826501260818326,
          "y": 6.709950764973958,
          "width": 37.418832666521276,
          "height": 43.29004196893601,
          "unit": "percent"
        }
      }
    ]
  }
} satisfies NonNullable<CharacterAssets["scenes"]>;
