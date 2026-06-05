import { mira } from "./mira/index.js";
import { rine } from "./rine/index.js";
import type { CharacterDefinition } from "../core/types.js";

export const bundledCharacters = [
  rine,
  mira,
] satisfies CharacterDefinition[];

export {
  mira,
  rine,
};
