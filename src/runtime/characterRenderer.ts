import type {
  CharacterDefinition,
  CharacterExpression,
  CharacterLayer,
  CharacterLayerId,
  CharacterRuntimeMode,
  CharacterSurface,
  CharacterVisualSource,
  RuntimeSceneLayer,
  RuntimeState,
} from "../core/types.js";
import type { RuntimeElements } from "./domElements.js";

type CharacterRendererOptions = {
  elements: RuntimeElements;
  character: CharacterDefinition;
};

function normalizeVisualSource(source: string | CharacterVisualSource | null | undefined): CharacterVisualSource | null {
  if (!source) {
    return null;
  }

  return typeof source === "string" ? { type: "image", src: source } : source;
}

function getVisualSourceKey(source: CharacterVisualSource | null) {
  if (!source) {
    return "";
  }

  return source.type === "image" ? `image:${source.src}` : `scene:${source.sceneId}`;
}

function pickExpressionAsset(
  asset: string | string[] | CharacterVisualSource | CharacterVisualSource[] | undefined,
  currentAsset: CharacterVisualSource | null,
) {
  if (!asset) {
    return null;
  }

  if (!Array.isArray(asset)) {
    return normalizeVisualSource(asset);
  }

  if (asset.length === 0) {
    return null;
  }

  const currentKey = getVisualSourceKey(currentAsset);
  const visualAssets = asset.map(normalizeVisualSource).filter((source): source is CharacterVisualSource => Boolean(source));
  const candidates = visualAssets.length > 1
    ? visualAssets.filter((candidate) => getVisualSourceKey(candidate) !== currentKey)
    : visualAssets;
  const index = Math.floor(Math.random() * candidates.length);

  return candidates[index] ?? visualAssets[0] ?? null;
}

function setupSpriteLayerElements(sprite: HTMLButtonElement, baseImage: HTMLImageElement) {
  const layers = new Map<CharacterLayerId, HTMLImageElement>();

  baseImage.classList.add("character-sprite-layer");
  baseImage.dataset.layerId = "base";
  layers.set("base", baseImage);

  return layers;
}

function getSurfaceBaseImage(surface: CharacterSurface) {
  return surface.layers?.base?.image ?? surface.image ?? null;
}

function getSurfaceVisualSource(surface: CharacterSurface) {
  return surface.visual ?? normalizeVisualSource(getSurfaceBaseImage(surface));
}

function getSurfaceLayer(surface: CharacterSurface | null, layerId: CharacterLayerId): CharacterLayer | null {
  if (!surface) {
    return null;
  }

  const layer = surface.layers?.[layerId];

  if (layer) {
    return layer;
  }

  if (layerId === "mouth" && surface.mouthImages) {
    return {
      frames: [surface.mouthImages.closed, surface.mouthImages.open],
      intervalMs: 140,
      coversBase: true,
    };
  }

  return null;
}

function getLayerFrame(layer: CharacterLayer, frameIndex: number) {
  return layer.frames?.[frameIndex] ?? layer.image ?? null;
}

function getRenderableLayerIds(surface: CharacterSurface): CharacterLayerId[] {
  const layerIds = Object.keys(surface.layers ?? {}).filter((layerId) => layerId !== "base") as CharacterLayerId[];

  if (surface.mouthImages && !layerIds.includes("mouth")) {
    layerIds.push("mouth");
  }

  return layerIds;
}

function isFullCoverLayer(layer: CharacterLayer) {
  return Boolean(layer.coversBase && !layer.placement);
}

function shouldKeepLayerVisibleWhenInactive(layer: CharacterLayer) {
  return Boolean(!isFullCoverLayer(layer) && !layer.idleIntervalMs);
}

function canRunIdleLayer(layerId: CharacterLayerId, layer: CharacterLayer) {
  return layerId !== "mouth" && (layer.idleIntervalMs ?? 0) > 0;
}

function resetLayerPlacement(layerElement: HTMLImageElement) {
  layerElement.style.removeProperty("left");
  layerElement.style.removeProperty("top");
  layerElement.style.removeProperty("width");
  layerElement.style.removeProperty("height");
  layerElement.style.removeProperty("z-index");
  layerElement.dataset.placement = "full";
}

function applyLayerPlacement(layerElement: HTMLImageElement, layer: CharacterLayer) {
  const placement = layer.placement;

  if (!placement) {
    resetLayerPlacement(layerElement);
    layerElement.style.zIndex = String(layer.depth ?? 10);
    return;
  }

  layerElement.dataset.placement = placement.unit ?? "percent";
  layerElement.style.left = `${placement.x}%`;
  layerElement.style.top = `${placement.y}%`;
  layerElement.style.width = `${placement.width}%`;
  layerElement.style.height = `${placement.height}%`;
  layerElement.style.zIndex = String(layer.depth ?? 10);
}

function applySceneLayerPlacement(element: HTMLElement, layer: RuntimeSceneLayer) {
  const placement = layer.placement;

  if (!placement) {
    element.dataset.placement = "full";
    return;
  }

  element.dataset.placement = placement.unit ?? "percent";
  element.style.left = `${placement.x}%`;
  element.style.top = `${placement.y}%`;
  element.style.width = `${placement.width}%`;
  element.style.height = `${placement.height}%`;
}

/**
 * Resolves once the browser has loaded and decoded an image source.
 */
function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();

    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(resolve).catch(resolve);
        return;
      }

      resolve();
    };
    image.onerror = () => resolve();
    image.src = src;
  });
}

type SurfaceImageSourceOptions = {
  includeAnimatedLayers?: boolean;
};

/**
 * Creates the DOM renderer for character expressions, surfaces, and layer animations.
 * This module owns visual state only; actions and rules decide when the state changes.
 */
export function createCharacterRenderer({ elements, character }: CharacterRendererOptions) {
  const spriteLayers = setupSpriteLayerElements(elements.sprite, elements.spriteImage);
  const sceneVisualRoot = document.createElement("div");
  const activeLayerAnimations = new Map<CharacterLayerId, number>();
  const activeLayerIds = new Set<CharacterLayerId>();
  const idleLayerAnimations = new Map<CharacterLayerId, number>();
  let currentSurface: CharacterSurface | null = null;
  let currentVisualSource: CharacterVisualSource | null = null;
  let surfaceApplyToken = 0;

  sceneVisualRoot.className = "character-sprite-scene";
  sceneVisualRoot.hidden = true;
  sceneVisualRoot.setAttribute("aria-hidden", "true");
  elements.sprite.insertBefore(sceneVisualRoot, elements.spriteImage);

  function getLayerElement(layerId: CharacterLayerId) {
    const existingLayerElement = spriteLayers.get(layerId);

    if (existingLayerElement) {
      return existingLayerElement;
    }

    const layerImage = document.createElement("img");

    layerImage.className = "character-sprite-layer";
    layerImage.dataset.layerId = layerId;
    layerImage.alt = "";
    layerImage.hidden = true;
    layerImage.setAttribute("aria-hidden", "true");
    elements.sprite.append(layerImage);
    spriteLayers.set(layerId, layerImage);

    return layerImage;
  }

  function findSurfaceForExpression(expression: CharacterExpression, visualSource: CharacterVisualSource | null) {
    const surfaces = character.assets?.surfaces;

    if (!surfaces) {
      return null;
    }

    const visualSourceKey = getVisualSourceKey(visualSource);

    return Object.values(surfaces).find((surface) =>
      surface.expression === expression && (!visualSourceKey || getVisualSourceKey(getSurfaceVisualSource(surface)) === visualSourceKey),
    ) ?? null;
  }

  function clearPartLayers() {
    spriteLayers.forEach((layerElement, layerId) => {
      if (layerId === "base") {
        return;
      }

      layerElement.removeAttribute("src");
      resetLayerPlacement(layerElement);
      layerElement.hidden = true;
    });
  }

  function getSurfaceImageSources(surface: CharacterSurface, options: SurfaceImageSourceOptions = {}) {
    const includeAnimatedLayers = options.includeAnimatedLayers ?? true;
    const layerImages = Object.values(surface.layers ?? {}).flatMap((layer) => {
      if (!layer) {
        return [];
      }

      if (!includeAnimatedLayers && (layer.coversBase || layer.idleIntervalMs)) {
        return [];
      }

      return [
        ...(layer.image ? [layer.image] : []),
        ...(layer.frames ?? []),
      ];
    });

    if (includeAnimatedLayers && surface.mouthImages) {
      layerImages.push(surface.mouthImages.closed, surface.mouthImages.open);
    }

    const visualSource = getSurfaceVisualSource(surface);
    const sceneLayers = visualSource?.type === "scene"
      ? character.assets?.scenes?.[visualSource.sceneId]?.layers ?? []
      : [];

    return [
      ...(visualSource?.type === "image" ? [visualSource.src] : []),
      ...sceneLayers.map((layer) => layer.image).filter((src): src is string => Boolean(src)),
      ...layerImages,
    ].filter((src): src is string => Boolean(src));
  }

  function createSceneVisualLayer(layer: RuntimeSceneLayer) {
    const layerElement = document.createElement("div");

    layerElement.className = "character-sprite-scene-layer";
    layerElement.dataset.layerId = layer.id;
    layerElement.dataset.layerRole = layer.role;
    layerElement.style.zIndex = String(layer.depth ?? 0);
    applySceneLayerPlacement(layerElement, layer);

    if (layer.color) {
      layerElement.style.background = layer.color;
    }

    if (layer.image) {
      const image = document.createElement("img");

      image.src = layer.image;
      image.alt = layer.alt ?? "";
      image.draggable = false;
      image.setAttribute("aria-hidden", layer.alt ? "false" : "true");
      layerElement.append(image);
    }

    return layerElement;
  }

  function renderSceneVisual(sceneId: string) {
    const scene = character.assets?.scenes?.[sceneId];

    sceneVisualRoot.replaceChildren();
    sceneVisualRoot.dataset.sceneId = sceneId;

    scene?.layers
      .filter((layer) => layer.role !== "character")
      .filter((layer) => layer.image || layer.color || layer.role === "background")
      .sort((current, next) => (current.depth ?? 0) - (next.depth ?? 0))
      .forEach((layer) => {
        sceneVisualRoot.append(createSceneVisualLayer(layer));
      });
  }

  function applyVisualSource(visualSource: CharacterVisualSource | null) {
    currentVisualSource = visualSource;

    if (visualSource?.type === "scene") {
      renderSceneVisual(visualSource.sceneId);
      sceneVisualRoot.hidden = false;
      elements.spriteImage.hidden = true;
      elements.sprite.dataset.visualType = "scene";
      return;
    }

    sceneVisualRoot.hidden = true;
    delete elements.sprite.dataset.visualType;

    if (visualSource?.type === "image" && elements.spriteImage.getAttribute("src") !== visualSource.src) {
      elements.spriteImage.src = visualSource.src;
    }

    elements.spriteImage.hidden = false;
  }

  /**
   * Warms image cache and waits for decoding before a visible surface swap.
   */
  async function preloadSurfaceImages(surface: CharacterSurface, options: SurfaceImageSourceOptions = {}) {
    await Promise.all(Array.from(new Set(getSurfaceImageSources(surface, options))).map(preloadImage));
  }

  function warmSurfaceImages(surface: CharacterSurface) {
    void preloadSurfaceImages(surface, { includeAnimatedLayers: true });
  }

  function renderStaticPartLayers(surface: CharacterSurface) {
    clearPartLayers();

    getRenderableLayerIds(surface).forEach((layerId) => {
      const layer = getSurfaceLayer(surface, layerId);

      if (!layer || layer.coversBase || layer.idleIntervalMs) {
        return;
      }

      const layerImage = getLayerFrame(layer, 0);
      const layerElement = getLayerElement(layerId);

      if (!layerImage) {
        return;
      }

      applyLayerPlacement(layerElement, layer);
      layerElement.src = layerImage;
      layerElement.hidden = false;
    });
  }

  function applySurfaceDefinition(surface: CharacterSurface) {
    const visualSource = getSurfaceVisualSource(surface);

    currentSurface = surface;
    elements.sprite.dataset.surfaceId = surface.id;
    elements.spriteImage.alt = surface.alt ?? character.assets?.alt ?? character.profile.name;
    applyVisualSource(visualSource);
    renderStaticPartLayers(surface);
  }

  /**
   * Applies a surface only after its images are ready, leaving the current surface visible while waiting.
   */
  async function applySurfaceDefinitionWhenReady(surface: CharacterSurface) {
    const token = ++surfaceApplyToken;

    if (!currentSurface && !currentVisualSource) {
      applySurfaceDefinition(surface);
      warmSurfaceImages(surface);
      return true;
    }

    await preloadSurfaceImages(surface, { includeAnimatedLayers: false });

    if (token !== surfaceApplyToken) {
      return false;
    }

    applySurfaceDefinition(surface);
    warmSurfaceImages(surface);
    return true;
  }

  function applyPartFrame(layerId: CharacterLayerId, layer: CharacterLayer, frameIndex: number, isActive: boolean) {
    const layerElement = getLayerElement(layerId);
    const nextImage = getLayerFrame(layer, frameIndex);

    if (!nextImage) {
      return;
    }

    if (layerElement.getAttribute("src") !== nextImage) {
      layerElement.src = nextImage;
    }

    applyLayerPlacement(layerElement, layer);
    layerElement.hidden = false;

    if (isActive && isFullCoverLayer(layer)) {
      elements.spriteImage.hidden = true;
      spriteLayers.forEach((otherLayerElement, otherLayerId) => {
        if (otherLayerId === layerId) {
          return;
        }

        if (otherLayerId !== "base") {
          otherLayerElement.hidden = true;
        }
      });
    }
  }

  function stopLayerAnimation(layerId: CharacterLayerId) {
    const timerId = activeLayerAnimations.get(layerId);

    if (timerId !== undefined) {
      window.clearInterval(timerId);
      activeLayerAnimations.delete(layerId);
    }
  }

  function stopIdleLayerAnimations() {
    idleLayerAnimations.forEach((timerId) => window.clearInterval(timerId));
    idleLayerAnimations.clear();
  }

  function hasActiveFullCoverLayer() {
    return Array.from(activeLayerIds).some((activeLayerId) => {
      const activeLayer = getSurfaceLayer(currentSurface, activeLayerId);

      return activeLayer ? isFullCoverLayer(activeLayer) : false;
    });
  }

  function setLayerAnimationActive(layerId: CharacterLayerId, isActive: boolean) {
    stopLayerAnimation(layerId);

    const layer = getSurfaceLayer(currentSurface, layerId);
    const layerElement = spriteLayers.get(layerId);

    if (!isActive || !layer) {
      activeLayerIds.delete(layerId);

      if (!hasActiveFullCoverLayer()) {
        elements.spriteImage.hidden = false;
      }

      if (layer && shouldKeepLayerVisibleWhenInactive(layer)) {
        applyPartFrame(layerId, layer, 0, false);
      } else if (layerElement) {
        layerElement.hidden = true;
      }

      return;
    }

    const frameCount = Math.max(layer.frames?.length ?? 0, layer.image ? 1 : 0);

    if (frameCount <= 0) {
      return;
    }

    if (hasActiveFullCoverLayer() && !isFullCoverLayer(layer)) {
      return;
    }

    activeLayerIds.add(layerId);
    let frameIndex = frameCount > 1 ? 1 : 0;
    applyPartFrame(layerId, layer, frameIndex, true);

    if (frameCount <= 1) {
      return;
    }

    const timerId = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frameCount;
      applyPartFrame(layerId, layer, frameIndex, true);
    }, layer.intervalMs ?? 140);

    activeLayerAnimations.set(layerId, timerId);
  }

  function setMouthAnimationActive(isActive: boolean) {
    setLayerAnimationActive("mouth", isActive);
  }

  function stopLayerAnimations() {
    Array.from(activeLayerIds).forEach((layerId) => setLayerAnimationActive(layerId, false));
  }

  function startIdleLayerAnimations(surface: CharacterSurface) {
    stopIdleLayerAnimations();

    getRenderableLayerIds(surface).forEach((layerId) => {
      const layer = getSurfaceLayer(surface, layerId);
      if (!layer || !canRunIdleLayer(layerId, layer)) {
        return;
      }

      const timerId = window.setInterval(() => {
        if (activeLayerIds.has(layerId) || hasActiveFullCoverLayer()) {
          return;
        }

        const frameCount = Math.max(layer.frames?.length ?? 0, layer.image ? 1 : 0);
        const playbackMs = Math.max(layer.intervalMs ?? 140, 40) * Math.max(frameCount, 1);

        setLayerAnimationActive(layerId, true);
        window.setTimeout(() => {
          setLayerAnimationActive(layerId, false);
        }, playbackMs);
      }, layer.idleIntervalMs ?? 0);

      idleLayerAnimations.set(layerId, timerId);
    });
  }

  function renderState(state: Pick<RuntimeState, "expression" | "lastTouchedPart">) {
    stopLayerAnimations();
    stopIdleLayerAnimations();
    elements.sprite.dataset.expression = state.expression;
    elements.spriteImage.alt = character.assets?.alt ?? character.profile.name;

    const expressionAsset = character.assets
      ? pickExpressionAsset(character.assets.expressions[state.expression], currentVisualSource)
      : null;
    const surface = findSurfaceForExpression(state.expression, expressionAsset);

    if (surface) {
      void applySurfaceDefinitionWhenReady(surface).then((applied) => {
        if (applied) {
          startIdleLayerAnimations(surface);
        }
      });
    } else {
      surfaceApplyToken += 1;
      currentSurface = null;
      delete elements.sprite.dataset.surfaceId;
      clearPartLayers();

      applyVisualSource(expressionAsset);
    }

    if (state.lastTouchedPart) {
      elements.sprite.dataset.touchedPart = state.lastTouchedPart;
      return;
    }

    delete elements.sprite.dataset.touchedPart;
  }

  function applySurface(surfaceId: string, options: { startIdleLayers?: boolean } = {}) {
    const surface = character.assets?.surfaces?.[surfaceId];

    if (!surface) {
      elements.stage.dispatchEvent(new CustomEvent("ghostnest:surface-missing", { detail: { id: surfaceId } }));
      return;
    }

    stopLayerAnimations();
    stopIdleLayerAnimations();
    void applySurfaceDefinitionWhenReady(surface).then((applied) => {
      if (applied && (options.startIdleLayers ?? true)) {
        startIdleLayerAnimations(surface);
      }
    });
  }

  function setMode(mode: CharacterRuntimeMode) {
    elements.stage.dataset.state = mode;
  }

  function destroy() {
    surfaceApplyToken += 1;
    stopLayerAnimations();
    stopIdleLayerAnimations();
    sceneVisualRoot.remove();
  }

  return {
    applySurface,
    destroy,
    renderState,
    setLayerAnimationActive,
    setMode,
    setMouthAnimationActive,
  };
}
