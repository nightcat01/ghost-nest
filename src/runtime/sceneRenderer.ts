import type { RuntimeScene, RuntimeSceneLayer, RuntimeSceneOptions } from "../core/types.js";
import type { RuntimeElements } from "./domElements.js";

type SceneRendererOptions = {
  elements: RuntimeElements;
  scene: RuntimeSceneOptions | undefined;
  initialScene?: string | undefined;
};

const defaultCharacterSceneDepth = 10;
const defaultMaxSceneOverlays = 2;

function getSceneLayerFit(layer: RuntimeSceneLayer) {
  if (layer.fit) {
    return layer.fit;
  }

  if (layer.role === "background") {
    return "cover";
  }

  return layer.placement ? "fill" : "contain";
}

function getSceneLayerOverflow(layer: RuntimeSceneLayer) {
  if (layer.overflow) {
    return layer.overflow;
  }

  if (layer.role === "background") {
    return "hidden";
  }

  return layer.placement ? "hidden" : "visible";
}

/**
 * Picks one scene definition from either a named scene, a named scene set, or the legacy layer list.
 */
function resolveScene(scene: RuntimeSceneOptions | undefined, preferredSceneId?: string): RuntimeScene | null {
  if (!scene) {
    return null;
  }

  const hasPreferredScene = typeof preferredSceneId === "string" && preferredSceneId.length > 0;
  const defaultSceneId = hasPreferredScene ? preferredSceneId : scene.defaultScene;

  if (defaultSceneId && scene.scenes?.[defaultSceneId]) {
    return scene.scenes[defaultSceneId];
  }

  const sceneSet = defaultSceneId ? scene.sceneSets?.[defaultSceneId] : null;

  if (sceneSet && sceneSet.length > 0) {
    return sceneSet[Math.floor(Math.random() * sceneSet.length)] ?? sceneSet[0] ?? null;
  }

  if (hasPreferredScene) {
    return null;
  }

  if (scene.layers) {
    return {
      id: "legacy",
      ...(scene.canvas ? { canvas: scene.canvas } : {}),
      layers: scene.layers,
    };
  }

  return null;
}

/**
 * Applies normalized placement data to a stage layer element.
 */
function applySceneLayerPlacement(element: HTMLElement, layer: RuntimeSceneLayer) {
  const placement = layer.placement;

  if (!placement) {
    element.dataset.placement = "full";
    element.style.removeProperty("--scene-layer-x");
    element.style.removeProperty("--scene-layer-y");
    element.style.removeProperty("--scene-layer-width");
    element.style.removeProperty("--scene-layer-height");
    return;
  }

  element.dataset.placement = placement.unit ?? "percent";
  element.style.left = `${placement.x}%`;
  element.style.top = `${placement.y}%`;
  element.style.width = `${placement.width}%`;
  element.style.height = `${placement.height}%`;
  element.style.setProperty("--scene-layer-x", `${placement.x}`);
  element.style.setProperty("--scene-layer-y", `${placement.y}`);
  element.style.setProperty("--scene-layer-width", `${placement.width}`);
  element.style.setProperty("--scene-layer-height", `${placement.height}`);
}

/**
 * Creates one DOM node for a configured stage layer.
 */
function createSceneLayerElement(layer: RuntimeSceneLayer) {
  const layerElement = document.createElement("div");
  const classNames = [
    "scene-layer",
    layer.placement ? "scene-composition-layer" : "",
    layer.className,
  ].filter(Boolean);

  layerElement.className = classNames.join(" ");
  layerElement.dataset.layerId = layer.id;
  layerElement.dataset.layerRole = layer.role;
  layerElement.dataset.fit = getSceneLayerFit(layer);
  layerElement.dataset.overflow = getSceneLayerOverflow(layer);
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
    if (layer.objectPosition) {
      image.style.objectPosition = layer.objectPosition;
    }
    layerElement.append(image);
  }

  return layerElement;
}

/**
 * Skips placeholder scene layers until they have real visual content.
 */
function isRenderableSceneLayer(layer: RuntimeSceneLayer) {
  if (layer.image || layer.color) {
    return true;
  }

  return layer.role === "background";
}

/**
 * Finds the scene slot that controls where the runtime character should sit.
 */
function getCharacterSceneLayer(layers: RuntimeSceneLayer[]) {
  return layers.find((layer) => layer.role === "character") ?? null;
}

/**
 * Applies only the scene character depth. Scene placement must not resize or move the runtime sprite.
 */
function applyCharacterSceneSlot(element: HTMLElement, layer: RuntimeSceneLayer | null) {
  element.style.setProperty("--character-scene-depth", String(layer?.depth ?? defaultCharacterSceneDepth));
  element.style.removeProperty("--scene-character-x");
  element.style.removeProperty("--scene-character-y");
  element.style.removeProperty("--scene-character-width");
  element.style.removeProperty("--scene-character-height");
  delete element.dataset.sceneCharacterPlacement;
}

/**
 * Applies the authored scene canvas size so percent placements use the same coordinate ratio at runtime.
 */
function applySceneCanvas(element: HTMLElement, scene: RuntimeScene | null) {
  const canvas = scene?.canvas;

  if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
    element.style.removeProperty("--scene-canvas-width");
    element.style.removeProperty("--scene-canvas-height");
    element.style.removeProperty("--scene-canvas-aspect-ratio");
    delete element.dataset.sceneCanvas;
    return;
  }

  element.dataset.sceneCanvas = "authored";
  element.style.setProperty("--scene-canvas-width", `${canvas.width}px`);
  element.style.setProperty("--scene-canvas-height", `${canvas.height}px`);
  element.style.setProperty("--scene-canvas-aspect-ratio", `${canvas.width} / ${canvas.height}`);
}

/**
 * Renders stage-level composition layers such as backgrounds, desks, foreground props, and effects.
 */
export function createSceneRenderer({ elements, scene, initialScene }: SceneRendererOptions) {
  const viewport = document.createElement("div");
  const backLayerRoot = document.createElement("div");
  const frontLayerRoot = document.createElement("div");
  const originalSpriteParent = elements.sprite.parentElement;
  const originalSpriteNextSibling = elements.sprite.nextSibling;
  let currentSceneOptions = scene;
  let selectedScene = resolveScene(currentSceneOptions, initialScene);
  const overlayScenes = new Map<string, RuntimeScene>();
  const overlayTimers = new Map<string, number>();

  viewport.className = "scene-viewport";
  backLayerRoot.className = "scene-layer-root scene-layer-root-back";
  frontLayerRoot.className = "scene-layer-root scene-layer-root-front";
  backLayerRoot.setAttribute("aria-hidden", "true");
  frontLayerRoot.setAttribute("aria-hidden", "true");
  viewport.append(backLayerRoot, frontLayerRoot);
  elements.stage.prepend(viewport);

  function appendSceneLayer(layer: RuntimeSceneLayer, characterDepth: number, options: { overlaySlot?: string; overlayId?: string } = {}) {
    const element = createSceneLayerElement(layer);
    const targetRoot = (layer.depth ?? 0) > characterDepth ? frontLayerRoot : backLayerRoot;

    if (options.overlaySlot) {
      element.dataset.sceneOverlaySlot = options.overlaySlot;
    }

    if (options.overlayId) {
      element.dataset.sceneOverlayId = options.overlayId;
    }

    targetRoot.append(element);
  }

  /**
   * Rebuilds the stage layer stack from runtime configuration.
   */
  function render() {
    const characterLayer = getCharacterSceneLayer(selectedScene?.layers ?? []);
    const characterDepth = characterLayer?.depth ?? defaultCharacterSceneDepth;
    const hasSceneLayers = Boolean(selectedScene?.layers?.some((layer) => layer.role !== "character" && isRenderableSceneLayer(layer)));

    backLayerRoot.replaceChildren();
    frontLayerRoot.replaceChildren();
    elements.stage.dataset.sceneId = selectedScene?.id ?? "";
    elements.stage.dataset.sceneActive = selectedScene && (hasSceneLayers || Boolean(characterLayer?.placement)) ? "true" : "false";
    applySceneCanvas(elements.stage, selectedScene);
    applyCharacterSceneSlot(elements.stage, characterLayer);
    backLayerRoot.style.zIndex = String(characterDepth - 1);
    frontLayerRoot.style.zIndex = String(characterDepth + 1);

    selectedScene?.layers
      ?.slice()
      .filter((layer) => layer.role !== "character")
      .filter(isRenderableSceneLayer)
      .sort((current, next) => (current.depth ?? 0) - (next.depth ?? 0))
      .forEach((layer) => {
        appendSceneLayer(layer, characterDepth);
      });

    Array.from(overlayScenes.entries()).forEach(([slot, overlayScene]) => {
      overlayScene.layers
        .slice()
        .filter((layer) => layer.role !== "character")
        .filter(isRenderableSceneLayer)
        .sort((current, next) => (current.depth ?? 0) - (next.depth ?? 0))
        .forEach((layer) => {
          appendSceneLayer(layer, characterDepth, { overlaySlot: slot, overlayId: overlayScene.id });
        });
    });
  }

  /**
   * Removes stage layer DOM owned by this renderer.
   */
  function destroy() {
    overlayTimers.forEach((timerId) => window.clearTimeout(timerId));
    overlayTimers.clear();
    if (originalSpriteParent && elements.sprite.parentElement !== originalSpriteParent) {
      originalSpriteParent.insertBefore(elements.sprite, originalSpriteNextSibling);
    }
    viewport.remove();
  }

  function setScene(sceneId: string) {
    const nextScene = resolveScene(currentSceneOptions, sceneId);

    if (!nextScene) {
      elements.stage.dispatchEvent(new CustomEvent("ghostnest:scene-missing", { detail: { id: sceneId } }));
      return;
    }

    selectedScene = nextScene;
    overlayScenes.clear();
    overlayTimers.forEach((timerId) => window.clearTimeout(timerId));
    overlayTimers.clear();
    render();
  }

  function addSceneOverlay(sceneId: string, options: { slot?: string; duration?: number } = {}) {
    const overlayScene = resolveScene(currentSceneOptions, sceneId);

    if (!overlayScene) {
      elements.stage.dispatchEvent(new CustomEvent("ghostnest:scene-missing", { detail: { id: sceneId } }));
      return;
    }

    const slot = options.slot || sceneId;

    if (!overlayScenes.has(slot) && overlayScenes.size >= defaultMaxSceneOverlays) {
      const oldestSlot = overlayScenes.keys().next().value as string | undefined;

      if (oldestSlot) {
        removeSceneOverlay(oldestSlot);
      }
    }

    if (overlayTimers.has(slot)) {
      window.clearTimeout(overlayTimers.get(slot));
      overlayTimers.delete(slot);
    }

    overlayScenes.set(slot, overlayScene);
    elements.stage.dataset.sceneOverlayCount = String(overlayScenes.size);
    render();

    if (options.duration && options.duration > 0) {
      overlayTimers.set(slot, window.setTimeout(() => {
        removeSceneOverlay(slot);
      }, options.duration));
    }
  }

  function removeSceneOverlay(slotOrSceneId: string) {
    const removedBySlot = overlayScenes.delete(slotOrSceneId);

    if (!removedBySlot) {
      Array.from(overlayScenes.entries()).forEach(([slot, overlayScene]) => {
        if (overlayScene.id === slotOrSceneId) {
          overlayScenes.delete(slot);
        }
      });
    }

    if (overlayTimers.has(slotOrSceneId)) {
      window.clearTimeout(overlayTimers.get(slotOrSceneId));
      overlayTimers.delete(slotOrSceneId);
    }

    elements.stage.dataset.sceneOverlayCount = String(overlayScenes.size);
    render();
  }

  function setSceneOptions(nextSceneOptions: RuntimeSceneOptions | undefined, nextInitialScene?: string | undefined) {
    currentSceneOptions = nextSceneOptions;
    selectedScene = resolveScene(currentSceneOptions, nextInitialScene);
    overlayScenes.clear();
    overlayTimers.forEach((timerId) => window.clearTimeout(timerId));
    overlayTimers.clear();
    elements.stage.dataset.sceneOverlayCount = "0";
    render();
  }

  render();

  return {
    addSceneOverlay,
    destroy,
    render,
    removeSceneOverlay,
    setScene,
    setSceneOptions,
  };
}
