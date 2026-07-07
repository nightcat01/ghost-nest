import { requireElement } from "./assetShared.js";
import {
  AssetFile,
  createDevtoolsApiPath,
  fetchAssetFiles,
  fetchCharacterAssets,
  readApiJson,
} from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { appendAssetOptionGroups, filterAssetFiles } from "./assetSelect.js";
import {
  CharacterAssetSaveKind,
  createCharacterAssetSaveDirectory,
  createCommonAssetSaveDirectory,
  createSavedAssetPaths,
  readImageFiles,
  saveUploadedAssetFiles,
} from "./assetUpload.js";
import type { RuntimeScene, RuntimeSceneLayer } from "../core/types.js";

type SceneSaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  saved?: {
    path: string;
    sceneId: string;
  };
};
type ScenePlacementInputs = {
  x: HTMLInputElement;
  y: HTMLInputElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
};
type EditableSceneLayer = {
  id: string;
  role: "prop" | "effect";
  image: string;
  depth: number;
  fit?: RuntimeSceneLayer["fit"];
  objectPosition?: string;
  overflow?: RuntimeSceneLayer["overflow"];
  imagePlacement?: RuntimeSceneLayer["imagePlacement"];
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
    unit: "percent";
  };
};
type SceneDragMode = "move" | "resize-nw" | "resize-ne" | "resize-se" | "resize-sw";
type SceneDragState = {
  layerId: string;
  role: EditableSceneLayer["role"];
  mode: SceneDragMode;
  startClientX: number;
  startClientY: number;
  stageRect: DOMRect;
  startPlacement: EditableSceneLayer["placement"];
};
type SceneUploadTarget = {
  assetKind: CharacterAssetSaveKind;
  directory: string;
  label: string;
};

const newSceneSelectValue = "__new_scene__";
const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const sceneSelect = requireElement(document.querySelector<HTMLSelectElement>("#sceneSelect"), "#sceneSelect");
const sceneList = requireElement(document.querySelector<HTMLElement>("#sceneList"), "#sceneList");
const sceneIdInput = requireElement(document.querySelector<HTMLInputElement>("#sceneIdInput"), "#sceneIdInput");
const defaultSceneInput = requireElement(document.querySelector<HTMLInputElement>("#defaultSceneInput"), "#defaultSceneInput");
const sceneUploadAssetKindSelect = requireElement(document.querySelector<HTMLSelectElement>("#sceneUploadAssetKindSelect"), "#sceneUploadAssetKindSelect");
const sceneImageInput = requireElement(document.querySelector<HTMLInputElement>("#sceneImageInput"), "#sceneImageInput");
const uploadSceneImagesButton = requireElement(document.querySelector<HTMLButtonElement>("#uploadSceneImagesButton"), "#uploadSceneImagesButton");
const backgroundAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#backgroundAssetSelect"), "#backgroundAssetSelect");
const backgroundColorInput = requireElement(document.querySelector<HTMLInputElement>("#backgroundColorInput"), "#backgroundColorInput");
const backgroundDepthInput = requireElement(document.querySelector<HTMLInputElement>("#backgroundDepthInput"), "#backgroundDepthInput");
const characterPreviewVisibleInput = requireElement(document.querySelector<HTMLInputElement>("#characterPreviewVisibleInput"), "#characterPreviewVisibleInput");
const characterPreviewImageSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterPreviewImageSelect"), "#characterPreviewImageSelect");
const characterDepthInput = requireElement(document.querySelector<HTMLInputElement>("#characterDepthInput"), "#characterDepthInput");
const propLayerSelect = requireElement(document.querySelector<HTMLSelectElement>("#propLayerSelect"), "#propLayerSelect");
const propAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#propAssetSelect"), "#propAssetSelect");
const propDepthInput = requireElement(document.querySelector<HTMLInputElement>("#propDepthInput"), "#propDepthInput");
const addPropLayerButton = requireElement(document.querySelector<HTMLButtonElement>("#addPropLayerButton"), "#addPropLayerButton");
const removePropLayerButton = requireElement(document.querySelector<HTMLButtonElement>("#removePropLayerButton"), "#removePropLayerButton");
const effectLayerSelect = requireElement(document.querySelector<HTMLSelectElement>("#effectLayerSelect"), "#effectLayerSelect");
const effectAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#effectAssetSelect"), "#effectAssetSelect");
const effectDepthInput = requireElement(document.querySelector<HTMLInputElement>("#effectDepthInput"), "#effectDepthInput");
const addEffectLayerButton = requireElement(document.querySelector<HTMLButtonElement>("#addEffectLayerButton"), "#addEffectLayerButton");
const removeEffectLayerButton = requireElement(document.querySelector<HTMLButtonElement>("#removeEffectLayerButton"), "#removeEffectLayerButton");
const propPlacementInputs = {
  x: requireElement(document.querySelector<HTMLInputElement>("#propXInput"), "#propXInput"),
  y: requireElement(document.querySelector<HTMLInputElement>("#propYInput"), "#propYInput"),
  width: requireElement(document.querySelector<HTMLInputElement>("#propWidthInput"), "#propWidthInput"),
  height: requireElement(document.querySelector<HTMLInputElement>("#propHeightInput"), "#propHeightInput"),
} satisfies ScenePlacementInputs;
const effectPlacementInputs = {
  x: requireElement(document.querySelector<HTMLInputElement>("#effectXInput"), "#effectXInput"),
  y: requireElement(document.querySelector<HTMLInputElement>("#effectYInput"), "#effectYInput"),
  width: requireElement(document.querySelector<HTMLInputElement>("#effectWidthInput"), "#effectWidthInput"),
  height: requireElement(document.querySelector<HTMLInputElement>("#effectHeightInput"), "#effectHeightInput"),
} satisfies ScenePlacementInputs;
const preview = requireElement(document.querySelector<HTMLElement>("#scenePreview"), "#scenePreview");
const sceneStackWarnings = requireElement(document.querySelector<HTMLElement>("#sceneStackWarnings"), "#sceneStackWarnings");
const scenePreviewSizeInput = requireElement(document.querySelector<HTMLInputElement>("#scenePreviewSizeInput"), "#scenePreviewSizeInput");
const scenePreviewZoomOutButton = requireElement(document.querySelector<HTMLButtonElement>("#scenePreviewZoomOutButton"), "#scenePreviewZoomOutButton");
const scenePreviewZoomInButton = requireElement(document.querySelector<HTMLButtonElement>("#scenePreviewZoomInButton"), "#scenePreviewZoomInButton");
const output = requireElement(document.querySelector<HTMLElement>("#sceneOutput"), "#sceneOutput");
const status = requireElement(document.querySelector<HTMLElement>("#sceneStatus"), "#sceneStatus");
const saveButton = requireElement(document.querySelector<HTMLButtonElement>("#saveSceneButton"), "#saveSceneButton");
const deleteButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteSceneButton"), "#deleteSceneButton");
const sceneActionProxyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-scene-action-proxy]"));

let savedAssetFiles: AssetFile[] = [];
let existingScenes: Record<string, RuntimeScene> = {};
let existingDefaultScene = "";
let propLayers: EditableSceneLayer[] = [];
let effectLayers: EditableSceneLayer[] = [];
let sceneDragState: SceneDragState | null = null;
let scenePreviewSize = 760;
let scenePreviewAspectRatio = 1;

const sceneDepthDefaults = {
  background: 0,
  character: 20,
  prop: 30,
  effect: 40,
} as const;

const defaultCharacterPreviewPlacement = {
  x: 19,
  y: 0,
  width: 62,
  height: 100,
  unit: "percent",
} as const;

/**
 * Keeps the scene workbench size inside a usable editing range.
 */
function clampPreviewSize(value: number) {
  return Math.min(1400, Math.max(480, Math.round(value / 20) * 20));
}

/**
 * Applies the scene workbench size without changing layer placement data.
 */
function setScenePreviewSize(size: number) {
  scenePreviewSize = clampPreviewSize(size);
  scenePreviewSizeInput.value = String(scenePreviewSize);
  preview.style.setProperty("--asset-scene-preview-width", `${scenePreviewSize}px`);
}

function setScenePreviewAspectRatio(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : scenePreviewSize;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : scenePreviewSize;

  scenePreviewAspectRatio = safeWidth / safeHeight;
  preview.style.setProperty("--asset-scene-preview-aspect-ratio", `${safeWidth} / ${safeHeight}`);
}

/**
 * Reads the selected folder for Scene page uploads.
 */
function getSceneUploadTarget(characterId: string): SceneUploadTarget {
  const selectedValue = sceneUploadAssetKindSelect.value;
  const assetKind: CharacterAssetSaveKind = selectedValue.endsWith("parts") || selectedValue === "parts"
    ? "parts"
    : "scenes";
  const isCommonAsset = selectedValue.startsWith("common-");

  return {
    assetKind,
    directory: isCommonAsset
      ? createCommonAssetSaveDirectory(assetKind)
      : createCharacterAssetSaveDirectory(characterId, assetKind),
    label: `${isCommonAsset ? "공통" : characterId} ${assetKind}`,
  };
}

/**
 * Normalizes saved paths before matching them against freshly loaded select options.
 */
function normalizeAssetPathForMatch(path: string) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

/**
 * Selects the newly saved asset from a select after the list has been reloaded.
 */
function selectSavedAssetOption(select: HTMLSelectElement, savedPaths: string[]) {
  const normalizedSavedPaths = new Set(savedPaths.map(normalizeAssetPathForMatch));
  const matchedOption = Array.from(select.options).find((option) =>
    normalizedSavedPaths.has(normalizeAssetPathForMatch(option.value)),
  );

  if (!matchedOption) {
    return false;
  }

  select.value = matchedOption.value;

  return true;
}

/**
 * Renders reusable scene asset choices for background, prop, and effect slots.
 */
function renderAssetOptions() {
  const baseAssets = filterAssetFiles(savedAssetFiles, ["base"], { includeCommon: false });
  const sceneAssets = filterAssetFiles(savedAssetFiles, ["scene"]);
  const sceneAndPartAssets = filterAssetFiles(savedAssetFiles, ["scene", "part"]);

  const selectedCharacterPreviewImage = characterPreviewImageSelect.value;

  characterPreviewImageSelect.replaceChildren(new Option(baseAssets.length > 0 ? "기준 이미지 없음" : "저장된 기본 이미지가 없어요.", ""));
  appendAssetOptionGroups(characterPreviewImageSelect, baseAssets, { character: "캐릭터 기본 이미지" });
  if (selectedCharacterPreviewImage && Array.from(characterPreviewImageSelect.options).some((option) => option.value === selectedCharacterPreviewImage)) {
    characterPreviewImageSelect.value = selectedCharacterPreviewImage;
  } else if (!selectedCharacterPreviewImage && baseAssets[0]) {
    characterPreviewImageSelect.value = baseAssets[0].path;
  }

  backgroundAssetSelect.replaceChildren(new Option(sceneAssets.length > 0 ? "배경 이미지 없음" : "무대 재료 이미지가 없어요.", ""));
  propAssetSelect.replaceChildren(new Option(sceneAndPartAssets.length > 0 ? "소품 이미지 선택" : "무대 재료/파츠 이미지가 없어요.", ""));
  effectAssetSelect.replaceChildren(new Option(sceneAndPartAssets.length > 0 ? "FX 이미지 선택" : "무대 재료/파츠 이미지가 없어요.", ""));
  appendAssetOptionGroups(backgroundAssetSelect, sceneAssets);
  appendAssetOptionGroups(propAssetSelect, sceneAndPartAssets);
  appendAssetOptionGroups(effectAssetSelect, sceneAndPartAssets);
}

/**
 * Reads a numeric input while falling back to a stable scene default.
 */
function readNumber(input: HTMLInputElement, fallback: number) {
  const value = Number(input.value);

  return Number.isFinite(value) ? value : fallback;
}

/**
 * Keeps placement values inside the percent preview stage.
 */
function clampPlacement(placement: EditableSceneLayer["placement"]) {
  const width = Math.min(100, Math.max(1, placement.width));
  const height = Math.min(100, Math.max(1, placement.height));
  const x = Math.min(100 - width, Math.max(0, placement.x));
  const y = Math.min(100 - height, Math.max(0, placement.y));

  return { x, y, width, height, unit: "percent" as const };
}

/**
 * Converts four placement inputs into the percent placement used by runtime scenes.
 */
function readPlacement(inputs: ScenePlacementInputs) {
  return clampPlacement({
    x: readNumber(inputs.x, 0),
    y: readNumber(inputs.y, 0),
    width: readNumber(inputs.width, 100),
    height: readNumber(inputs.height, 100),
    unit: "percent",
  });
}

/**
 * Writes placement values back into the edit fields.
 */
function writePlacement(inputs: ScenePlacementInputs, placement: EditableSceneLayer["placement"]) {
  inputs.x.value = String(Number(placement.x.toFixed(1)));
  inputs.y.value = String(Number(placement.y.toFixed(1)));
  inputs.width.value = String(Number(placement.width.toFixed(1)));
  inputs.height.value = String(Number(placement.height.toFixed(1)));
}

/**
 * Updates one existing preview layer in place so dragging does not recreate or reload images.
 */
function updatePreviewLayerPlacement(layer: EditableSceneLayer) {
  const element = preview.querySelector<HTMLElement>(`.asset-scene-preview-layer[data-scene-layer-id="${CSS.escape(layer.id)}"]`);

  if (!element) {
    return;
  }

  element.style.left = `${layer.placement.x}%`;
  element.style.top = `${layer.placement.y}%`;
  element.style.width = `${layer.placement.width}%`;
  element.style.height = `${layer.placement.height}%`;
}

/**
 * Returns the selected editable layer from one role list.
 */
function getSelectedEditableLayer(role: EditableSceneLayer["role"]) {
  const layers = role === "prop" ? propLayers : effectLayers;
  const select = role === "prop" ? propLayerSelect : effectLayerSelect;

  return layers.find((layer) => layer.id === select.value) ?? null;
}

/**
 * Looks up the current layer value so repeated drags do not reuse stale preview closures.
 */
function getEditableLayerById(role: EditableSceneLayer["role"], layerId: string) {
  const layers = role === "prop" ? propLayers : effectLayers;

  return layers.find((layer) => layer.id === layerId) ?? null;
}

/**
 * Creates a stable editable layer id for newly added scene items.
 */
function createEditableLayerId(role: EditableSceneLayer["role"]) {
  const layers = role === "prop" ? propLayers : effectLayers;
  const prefix = role === "prop" ? "prop" : "effect";
  let index = layers.length + 1;

  while (layers.some((layer) => layer.id === `${prefix}-${index}`)) {
    index += 1;
  }

  return `${prefix}-${index}`;
}

/**
 * Reads the current form fields for one prop or effect layer.
 */
function readEditableLayerFromInputs(role: EditableSceneLayer["role"], id = createEditableLayerId(role)): EditableSceneLayer {
  const assetSelect = role === "prop" ? propAssetSelect : effectAssetSelect;
  const depthInput = role === "prop" ? propDepthInput : effectDepthInput;
  const placementInputs = role === "prop" ? propPlacementInputs : effectPlacementInputs;
  const fallbackDepth = role === "prop" ? sceneDepthDefaults.prop : sceneDepthDefaults.effect;

  return {
    id,
    role,
    image: assetSelect.value,
    depth: readNumber(depthInput, fallbackDepth),
    fit: "fill",
    objectPosition: "center",
    overflow: "hidden",
    placement: readPlacement(placementInputs),
  };
}

/**
 * Writes one editable layer into the matching form fields.
 */
function applyEditableLayerToInputs(layer: EditableSceneLayer | null, role: EditableSceneLayer["role"]) {
  const assetSelect = role === "prop" ? propAssetSelect : effectAssetSelect;
  const depthInput = role === "prop" ? propDepthInput : effectDepthInput;
  const placementInputs = role === "prop" ? propPlacementInputs : effectPlacementInputs;
  const fallback = role === "prop"
    ? { x: 20, y: 74, width: 80, height: 25, unit: "percent" as const }
    : { x: 0, y: 0, width: 100, height: 100, unit: "percent" as const };

  assetSelect.value = layer?.image ?? "";
  depthInput.value = String(layer?.depth ?? (role === "prop" ? sceneDepthDefaults.prop : sceneDepthDefaults.effect));
  writePlacement(placementInputs, layer?.placement ?? fallback);
}

/**
 * Replaces or inserts one editable layer in the relevant role list.
 */
function upsertEditableLayer(layer: EditableSceneLayer) {
  const layers = layer.role === "prop" ? propLayers : effectLayers;
  const index = layers.findIndex((item) => item.id === layer.id);
  const nextLayers = index >= 0
    ? layers.map((item) => (item.id === layer.id ? layer : item))
    : [...layers, layer];

  if (layer.role === "prop") {
    propLayers = nextLayers;
    propLayerSelect.value = layer.id;
  } else {
    effectLayers = nextLayers;
    effectLayerSelect.value = layer.id;
  }
}

/**
 * Syncs the current form values into the selected editable layer.
 */
function syncSelectedLayerFromInputs(role: EditableSceneLayer["role"]) {
  const selectedLayer = getSelectedEditableLayer(role);

  if (!selectedLayer) {
    return;
  }

  upsertEditableLayer(readEditableLayerFromInputs(role, selectedLayer.id));
}

/**
 * Renders the select list for one editable scene layer role.
 */
function renderEditableLayerList(role: EditableSceneLayer["role"]) {
  const layers = role === "prop" ? propLayers : effectLayers;
  const select = role === "prop" ? propLayerSelect : effectLayerSelect;
  const removeButton = role === "prop" ? removePropLayerButton : removeEffectLayerButton;
  const currentValue = select.value;

  select.replaceChildren();

  if (layers.length === 0) {
    select.append(new Option(role === "prop" ? "소품 없음" : "FX 없음", ""));
    removeButton.disabled = true;
    return;
  }

  layers.forEach((layer, index) => {
    const fileName = layer.image.split("/").pop() ?? "이미지 없음";

    select.append(new Option(`${index + 1}. ${fileName} / 겹침 ${layer.depth}`, layer.id));
  });
  select.value = layers.some((layer) => layer.id === currentValue) ? currentValue : layers[0]?.id ?? "";
  removeButton.disabled = !select.value;
}

/**
 * Refreshes both prop and effect list controls.
 */
function renderEditableLayerLists() {
  renderEditableLayerList("prop");
  renderEditableLayerList("effect");
}

/**
 * Adds a prop or effect layer from the current form values.
 */
function addEditableLayer(role: EditableSceneLayer["role"]) {
  const layer = readEditableLayerFromInputs(role);

  if (!layer.image) {
    status.textContent = role === "prop" ? "추가할 소품 이미지를 선택하세요." : "추가할 FX 이미지를 선택하세요.";
    return;
  }

  upsertEditableLayer(layer);
  renderEditableLayerLists();
  renderOutputs();
}

/**
 * Removes the selected prop or effect layer.
 */
function removeEditableLayer(role: EditableSceneLayer["role"]) {
  const select = role === "prop" ? propLayerSelect : effectLayerSelect;
  const selectedId = select.value;

  if (!selectedId) {
    return;
  }

  if (role === "prop") {
    propLayers = propLayers.filter((layer) => layer.id !== selectedId);
  } else {
    effectLayers = effectLayers.filter((layer) => layer.id !== selectedId);
  }

  renderEditableLayerLists();
  applyEditableLayerToInputs(getSelectedEditableLayer(role), role);
  renderOutputs();
}

/**
 * Converts editable prop and effect layers into runtime scene layers.
 */
function createEditableRuntimeLayers() {
  return [...propLayers, ...effectLayers]
    .filter((layer) => layer.image)
    .map((layer) => ({
      id: layer.id,
      role: layer.role,
      image: layer.image,
      depth: layer.depth,
      fit: layer.fit ?? "fill",
      objectPosition: layer.objectPosition ?? "center",
      overflow: layer.overflow ?? "hidden",
      placement: layer.placement,
      ...(layer.imagePlacement ? { imagePlacement: layer.imagePlacement } : {}),
    } satisfies RuntimeSceneLayer));
}

/**
 * Creates the scene snippet that is previewed and sent to the dev server.
 */
function createSceneSnippet() {
  const sceneId = sceneIdInput.value.trim() || "desk-room";
  const layers: RuntimeSceneLayer[] = [];
  const backgroundImage = backgroundAssetSelect.value;
  const backgroundColor = backgroundColorInput.value.trim();
  const previewRect = preview.getBoundingClientRect();
  const canvasWidth = Math.max(1, Math.round(previewRect.width || scenePreviewSize));
  const canvasHeight = Math.max(1, Math.round(previewRect.height || preview.clientHeight || canvasWidth / scenePreviewAspectRatio));

  if (backgroundImage || backgroundColor) {
    layers.push({
      id: "background",
      role: "background",
      depth: readNumber(backgroundDepthInput, sceneDepthDefaults.background),
      ...(backgroundImage ? { image: backgroundImage } : {}),
      ...(backgroundColor ? { color: backgroundColor } : {}),
      fit: "fill",
      objectPosition: "center",
      overflow: "hidden",
    });
  }

  layers.push({
    id: "character-slot",
    role: "character",
    depth: readNumber(characterDepthInput, sceneDepthDefaults.character),
    placement: defaultCharacterPreviewPlacement,
  });
  layers.push(...createEditableRuntimeLayers());

  return {
    sceneId,
    defaultScene: defaultSceneInput.checked,
    scene: {
      id: sceneId,
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
      },
      layers,
    } satisfies RuntimeScene,
  };
}

function getSceneLayerDepth(layer: RuntimeSceneLayer) {
  if (typeof layer.depth === "number") {
    return layer.depth;
  }

  if (layer.role === "background") {
    return sceneDepthDefaults.background;
  }

  if (layer.role === "character") {
    return sceneDepthDefaults.character;
  }

  if (layer.role === "effect") {
    return sceneDepthDefaults.effect;
  }

  return sceneDepthDefaults.prop;
}

function getSceneLayerCoveragePercent(layer: RuntimeSceneLayer) {
  const placement = layer.placement;

  if (!placement) {
    return 100;
  }

  return Math.min(100, Math.max(0, (placement.width * placement.height) / 100));
}

function createSceneStackWarnings(scene: RuntimeScene) {
  const characterLayer = findLayer(scene, "character");
  const characterDepth = getSceneLayerDepth(characterLayer ?? {
    id: "character-slot",
    role: "character",
    depth: sceneDepthDefaults.character,
  });
  const warnings: string[] = [];

  scene.layers
    .filter((layer) => layer.role !== "character" && (layer.image || layer.color))
    .forEach((layer) => {
      const depth = getSceneLayerDepth(layer);
      const coverage = getSceneLayerCoveragePercent(layer);

      if (layer.role === "background" && depth >= characterDepth) {
        warnings.push(`배경 ${layer.id}의 겹침 순서가 캐릭터(${characterDepth})보다 앞입니다. 배경은 보통 캐릭터보다 낮은 depth를 사용하세요.`);
      }

      if ((layer.role === "prop" || layer.role === "effect") && depth >= characterDepth && coverage >= 70) {
        const layerLabel = layer.role === "prop" ? "소품" : "FX";

        warnings.push(`${layerLabel} ${layer.id}가 화면의 ${Math.round(coverage)}%를 차지하면서 캐릭터보다 앞에 있습니다. 전체 이미지라면 배경으로 두거나 depth를 ${characterDepth}보다 낮게 두세요.`);
      }
    });

  return warnings;
}

function renderSceneStackWarnings(warnings: string[]) {
  sceneStackWarnings.replaceChildren();

  if (warnings.length === 0) {
    sceneStackWarnings.hidden = true;
    return;
  }

  sceneStackWarnings.hidden = false;
  warnings.forEach((warning) => {
    const item = document.createElement("p");

    item.textContent = warning;
    sceneStackWarnings.append(item);
  });
}

/**
 * Applies placement values to a preview layer element.
 */
function applyPreviewPlacement(element: HTMLElement, layer: RuntimeSceneLayer) {
  if (!layer.placement) {
    element.style.inset = "0";
    return;
  }

  element.style.left = `${layer.placement.x}%`;
  element.style.top = `${layer.placement.y}%`;
  element.style.width = `${layer.placement.width}%`;
  element.style.height = `${layer.placement.height}%`;
}

/**
 * Starts dragging or resizing an editable scene layer.
 */
function startSceneLayerDrag(event: PointerEvent, layer: EditableSceneLayer, mode: SceneDragMode) {
  const stageRect = preview.getBoundingClientRect();
  const currentLayer = getEditableLayerById(layer.role, layer.id) ?? layer;
  const select = layer.role === "prop" ? propLayerSelect : effectLayerSelect;

  select.value = currentLayer.id;
  applyEditableLayerToInputs(currentLayer, currentLayer.role);

  sceneDragState = {
    layerId: currentLayer.id,
    role: currentLayer.role,
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    stageRect,
    startPlacement: { ...currentLayer.placement },
  };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

/**
 * Applies the active drag state to the selected editable layer.
 */
function handleSceneLayerDrag(event: PointerEvent) {
  if (!sceneDragState) {
    return;
  }

  const layer = [...propLayers, ...effectLayers].find((item) => item.id === sceneDragState?.layerId);

  if (!layer) {
    return;
  }

  const deltaX = ((event.clientX - sceneDragState.startClientX) / sceneDragState.stageRect.width) * 100;
  const deltaY = ((event.clientY - sceneDragState.startClientY) / sceneDragState.stageRect.height) * 100;
  const nextPlacement = { ...sceneDragState.startPlacement };

  if (sceneDragState.mode === "move") {
    nextPlacement.x += deltaX;
    nextPlacement.y += deltaY;
  } else {
    if (sceneDragState.mode.includes("w")) {
      nextPlacement.x += deltaX;
      nextPlacement.width -= deltaX;
    }

    if (sceneDragState.mode.includes("e")) {
      nextPlacement.width += deltaX;
    }

    if (sceneDragState.mode.includes("n")) {
      nextPlacement.y += deltaY;
      nextPlacement.height -= deltaY;
    }

    if (sceneDragState.mode.includes("s")) {
      nextPlacement.height += deltaY;
    }
  }

  upsertEditableLayer({ ...layer, placement: clampPlacement(nextPlacement) });
  const updatedLayer = getSelectedEditableLayer(sceneDragState.role);

  if (updatedLayer) {
    updatePreviewLayerPlacement(updatedLayer);
    writePlacement(sceneDragState.role === "prop" ? propPlacementInputs : effectPlacementInputs, updatedLayer.placement);
  }
}

/**
 * Stops scene layer dragging.
 */
function stopSceneLayerDrag() {
  if (sceneDragState) {
    renderEditableLayerLists();
    applyEditableLayerToInputs(getSelectedEditableLayer(sceneDragState.role), sceneDragState.role);
    renderSceneMetadata();
  }

  sceneDragState = null;
}

/**
 * Creates one visual preview node for a scene layer.
 */
function createPreviewLayer(layer: RuntimeSceneLayer) {
  const element = document.createElement("div");

  element.className = "asset-scene-preview-layer";
  element.dataset.sceneLayerId = layer.id;
  element.dataset.fit = layer.fit ?? "fill";
  element.dataset.overflow = layer.overflow ?? "hidden";
  element.style.zIndex = String(layer.depth ?? 0);
  applyPreviewPlacement(element, layer);

  if (layer.color) {
    element.style.background = layer.color;
  }

  if (layer.role === "character") {
    element.classList.add("asset-scene-character-slot");
    applyPreviewPlacement(element, {
      ...layer,
      placement: layer.placement ?? defaultCharacterPreviewPlacement,
    });

    if (characterPreviewVisibleInput.checked && characterPreviewImageSelect.value) {
      element.classList.add("asset-scene-character-preview");

      const image = document.createElement("img");

      image.src = characterPreviewImageSelect.value;
      image.alt = "무대 배치 기준 캐릭터 이미지";
      element.append(image);
    } else {
      element.textContent = "캐릭터 자리";
    }
  }

  if (layer.image) {
    const image = document.createElement("img");

    image.src = layer.image;
    image.alt = layer.alt ?? layer.id;
    image.style.objectPosition = layer.objectPosition ?? "center";
    if (layer.imagePlacement) {
      image.dataset.imagePlacement = layer.imagePlacement.unit ?? "percent";
      image.style.position = "absolute";
      image.style.left = `${layer.imagePlacement.x}%`;
      image.style.top = `${layer.imagePlacement.y}%`;
      image.style.width = `${layer.imagePlacement.width}%`;
      image.style.height = `${layer.imagePlacement.height}%`;
      image.style.maxWidth = "none";
    }
    element.append(image);
  }

  const editableLayer = [...propLayers, ...effectLayers].find((item) => item.id === layer.id);

  if (editableLayer) {
    element.classList.add("asset-scene-preview-layer-editable");
    element.dataset.layerLabel = editableLayer.role === "prop" ? "소품" : "FX";
    element.addEventListener("pointerdown", (event) => {
      startSceneLayerDrag(event, editableLayer, "move");
    });
    (["nw", "ne", "se", "sw"] as const).forEach((corner) => {
      const handle = document.createElement("span");

      handle.className = `asset-composite-region-handle asset-composite-region-handle-${corner}`;
      handle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        startSceneLayerDrag(event, editableLayer, `resize-${corner}`);
      });
      element.append(handle);
    });
  }

  return element;
}

function createSceneOutputPayload(sceneSnippet: ReturnType<typeof createSceneSnippet>) {
  return {
    defaultScene: sceneSnippet.defaultScene ? sceneSnippet.sceneId : "",
    scenePath: `assets.scenes[${JSON.stringify(sceneSnippet.sceneId)}]`,
    scene: sceneSnippet.scene,
  };
}

/**
 * Refreshes JSON output and stacking warnings without recreating preview images.
 */
function renderSceneMetadata() {
  const sceneSnippet = createSceneSnippet();
  const warnings = createSceneStackWarnings(sceneSnippet.scene);

  output.textContent = JSON.stringify(createSceneOutputPayload(sceneSnippet), null, 2);
  renderSceneStackWarnings(warnings);
}

/**
 * Refreshes the scene preview and JSON output.
 */
function renderOutputs() {
  const sceneSnippet = createSceneSnippet();

  preview.replaceChildren();
  sceneSnippet.scene.layers
    .slice()
    .sort((current, next) => (current.depth ?? 0) - (next.depth ?? 0))
    .forEach((layer) => {
      preview.append(createPreviewLayer(layer));
    });

  renderSceneMetadata();
}

/**
 * Finds the first layer for a scene role.
 */
function findLayer(scene: RuntimeScene | undefined, role: RuntimeSceneLayer["role"]) {
  return scene?.layers.find((layer) => layer.role === role);
}

/**
 * Returns editable layers from an existing runtime scene.
 */
function readEditableLayers(scene: RuntimeScene | undefined, role: EditableSceneLayer["role"]) {
  return (scene?.layers ?? [])
    .filter((layer) => layer.role === role && layer.image)
    .map((layer, index) => ({
      id: layer.id || `${role}-${index + 1}`,
      role,
      image: layer.image ?? "",
      depth: layer.depth ?? (role === "prop" ? sceneDepthDefaults.prop : sceneDepthDefaults.effect),
      ...(layer.fit ? { fit: layer.fit } : {}),
      ...(layer.objectPosition ? { objectPosition: layer.objectPosition } : {}),
      ...(layer.overflow ? { overflow: layer.overflow } : {}),
      ...(layer.imagePlacement ? { imagePlacement: layer.imagePlacement } : {}),
      placement: clampPlacement({
        x: layer.placement?.x ?? (role === "prop" ? 20 : 0),
        y: layer.placement?.y ?? (role === "prop" ? 74 : 0),
        width: layer.placement?.width ?? (role === "prop" ? 80 : 100),
        height: layer.placement?.height ?? (role === "prop" ? 25 : 100),
        unit: "percent",
      }),
    } satisfies EditableSceneLayer));
}

/**
 * Applies the selected existing scene to the form.
 */
function applySceneSelection() {
  deleteButton.disabled = sceneSelect.value === newSceneSelectValue || !sceneSelect.value;

  if (sceneSelect.value === newSceneSelectValue) {
    sceneIdInput.value = sceneIdInput.value.trim() || "desk-room";
    defaultSceneInput.checked = !existingDefaultScene;
    backgroundAssetSelect.value = "";
    backgroundColorInput.value = "";
    backgroundDepthInput.value = String(sceneDepthDefaults.background);
    characterDepthInput.value = String(sceneDepthDefaults.character);
    setScenePreviewAspectRatio(scenePreviewSize, scenePreviewSize);
    propLayers = [];
    effectLayers = [];
    renderEditableLayerLists();
    applyEditableLayerToInputs(null, "prop");
    applyEditableLayerToInputs(null, "effect");
    renderOutputs();
    renderSceneList();
    return;
  }

  const scene = existingScenes[sceneSelect.value];
  const backgroundLayer = findLayer(scene, "background");
  const characterLayer = findLayer(scene, "character");
  const canvas = scene?.canvas;

  sceneIdInput.value = scene?.id ?? sceneSelect.value;
  defaultSceneInput.checked = existingDefaultScene === sceneSelect.value;
  backgroundAssetSelect.value = backgroundLayer?.image ?? "";
  backgroundColorInput.value = backgroundLayer?.color ?? "";
  backgroundDepthInput.value = String(backgroundLayer?.depth ?? sceneDepthDefaults.background);
  characterDepthInput.value = String(characterLayer?.depth ?? sceneDepthDefaults.character);
  setScenePreviewAspectRatio(canvas?.width ?? scenePreviewSize, canvas?.height ?? scenePreviewSize);
  propLayers = readEditableLayers(scene, "prop");
  effectLayers = readEditableLayers(scene, "effect");
  renderEditableLayerLists();
  applyEditableLayerToInputs(getSelectedEditableLayer("prop"), "prop");
  applyEditableLayerToInputs(getSelectedEditableLayer("effect"), "effect");
  renderOutputs();
  renderSceneList();
}

/**
 * Renders the existing scene selector.
 */
function renderSceneOptions() {
  const currentValue = sceneSelect.value;

  sceneSelect.replaceChildren(new Option("새 무대 조합 만들기", newSceneSelectValue));
  Object.values(existingScenes)
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" }))
    .forEach((scene) => {
      const label = scene.id === existingDefaultScene ? `${scene.id} / default` : scene.id;

      sceneSelect.append(new Option(label, scene.id));
    });

  if (currentValue && Array.from(sceneSelect.options).some((option) => option.value === currentValue)) {
    sceneSelect.value = currentValue;
  }

  renderSceneList();
}

/**
 * Selects one saved scene and refreshes the editor form.
 */
function selectScene(sceneId: string) {
  if (!existingScenes[sceneId]) {
    return;
  }

  sceneSelect.value = sceneId;
  applySceneSelection();
}

/**
 * Renders saved scenes as visible cards so deletion and selection are discoverable.
 */
function renderSceneList() {
  const scenes = Object.values(existingScenes)
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" }));

  if (scenes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "asset-lab-help";
    empty.textContent = "아직 저장된 무대 조합이 없습니다. 위에서 새 무대 조합을 만든 뒤 저장하세요.";
    sceneList.replaceChildren(empty);
    return;
  }

  sceneList.replaceChildren(...scenes.map((scene) => {
    const card = document.createElement("article");
    card.className = "asset-scene-list-card";
    card.dataset.selected = sceneSelect.value === scene.id ? "true" : "false";

    const title = document.createElement("strong");
    title.textContent = scene.id === existingDefaultScene ? `${scene.id} / 기본` : scene.id;

    const summary = document.createElement("span");
    summary.textContent = `${scene.layers.length}개 요소`;

    const controls = document.createElement("div");
    controls.className = "asset-lab-actions";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.textContent = "선택";
    selectButton.addEventListener("click", () => selectScene(scene.id));

    const deleteSceneButton = document.createElement("button");
    deleteSceneButton.type = "button";
    deleteSceneButton.className = "asset-danger-button";
    deleteSceneButton.textContent = "삭제";
    deleteSceneButton.addEventListener("click", () => {
      void deleteSceneConfig(scene.id);
    });

    controls.append(selectButton, deleteSceneButton);
    card.append(title, summary, controls);

    return card;
  }));
}

/**
 * Loads reusable scene and common assets for the selected character.
 */
async function loadSavedAssetFiles() {
  const characterId = characterSelect.value || "rine";

  savedAssetFiles = await fetchAssetFiles(characterId);
  renderAssetOptions();
}

/**
 * Saves browser-selected images for scene backgrounds, props, or effects.
 */
async function uploadSceneImages() {
  const files = Array.from(sceneImageInput.files ?? []);
  const characterId = characterSelect.value || "rine";
  const uploadTarget = getSceneUploadTarget(characterId);

  if (files.length === 0) {
    status.textContent = "저장할 무대 재료 이미지를 먼저 선택하세요.";
    return;
  }

  uploadSceneImagesButton.disabled = true;
  status.textContent = `${uploadTarget.label} 폴더에 이미지 ${files.length}개를 저장하는 중이에요.`;

  try {
    const savedFiles = await saveUploadedAssetFiles(
      uploadTarget.directory,
      await readImageFiles(files),
    );
    const savedPaths = createSavedAssetPaths(savedFiles);

    await loadSavedAssetFiles();

    let selectedFromList = false;

    if (uploadTarget.assetKind === "scenes") {
      selectedFromList = selectSavedAssetOption(backgroundAssetSelect, savedPaths);
    } else {
      selectedFromList = selectSavedAssetOption(propAssetSelect, savedPaths);
      selectSavedAssetOption(effectAssetSelect, savedPaths);
    }

    sceneImageInput.value = "";
    renderOutputs();
    status.textContent = selectedFromList
      ? `${uploadTarget.label} 폴더에 이미지 ${savedFiles.length}개를 저장하고 목록에서 선택했어요.`
      : `${uploadTarget.label} 폴더에 이미지 ${savedFiles.length}개를 저장했지만 현재 목록에서 같은 경로를 찾지 못했어요. 작업 경로와 브라우저 경로 설정을 확인하세요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "무대 재료 이미지 저장 요청에 실패했어요.";
  } finally {
    uploadSceneImagesButton.disabled = false;
  }
}

/**
 * Loads scene settings from the selected character.
 */
async function loadCharacterAssets(preferredSceneId?: string) {
  const characterId = characterSelect.value || "rine";
  const result = await fetchCharacterAssets(characterId);

  existingScenes = result.assets?.scenes ?? {};
  existingDefaultScene = result.assets?.defaultScene ?? "";
  await loadSavedAssetFiles();
  renderSceneOptions();
  if (preferredSceneId && Array.from(sceneSelect.options).some((option) => option.value === preferredSceneId)) {
    sceneSelect.value = preferredSceneId;
  }
  applySceneSelection();
  status.textContent = `${characterId} 캐릭터의 무대 조합 정보를 불러왔어요.`;
}

/**
 * Loads available character ids from the dev server.
 */
async function loadCharacters() {
  try {
    const selectedCharacterId = await populateCharacterSelect(characterSelect);

    if (selectedCharacterId) {
      await loadCharacterAssets();
      return;
    }

    status.textContent = "불러올 캐릭터가 없어요.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 목록을 불러오지 못했어요.";
  }
}

/**
 * Validates the scene before saving it into character assets.
 */
function validateSceneSnippet(sceneSnippet: ReturnType<typeof createSceneSnippet>) {
  if (!sceneSnippet.sceneId) {
    return "무대 조합 ID를 입력하세요.";
  }

  if (!sceneSnippet.scene.layers.some((layer) => layer.role === "character")) {
    return "무대 조합에는 캐릭터 위치가 필요해요.";
  }

  if (!sceneSnippet.scene.layers.some((layer) => layer.role !== "character" && (layer.image || layer.color))) {
    return "배경색이나 이미지, 소품, FX 중 하나는 넣어주세요.";
  }

  return null;
}

/**
 * Saves the current scene into the selected character assets.
 */
async function saveSceneConfig() {
  const sceneSnippet = createSceneSnippet();
  const validationMessage = validateSceneSnippet(sceneSnippet);

  if (validationMessage) {
    status.textContent = validationMessage;
    return;
  }

  saveButton.disabled = true;
  status.textContent = "무대 조합을 저장하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-character-scene"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: characterSelect.value || "rine",
        scene: sceneSnippet,
      }),
    });
    const result = await readApiJson<SceneSaveResponse>(response);

    if (!response.ok || !result.ok) {
      status.textContent = result.message ?? `무대 조합 저장 실패: ${result.error ?? response.status}`;
      return;
    }

    await loadCharacterAssets(sceneSnippet.sceneId);
    status.textContent = `${result.saved?.path ?? "character index.ts"}에 무대 조합을 저장했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "무대 조합 저장 요청에 실패했어요.";
  } finally {
    saveButton.disabled = false;
    renderOutputs();
  }
}

/**
 * Deletes the selected scene from the character config.
 */
async function deleteSceneConfig(sceneId = sceneSelect.value) {

  if (!sceneId || sceneId === newSceneSelectValue) {
    status.textContent = "삭제할 기존 무대 조합을 선택하세요.";
    return;
  }

  const confirmed = window.confirm(`${characterSelect.value || "rine"} 캐릭터의 무대 조합 '${sceneId}'를 삭제할까요?`);

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  status.textContent = "무대 조합을 삭제하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-character-scene"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: characterSelect.value || "rine",
        sceneId,
      }),
    });
    const result = await readApiJson<SceneSaveResponse>(response);

    if (!response.ok || !result.ok) {
      status.textContent = result.message ?? `무대 조합 삭제 실패: ${result.error ?? response.status}`;
      return;
    }

    sceneSelect.value = newSceneSelectValue;
    await loadCharacterAssets(newSceneSelectValue);
    status.textContent = `${sceneId} 무대 조합을 삭제했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "무대 조합 삭제 요청에 실패했어요.";
  } finally {
    deleteButton.disabled = false;
    applySceneSelection();
  }
}

/**
 * Wires repeated editable layer controls.
 */
function wireEditableLayerControls() {
  propLayerSelect.addEventListener("change", () => {
    applyEditableLayerToInputs(getSelectedEditableLayer("prop"), "prop");
    renderOutputs();
  });
  effectLayerSelect.addEventListener("change", () => {
    applyEditableLayerToInputs(getSelectedEditableLayer("effect"), "effect");
    renderOutputs();
  });
  addPropLayerButton.addEventListener("click", () => addEditableLayer("prop"));
  addEffectLayerButton.addEventListener("click", () => addEditableLayer("effect"));
  removePropLayerButton.addEventListener("click", () => removeEditableLayer("prop"));
  removeEffectLayerButton.addEventListener("click", () => removeEditableLayer("effect"));
  [
    propAssetSelect,
    propDepthInput,
    ...Object.values(propPlacementInputs),
  ].forEach((input) => {
    input.addEventListener("input", () => {
      syncSelectedLayerFromInputs("prop");
      renderEditableLayerLists();
      renderOutputs();
    });
    input.addEventListener("change", () => {
      syncSelectedLayerFromInputs("prop");
      renderEditableLayerLists();
      renderOutputs();
    });
  });
  [
    effectAssetSelect,
    effectDepthInput,
    ...Object.values(effectPlacementInputs),
  ].forEach((input) => {
    input.addEventListener("input", () => {
      syncSelectedLayerFromInputs("effect");
      renderEditableLayerLists();
      renderOutputs();
    });
    input.addEventListener("change", () => {
      syncSelectedLayerFromInputs("effect");
      renderEditableLayerLists();
      renderOutputs();
    });
  });
}

/**
 * Wires the Scene settings page.
 */
function init() {
  setScenePreviewSize(Number(scenePreviewSizeInput.value) || scenePreviewSize);
  characterSelect.addEventListener("change", () => {
    void loadCharacterAssets();
  });
  scenePreviewSizeInput.addEventListener("input", () => {
    setScenePreviewSize(Number(scenePreviewSizeInput.value));
  });
  scenePreviewZoomOutButton.addEventListener("click", () => {
    setScenePreviewSize(scenePreviewSize - 120);
  });
  scenePreviewZoomInButton.addEventListener("click", () => {
    setScenePreviewSize(scenePreviewSize + 120);
  });
  sceneSelect.addEventListener("change", applySceneSelection);
  [
    sceneIdInput,
    defaultSceneInput,
    backgroundAssetSelect,
    backgroundColorInput,
    backgroundDepthInput,
    characterPreviewVisibleInput,
    characterPreviewImageSelect,
    characterDepthInput,
  ].forEach((input) => {
    input.addEventListener("input", renderOutputs);
    input.addEventListener("change", renderOutputs);
  });
  wireEditableLayerControls();
  saveButton.addEventListener("click", () => {
    void saveSceneConfig();
  });
  deleteButton.addEventListener("click", () => {
    void deleteSceneConfig();
  });
  sceneActionProxyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sceneActionProxy === "delete") {
        void deleteSceneConfig();
        return;
      }

      void saveSceneConfig();
    });
  });
  uploadSceneImagesButton.addEventListener("click", () => {
    void uploadSceneImages();
  });
  window.addEventListener("pointermove", handleSceneLayerDrag);
  window.addEventListener("pointerup", stopSceneLayerDrag);
  window.addEventListener("pointercancel", stopSceneLayerDrag);

  void loadCharacters();
}

init();
