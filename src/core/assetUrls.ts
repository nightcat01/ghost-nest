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

function rewriteAssetUrl(value: string, options: CharacterAssetBaseUrlOptions) {
  if (!value || isExternalAssetUrl(value)) {
    return value;
  }

  const normalizedValue = normalizeAssetPath(value);
  const sourceCharacterPrefix = normalizeAssetPath(options.sourceCharacterPrefix ?? "./src/characters/");
  const sourceCommonPrefix = normalizeAssetPath(options.sourceCommonPrefix ?? "./src/assets/common/");
  const characterBaseUrl = options.charactersRootUrl ?? options.characterAssetBaseUrl;

  if (characterBaseUrl && normalizedValue.startsWith(sourceCharacterPrefix)) {
    return joinAssetUrl(characterBaseUrl, normalizedValue.slice(sourceCharacterPrefix.length));
  }

  if (options.commonAssetBaseUrl && normalizedValue.startsWith(sourceCommonPrefix)) {
    return joinAssetUrl(options.commonAssetBaseUrl, normalizedValue.slice(sourceCommonPrefix.length));
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
