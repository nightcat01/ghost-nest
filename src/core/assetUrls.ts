import type {
  CharacterAssets,
  CharacterDefinition,
  CharacterExpressionAsset,
  CharacterLayer,
  CharacterSurface,
  CharacterVisualSource,
  RuntimeScene,
  RuntimeSceneLayer,
} from "./types.js";

export type CharacterAssetBaseUrlOptions = {
  charactersRootUrl?: string;
  characterAssetBaseUrl?: string;
  commonAssetBaseUrl?: string;
  sourceCharacterPrefix?: string;
  sourceCommonPrefix?: string;
};

const DEFAULT_CHARACTER_SOURCE_PREFIXES = [
  "./src/characters/",
  "/src/characters/",
  "src/characters/",
];

const DEFAULT_COMMON_SOURCE_PREFIXES = [
  "./src/assets/common/",
  "/src/assets/common/",
  "src/assets/common/",
];

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}

function isExternalAssetUrl(value: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value);
}

function joinAssetUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}/${trimLeadingSlash(path)}`;
}

function normalizeAssetPath(value: string) {
  return value.replaceAll("\\", "/");
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function trimLeadingDotSlash(value: string) {
  return value.replace(/^(?:\.\/)+/, "");
}

function createSourcePrefixVariants(prefix: string) {
  const normalizedPrefix = ensureTrailingSlash(normalizeAssetPath(prefix.trim()));
  const barePrefix = trimLeadingDotSlash(trimLeadingSlash(normalizedPrefix));

  return [
    normalizedPrefix,
    barePrefix,
    `./${barePrefix}`,
    `/${barePrefix}`,
  ];
}

function createSourcePrefixCandidates(primaryPrefix: string | undefined, defaultPrefixes: string[]) {
  return Array.from(
    new Set([
      ...(primaryPrefix ? createSourcePrefixVariants(primaryPrefix) : []),
      ...defaultPrefixes.flatMap(createSourcePrefixVariants),
    ]),
  ).sort((left, right) => right.length - left.length);
}

function findSourcePrefix(value: string, prefixes: string[]) {
  return prefixes.find((prefix) => value.startsWith(prefix));
}

function rewriteAssetUrl(value: string, options: CharacterAssetBaseUrlOptions) {
  if (!value || isExternalAssetUrl(value)) {
    return value;
  }

  const normalizedValue = normalizeAssetPath(value);
  const sourceCharacterPrefixes = createSourcePrefixCandidates(
    options.sourceCharacterPrefix,
    DEFAULT_CHARACTER_SOURCE_PREFIXES,
  );
  const sourceCommonPrefixes = createSourcePrefixCandidates(
    options.sourceCommonPrefix,
    DEFAULT_COMMON_SOURCE_PREFIXES,
  );
  const characterBaseUrl = options.charactersRootUrl ?? options.characterAssetBaseUrl;
  const matchedCharacterPrefix = findSourcePrefix(normalizedValue, sourceCharacterPrefixes);
  const matchedCommonPrefix = findSourcePrefix(normalizedValue, sourceCommonPrefixes);

  if (characterBaseUrl && matchedCharacterPrefix) {
    return joinAssetUrl(characterBaseUrl, normalizedValue.slice(matchedCharacterPrefix.length));
  }

  if (options.commonAssetBaseUrl && matchedCommonPrefix) {
    return joinAssetUrl(options.commonAssetBaseUrl, normalizedValue.slice(matchedCommonPrefix.length));
  }

  return value;
}

function rewriteVisualSource(source: CharacterVisualSource, options: CharacterAssetBaseUrlOptions): CharacterVisualSource {
  if (source.type !== "image") {
    return source;
  }

  return {
    ...source,
    src: rewriteAssetUrl(source.src, options),
  };
}

function rewriteExpressionAsset(
  asset: CharacterExpressionAsset,
  options: CharacterAssetBaseUrlOptions,
): CharacterExpressionAsset {
  if (typeof asset === "string") {
    return rewriteAssetUrl(asset, options);
  }

  if (Array.isArray(asset)) {
    return asset.map((entry) => (
      typeof entry === "string" ? rewriteAssetUrl(entry, options) : rewriteVisualSource(entry, options)
    )) as CharacterExpressionAsset;
  }

  return rewriteVisualSource(asset, options);
}

function rewriteLayer(layer: CharacterLayer, options: CharacterAssetBaseUrlOptions): CharacterLayer {
  return {
    ...layer,
    ...(layer.image ? { image: rewriteAssetUrl(layer.image, options) } : {}),
    ...(layer.frames ? { frames: layer.frames.map((frame) => rewriteAssetUrl(frame, options)) } : {}),
  };
}

function rewriteSurface(surface: CharacterSurface, options: CharacterAssetBaseUrlOptions): CharacterSurface {
  const rewrittenSurface: CharacterSurface = {
    ...surface,
    ...(surface.image ? { image: rewriteAssetUrl(surface.image, options) } : {}),
    ...(surface.visual ? { visual: rewriteVisualSource(surface.visual, options) } : {}),
  };

  if (surface.layers) {
    rewrittenSurface.layers = Object.fromEntries(
      Object.entries(surface.layers).map(([layerId, layer]) => [
        layerId,
        layer ? rewriteLayer(layer, options) : layer,
      ]),
    ) as NonNullable<CharacterSurface["layers"]>;
  }

  return rewrittenSurface;
}

function rewriteSceneLayer(layer: RuntimeSceneLayer, options: CharacterAssetBaseUrlOptions): RuntimeSceneLayer {
  return {
    ...layer,
    ...(layer.image ? { image: rewriteAssetUrl(layer.image, options) } : {}),
  };
}

function rewriteScene(scene: RuntimeScene, options: CharacterAssetBaseUrlOptions): RuntimeScene {
  return {
    ...scene,
    layers: scene.layers.map((layer) => rewriteSceneLayer(layer, options)),
  };
}

function rewriteAssets(assets: CharacterAssets, options: CharacterAssetBaseUrlOptions): CharacterAssets {
  return {
    ...assets,
    expressions: Object.fromEntries(
      Object.entries(assets.expressions).map(([expression, asset]) => [
        expression,
        rewriteExpressionAsset(asset, options),
      ]),
    ) as CharacterAssets["expressions"],
    ...(assets.surfaces
      ? {
        surfaces: Object.fromEntries(
          Object.entries(assets.surfaces).map(([surfaceId, surface]) => [
            surfaceId,
            rewriteSurface(surface, options),
          ]),
        ),
      }
      : {}),
    ...(assets.scenes
      ? {
        scenes: Object.fromEntries(
          Object.entries(assets.scenes).map(([sceneId, scene]) => [sceneId, rewriteScene(scene, options)]),
        ),
      }
      : {}),
    ...(assets.sceneSets
      ? {
        sceneSets: Object.fromEntries(
          Object.entries(assets.sceneSets).map(([sceneSetId, scenes]) => [
            sceneSetId,
            scenes.map((scene) => rewriteScene(scene, options)),
          ]),
        ),
      }
      : {}),
  };
}

/**
 * Clones a character definition and rewrites bundled source asset paths for host app public paths.
 */
export function createCharacterWithAssetBaseUrl(
  character: CharacterDefinition,
  options: CharacterAssetBaseUrlOptions,
): CharacterDefinition {
  return {
    ...character,
    ...(character.assets ? { assets: rewriteAssets(character.assets, options) } : {}),
  };
}
