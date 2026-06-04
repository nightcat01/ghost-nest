import type { CharacterAssets } from "../../../core/types.js";

export const rineSurfaces = {
  "0": {
    "id": "0",
    "image": "./src/characters/rine/assets/base/rine_standing_defualt.png",
    "expression": "neutral",
    "alt": "기본 표정의 리네",
    "layers": {
      "base": {
        "frames": [],
        "depth": 0,
        "intervalMs": 300,
        "idleIntervalMs": 1000,
        "coversBase": false,
        "placement": {
          "x": 38.5,
          "y": 12.9,
          "width": 13.8,
          "height": 5.2,
          "unit": "percent"
        }
      },
      "mouth": {
        "frames": [
          "./src/characters/rine/assets/parts/rine_mouth_big.png"
        ],
        "depth": 30,
        "intervalMs": 140,
        "coversBase": true,
        "placement": {
          "x": 43.6,
          "y": 18,
          "width": 5.1,
          "height": 2.1,
          "unit": "percent"
        }
      },
      "eyes": {
        "frames": [
          "./src/characters/rine/assets/parts/rine_eye_close.png"
        ],
        "depth": 20,
        "intervalMs": 300,
        "idleIntervalMs": 2000,
        "coversBase": false,
        "placement": {
          "x": 38.5,
          "y": 12.9,
          "width": 13.8,
          "height": 5.2,
          "unit": "percent"
        }
      }
    }
  },
  "5": {
    "id": "5",
    "image": "./src/characters/rine/assets/base/rine_standing_defualt.png",
    "alt": "생각하는 표정의 리네",
    "expression": "neutral"
  },
  "8": {
    "id": "8",
    "image": "./src/characters/rine/assets/base/rine_standing_wink.png",
    "alt": "윙크하는 리네"
  }
} satisfies NonNullable<CharacterAssets["surfaces"]>;
