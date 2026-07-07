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
  },
  "rine-prop-test-scene": {
    "id": "rine-prop-test-scene",
    "canvas": {
      "width": 760,
      "height": 604
    },
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
        "depth": 20,
        "placement": {
          "x": 31,
          "y": 8,
          "width": 38,
          "height": 86,
          "unit": "percent"
        }
      },
      {
        "id": "prop-test",
        "role": "prop",
        "depth": 30,
        "image": "./src/characters/rine/assets/parts/rine_eye_default.png",
        "fit": "fill",
        "objectPosition": "center center",
        "overflow": "hidden",
        "placement": {
          "x": 40,
          "y": 40,
          "width": 20,
          "height": 20,
          "unit": "percent"
        },
        "imagePlacement": {
          "x": -25,
          "y": -25,
          "width": 150,
          "height": 150,
          "unit": "percent"
        }
      }
    ]
  }
} satisfies NonNullable<CharacterAssets["scenes"]>;
