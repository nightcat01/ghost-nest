import { createRuntimeRuleFromMapping, createRuntimeRulesFromFeatureSets, type NanikaFeatureSet, type NanikaMapping } from "./mapping.js";
import type {
  CharacterExpression,
  CharacterStagePlacementOptions,
  RuntimeControlOptions,
  RuntimeRule,
  RuntimeUserPreferenceOptions,
  SpeechBalloonSizeOptions,
  SpeechLayoutOptions,
  CharacterSpriteSizeOptions,
  RuntimePreferenceStorageOptions,
} from "../../core/types.js";
import type { NanikaRuntimePresetOverrides } from "./preset.js";

export type NanikaProfileMatch = {
  enabled?: boolean;
  pageId?: string;
  pageIds?: string[];
  urlContains?: string | string[];
  urlStartsWith?: string | string[];
  urlEquals?: string | string[];
  urlPattern?: string;
  urlPatterns?: string[];
  excludePageIds?: string[];
  excludeUrlContains?: string[];
  excludeUrlStartsWith?: string[];
  excludeUrlEquals?: string[];
  excludeUrlPatterns?: string[];
};

export type NanikaProfileContext = {
  pageId?: string;
  url?: string;
  host?: Record<string, unknown>;
};

export type NanikaCommonKeyKind =
  | "expression"
  | "surface"
  | "scene"
  | "layer"
  | "dialogue"
  | "hitArea";

export type NanikaCommonKeyDefinition = {
  key: string;
  kind: NanikaCommonKeyKind;
  label: string;
  description?: string;
  required?: boolean;
};

export type NanikaSlotBinding = {
  key: string;
  kind: NanikaCommonKeyKind;
  targetId: string;
  label?: string;
};

export type NanikaProfileInitialState = {
  scene?: string;
  surface?: string;
  expression?: CharacterExpression;
};

export type NanikaProfileRuntimeOptions = {
  controls?: Partial<RuntimeControlOptions>;
  userPreferences?: Partial<RuntimeUserPreferenceOptions>;
  preferenceStorage?: RuntimePreferenceStorageOptions;
  speechLayout?: SpeechLayoutOptions;
  speechBalloonSize?: Partial<SpeechBalloonSizeOptions>;
  spriteSize?: Partial<CharacterSpriteSizeOptions>;
  characterPlacement?: CharacterStagePlacementOptions;
  balloonTheme?: string;
  hideUntilReady?: boolean;
  includeDefaultRules?: boolean;
};

export type NanikaCharacterProfile = NanikaProfileRuntimeOptions & {
  id?: string;
  characterId: string;
  name?: string;
  description?: string;
  match?: NanikaProfileMatch;
  initial?: NanikaProfileInitialState;
  featureSetIds?: string[];
  mappingIds?: string[];
  slotBindings?: NanikaSlotBinding[];
};

export type NanikaRuntimeProfile = NanikaProfileRuntimeOptions & {
  id: string;
  name?: string;
  description?: string;
  match?: NanikaProfileMatch;
  initial?: NanikaProfileInitialState;
  featureSetIds?: string[];
  mappingIds?: string[];
  characterProfiles?: NanikaCharacterProfile[];
};

export type NanikaRuntimeProfileOptionsInput = {
  profile: NanikaRuntimeProfile;
  context?: NanikaProfileContext;
  featureSets?: readonly NanikaFeatureSet[];
  mappings?: readonly NanikaMapping[];
  characterId?: string;
};

export type NanikaRuntimeProfileOptionsResult = {
  matched: boolean;
  profile: NanikaRuntimeProfile;
  characterProfile?: NanikaCharacterProfile;
  overrides?: NanikaRuntimePresetOverrides;
  warnings: string[];
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function escapeRegExp(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function matchesPattern(value: string | undefined, pattern: string) {
  if (!value) {
    return false;
  }

  const regex = new RegExp(`^${escapeRegExp(pattern).replace(/\*/g, ".*")}$`);

  return regex.test(value);
}

function matchesAnyPattern(value: string | undefined, patterns: readonly string[]) {
  return patterns.some((pattern) => matchesPattern(value, pattern));
}

function matchesAnyContains(value: string | undefined, fragments: readonly string[]) {
  if (!value) {
    return false;
  }

  return fragments.some((fragment) => fragment.length > 0 && value.includes(fragment));
}

function matchesAnyStartsWith(value: string | undefined, prefixes: readonly string[]) {
  if (!value) {
    return false;
  }

  return prefixes.some((prefix) => prefix.length > 0 && value.startsWith(prefix));
}

function matchesAnyEquals(value: string | undefined, candidates: readonly string[]) {
  if (!value) {
    return false;
  }

  return candidates.some((candidate) => candidate.length > 0 && value === candidate);
}

export function matchesNanikaProfileMatch(match: NanikaProfileMatch | undefined, context: NanikaProfileContext = {}) {
  if (match?.enabled === false) {
    return false;
  }

  const includedPageIds = [...toArray(match?.pageId), ...(match?.pageIds ?? [])];
  const includedUrlContains = toArray(match?.urlContains);
  const includedUrlStartsWith = toArray(match?.urlStartsWith);
  const includedUrlEquals = toArray(match?.urlEquals);
  const includedUrlPatterns = [...toArray(match?.urlPattern), ...(match?.urlPatterns ?? [])];

  if (match?.excludePageIds?.includes(context.pageId ?? "")) {
    return false;
  }

  if (matchesAnyContains(context.url, match?.excludeUrlContains ?? [])) {
    return false;
  }

  if (matchesAnyStartsWith(context.url, match?.excludeUrlStartsWith ?? [])) {
    return false;
  }

  if (matchesAnyEquals(context.url, match?.excludeUrlEquals ?? [])) {
    return false;
  }

  if (matchesAnyPattern(context.url, match?.excludeUrlPatterns ?? [])) {
    return false;
  }

  if (includedPageIds.length > 0 && !includedPageIds.includes(context.pageId ?? "")) {
    return false;
  }

  if (includedUrlContains.length > 0 && !matchesAnyContains(context.url, includedUrlContains)) {
    return false;
  }

  if (includedUrlStartsWith.length > 0 && !matchesAnyStartsWith(context.url, includedUrlStartsWith)) {
    return false;
  }

  if (includedUrlEquals.length > 0 && !matchesAnyEquals(context.url, includedUrlEquals)) {
    return false;
  }

  if (includedUrlPatterns.length > 0 && !matchesAnyPattern(context.url, includedUrlPatterns)) {
    return false;
  }

  return true;
}

function collectMappingRules(mappings: readonly NanikaMapping[], mappingIds: readonly string[], warnings: string[]) {
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const rules: RuntimeRule[] = [];

  Array.from(new Set(mappingIds)).forEach((mappingId) => {
    const mapping = mappingById.get(mappingId);

    if (!mapping) {
      warnings.push(`Missing mapping: ${mappingId}`);
      return;
    }

    rules.push(createRuntimeRuleFromMapping(mapping));
  });

  return rules;
}

function createProfileRules({
  featureSets,
  mappings,
  featureSetIds,
  mappingIds,
  warnings,
}: {
  featureSets: readonly NanikaFeatureSet[];
  mappings: readonly NanikaMapping[];
  featureSetIds: readonly string[];
  mappingIds: readonly string[];
  warnings: string[];
}) {
  const featureSetResult = createRuntimeRulesFromFeatureSets(featureSets, mappings, featureSetIds);
  warnings.push(...featureSetResult.warnings);

  return [
    ...featureSetResult.rules,
    ...collectMappingRules(mappings, mappingIds, warnings),
  ];
}

function mergeInitialState(
  base: NanikaProfileInitialState | undefined,
  override: NanikaProfileInitialState | undefined,
) {
  return {
    ...(base ?? {}),
    ...(override ?? {}),
  };
}

function createOverridesFromProfile(
  profile: NanikaRuntimeProfile,
  characterProfile: NanikaCharacterProfile | undefined,
  rules: RuntimeRule[],
  context: NanikaProfileContext,
): NanikaRuntimePresetOverrides {
  const initial = mergeInitialState(profile.initial, characterProfile?.initial);

  return {
    ...(profile.controls || characterProfile?.controls
      ? { controls: { ...(profile.controls ?? {}), ...(characterProfile?.controls ?? {}) } }
      : {}),
    ...(profile.userPreferences || characterProfile?.userPreferences
      ? { userPreferences: { ...(profile.userPreferences ?? {}), ...(characterProfile?.userPreferences ?? {}) } }
      : {}),
    ...(profile.preferenceStorage || characterProfile?.preferenceStorage
      ? { preferenceStorage: { ...(profile.preferenceStorage ?? {}), ...(characterProfile?.preferenceStorage ?? {}) } }
      : {}),
    ...(profile.speechLayout || characterProfile?.speechLayout
      ? { speechLayout: characterProfile?.speechLayout ?? profile.speechLayout }
      : {}),
    ...(profile.speechBalloonSize || characterProfile?.speechBalloonSize
      ? { speechBalloonSize: { ...(profile.speechBalloonSize ?? {}), ...(characterProfile?.speechBalloonSize ?? {}) } }
      : {}),
    ...(profile.spriteSize || characterProfile?.spriteSize
      ? { spriteSize: { ...(profile.spriteSize ?? {}), ...(characterProfile?.spriteSize ?? {}) } }
      : {}),
    ...(characterProfile?.characterPlacement ?? profile.characterPlacement
      ? { characterPlacement: characterProfile?.characterPlacement ?? profile.characterPlacement }
      : {}),
    ...(characterProfile?.balloonTheme ?? profile.balloonTheme
      ? { balloonTheme: characterProfile?.balloonTheme ?? profile.balloonTheme }
      : {}),
    ...(characterProfile?.hideUntilReady ?? profile.hideUntilReady) !== undefined
      ? { hideUntilReady: characterProfile?.hideUntilReady ?? profile.hideUntilReady }
      : {},
    ...(initial.scene ? { initialScene: initial.scene } : {}),
    ...(initial.surface ? { initialSurface: initial.surface } : {}),
    ...(initial.expression ? { initialExpression: initial.expression } : {}),
    ...(characterProfile?.includeDefaultRules ?? profile.includeDefaultRules) !== undefined
      ? { includeDefaultRules: characterProfile?.includeDefaultRules ?? profile.includeDefaultRules }
      : {},
    context,
    replaceRules: rules,
  };
}

export function createNanikaRuntimeProfileOptions({
  profile,
  context = {},
  featureSets = [],
  mappings = [],
  characterId,
}: NanikaRuntimeProfileOptionsInput): NanikaRuntimeProfileOptionsResult {
  const warnings: string[] = [];

  if (!matchesNanikaProfileMatch(profile.match, context)) {
    return {
      matched: false,
      profile,
      warnings,
    };
  }

  const characterProfile = profile.characterProfiles?.find((candidate) => (
    (!characterId || candidate.characterId === characterId)
    && matchesNanikaProfileMatch(candidate.match, context)
  ));

  if (profile.characterProfiles && profile.characterProfiles.length > 0 && !characterProfile) {
    warnings.push(`No matching character profile for runtime profile '${profile.id}'.`);
  }

  const featureSetIds = [
    ...(profile.featureSetIds ?? []),
    ...(characterProfile?.featureSetIds ?? []),
  ];
  const mappingIds = [
    ...(profile.mappingIds ?? []),
    ...(characterProfile?.mappingIds ?? []),
  ];
  const rules = createProfileRules({
    featureSets,
    mappings,
    featureSetIds,
    mappingIds,
    warnings,
  });

  return {
    matched: true,
    profile,
    ...(characterProfile ? { characterProfile } : {}),
    overrides: createOverridesFromProfile(profile, characterProfile, rules, context),
    warnings,
  };
}

const legacyNanikaCommonKeys = [
  { key: "expression.neutral", kind: "expression", label: "기본 표정", required: true },
  { key: "expression.happy", kind: "expression", label: "기쁜 표정" },
  { key: "expression.thinking", kind: "expression", label: "생각 표정" },
  { key: "expression.surprised", kind: "expression", label: "놀란 표정" },
  { key: "surface.idle", kind: "surface", label: "기본 상태", required: true },
  { key: "surface.guide", kind: "surface", label: "안내 상태" },
  { key: "surface.talking", kind: "surface", label: "말하는 상태" },
  { key: "scene.default", kind: "scene", label: "기본 무대" },
  { key: "scene.desk", kind: "scene", label: "책상 무대" },
  { key: "dialogue.guide.welcome", kind: "dialogue", label: "첫 안내 대사", required: true },
  { key: "dialogue.menu.selected", kind: "dialogue", label: "메뉴 선택 대사" },
  { key: "dialogue.error.default", kind: "dialogue", label: "기본 오류 대사" },
  { key: "layer.eyes.blink", kind: "layer", label: "눈 깜빡임" },
  { key: "layer.mouth.talk", kind: "layer", label: "말하는 입모양" },
  { key: "layer.fx.emphasis", kind: "layer", label: "강조 효과" },
] satisfies NanikaCommonKeyDefinition[];

void legacyNanikaCommonKeys;

export const defaultNanikaCommonKeys = [
  { key: "expression.neutral", kind: "expression", label: "기본 표정", required: true },
  { key: "expression.happy", kind: "expression", label: "기쁜 표정" },
  { key: "expression.thinking", kind: "expression", label: "생각 표정" },
  { key: "expression.surprised", kind: "expression", label: "놀란 표정" },
  { key: "surface.idle", kind: "surface", label: "기본 상태", required: true },
  { key: "surface.guide", kind: "surface", label: "안내 상태" },
  { key: "surface.talking", kind: "surface", label: "말하는 상태" },
  { key: "scene.default", kind: "scene", label: "기본 무대" },
  { key: "scene.desk", kind: "scene", label: "책상 무대" },
  { key: "dialogue.guide.welcome", kind: "dialogue", label: "첫 안내 대사", required: true },
  { key: "dialogue.menu.selected", kind: "dialogue", label: "메뉴 선택 대사" },
  { key: "dialogue.error.default", kind: "dialogue", label: "기본 오류 대사" },
  { key: "layer.eyes.blink", kind: "layer", label: "눈 깜빡임" },
  { key: "layer.mouth.talk", kind: "layer", label: "말하는 입모양" },
  { key: "layer.fx.emphasis", kind: "layer", label: "강조 효과" },
] satisfies NanikaCommonKeyDefinition[];
