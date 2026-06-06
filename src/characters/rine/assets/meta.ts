import type { CharacterAssets } from "../../../core/types.js";

export const rineAssetMeta = {
  "alt": "여우족 안내자 리네",
  "hitAreas": {
    "head": {
      "minX": 0.319,
      "maxX": 0.595,
      "minY": 0,
      "maxY": 0.14300000000000002
    },
    "face": {
      "minX": 0.37200000000000005,
      "maxX": 0.559,
      "minY": 0.145,
      "maxY": 0.22199999999999998
    },
    "body": {
      "minX": 0.223,
      "maxX": 0.751,
      "minY": 0.222,
      "maxY": 0.906
    }
  }
} satisfies Pick<CharacterAssets, "alt" | "hitAreas">;
