import {
  enhanceStatusNotice,
  LabImage,
  loadRegionOverlayVisible,
  loadStoredRegion,
  PartRecipeId,
  readImageFile,
  recipes,
  requireElement,
  resolveAssetPath,
  saveRegionOverlayVisible,
  saveStoredRegion,
  TargetRegion,
} from "./assetShared.js";
import {
  createCharacterAssetBrowserBasePath,
  createSavedAssetPaths,
  isUploadImage,
  saveUploadedAssetFiles,
} from "./assetUpload.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { appendAssetOptionGroups, createAssetOptionLabel, filterAssetFiles } from "./assetSelect.js";
import { createDevtoolsApiPath } from "./assetApi.js";

type SaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  saved?: Array<{ fileName: string; path: string }> | {
    characterId: string;
    path: string;
    surfaceId: string;
    layerId: string;
  };
};
type DeleteResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  deleted?: CharacterLayerSaveTarget;
};
type CharacterLayerSaveTarget = {
  characterId: string;
  path: string;
  buildPath?: string | null;
  surfaceId: string;
  layerId: string;
};

type AssetFile = {
  fileName: string;
  kind: "base" | "part" | "scene" | "asset";
  path: string;
  scope?: "character" | "common";
  size?: number;
  updatedAt?: string;
};
type AssetFilesResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  files?: AssetFile[];
};
type LayerImage = LabImage & { assetPath?: string };
type AssetSaveKind = "base" | "parts";
type RegionDragMode = "move" | "resize-nw" | "resize-ne" | "resize-se" | "resize-sw";
type RegionDragState = {
  mode: RegionDragMode;
  startClientX: number;
  startClientY: number;
  stageRect: DOMRect;
  startRegion: TargetRegion;
};
type ExistingLayer = {
  surfaceId: string;
  layerId: string;
  depth?: number;
  surfaceImage?: string;
  image?: string;
  frames?: string[];
  intervalMs?: number;
  idleIntervalMs?: number;
  coversBase?: boolean;
  placement?: TargetRegion;
};
type ExistingSurface = {
  surfaceId: string;
  image?: string;
  expression?: string;
  alt?: string;
  layerCount: number;
};
type CharacterAssetsResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  assets?: {
    surfaces?: Record<string, {
      id?: string;
      image?: string;
      expression?: string;
      alt?: string;
      layers?: Record<string, {
        image?: string;
        frames?: string[];
        depth?: number;
        intervalMs?: number;
        idleIntervalMs?: number;
        coversBase?: boolean;
        placement?: TargetRegion;
      }>;
    }>;
  };
};

/**
 * Reads an API response and turns non-JSON server errors into a usable message.
 */
async function readApiJson<T extends { ok?: boolean; error?: string; message?: string }>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: `http_${response.status}`,
      message: `API가 JSON 대신 "${text.slice(0, 80)}" 응답을 보냈어요. 서버를 재시작했는지 확인하세요.`,
    } as T;
  }
}

let partImages: LayerImage[] = [];
let baseImage: LabImage | null = null;
let existingSurfaces: ExistingSurface[] = [];
let existingLayers: ExistingLayer[] = [];
let savedAssetFiles: AssetFile[] = [];
let storedLayerSettings: StoredLayerSettings | null = null;
let currentRegion = loadStoredRegion(recipes.eyeBlink.defaultTargetRegion);
let selectedFrameIndex = 0;
let isPreviewingBaseFrame = false;
let playTimerId: number | null = null;
let regionDragState: RegionDragState | null = null;
const layerSettingsStorageKey = "ghost-nest.asset-layer.settings.v1";
const newLayerSelectValue = "__new__";
const newSurfaceSelectValue = "__new_surface__";
const fallbackLayerDepths: Record<string, number> = {
  base: 0,
  ears: 10,
  eyes: 20,
  mouth: 30,
  accessory: 40,
};

const characterIdInput = requireElement(document.querySelector<HTMLInputElement>("#characterIdInput"), "#characterIdInput");
const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const surfaceSelect = requireElement(document.querySelector<HTMLSelectElement>("#surfaceSelect"), "#surfaceSelect");
const recipeSelect = requireElement(document.querySelector<HTMLSelectElement>("#partRecipeSelect"), "#partRecipeSelect");
const existingLayerSelect = requireElement(document.querySelector<HTMLSelectElement>("#existingLayerSelect"), "#existingLayerSelect");
const surfaceSelectField = requireElement(document.querySelector<HTMLElement>("#surfaceSelectField"), "#surfaceSelectField");
const layerSelectField = requireElement(document.querySelector<HTMLElement>("#layerSelectField"), "#layerSelectField");
const partRecipeField = requireElement(document.querySelector<HTMLElement>("#partRecipeField"), "#partRecipeField");
const surfaceIdField = requireElement(document.querySelector<HTMLElement>("#surfaceIdField"), "#surfaceIdField");
const layerConfigFields = requireElement(document.querySelector<HTMLElement>("#layerConfigFields"), "#layerConfigFields");
const coversBaseField = requireElement(document.querySelector<HTMLElement>("#coversBaseField"), "#coversBaseField");
const layerStorageSection = requireElement(document.querySelector<HTMLElement>("#layerStorageSection"), "#layerStorageSection");
const layerPreviewSection = requireElement(document.querySelector<HTMLElement>("#layerPreviewSection"), "#layerPreviewSection");
const layerEditSection = requireElement(document.querySelector<HTMLElement>("#layerEditSection"), "#layerEditSection");
const layerControlSection = requireElement(document.querySelector<HTMLElement>("#layerControlSection"), "#layerControlSection");
const layerOutputSection = requireElement(document.querySelector<HTMLElement>("#layerOutputSection"), "#layerOutputSection");
const assetSaveKindSelect = requireElement(document.querySelector<HTMLSelectElement>("#assetSaveKindSelect"), "#assetSaveKindSelect");
const basePathInput = requireElement(document.querySelector<HTMLInputElement>("#basePathInput"), "#basePathInput");
const saveDirectoryInput = requireElement(document.querySelector<HTMLInputElement>("#saveDirectoryInput"), "#saveDirectoryInput");
const surfaceIdInput = requireElement(document.querySelector<HTMLInputElement>("#surfaceIdInput"), "#surfaceIdInput");
const layerIdSelect = requireElement(document.querySelector<HTMLSelectElement>("#layerIdSelect"), "#layerIdSelect");
const customLayerIdField = requireElement(document.querySelector<HTMLElement>("#customLayerIdField"), "#customLayerIdField");
const customLayerIdInput = requireElement(document.querySelector<HTMLInputElement>("#customLayerIdInput"), "#customLayerIdInput");
const intervalInput = requireElement(document.querySelector<HTMLInputElement>("#intervalInput"), "#intervalInput");
const idleIntervalInput = requireElement(document.querySelector<HTMLInputElement>("#idleIntervalInput"), "#idleIntervalInput");
const coversBaseInput = requireElement(document.querySelector<HTMLInputElement>("#coversBaseInput"), "#coversBaseInput");
const baseImageInput = requireElement(document.querySelector<HTMLInputElement>("#baseImageInput"), "#baseImageInput");
const baseAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#baseAssetSelect"), "#baseAssetSelect");
const partImagesInput = requireElement(document.querySelector<HTMLInputElement>("#partImagesInput"), "#partImagesInput");
const partAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#partAssetSelect"), "#partAssetSelect");
const uploadBaseAssetButton = requireElement(document.querySelector<HTMLButtonElement>("#uploadBaseAssetButton"), "#uploadBaseAssetButton");
const uploadPartAssetsButton = requireElement(document.querySelector<HTMLButtonElement>("#uploadPartAssetsButton"), "#uploadPartAssetsButton");
const addPartAssetFramesButton = requireElement(document.querySelector<HTMLButtonElement>("#addPartAssetFramesButton"), "#addPartAssetFramesButton");
const frameListSelect = requireElement(document.querySelector<HTMLSelectElement>("#frameListSelect"), "#frameListSelect");
const moveFrameUpButton = requireElement(document.querySelector<HTMLButtonElement>("#moveFrameUpButton"), "#moveFrameUpButton");
const moveFrameDownButton = requireElement(document.querySelector<HTMLButtonElement>("#moveFrameDownButton"), "#moveFrameDownButton");
const removeFrameButton = requireElement(document.querySelector<HTMLButtonElement>("#removeFrameButton"), "#removeFrameButton");
const clearFramesButton = requireElement(document.querySelector<HTMLButtonElement>("#clearFramesButton"), "#clearFramesButton");
const layerPreview = requireElement(document.querySelector<HTMLElement>("#layerPreview"), "#layerPreview");
const layerSummary = requireElement(document.querySelector<HTMLElement>("#layerSummary"), "#layerSummary");
const layerOutput = requireElement(document.querySelector<HTMLElement>("#layerSnippetOutput"), "#layerSnippetOutput");
const manifestOutput = requireElement(document.querySelector<HTMLElement>("#manifestOutput"), "#manifestOutput");
const status = requireElement(document.querySelector<HTMLElement>("#layerStatus"), "#layerStatus");
const saveButton = requireElement(document.querySelector<HTMLButtonElement>("#saveLayerConfigButton"), "#saveLayerConfigButton");
const deleteButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteLayerConfigButton"), "#deleteLayerConfigButton");
const copyLayerButton = requireElement(document.querySelector<HTMLButtonElement>("#copyLayerButton"), "#copyLayerButton");
const copyManifestButton = requireElement(document.querySelector<HTMLButtonElement>("#copyManifestButton"), "#copyManifestButton");
const previousFrameButton = requireElement(document.querySelector<HTMLButtonElement>("#previousFrameButton"), "#previousFrameButton");
const playFramesButton = requireElement(document.querySelector<HTMLButtonElement>("#playFramesButton"), "#playFramesButton");
const nextFrameButton = requireElement(document.querySelector<HTMLButtonElement>("#nextFrameButton"), "#nextFrameButton");
const previewSizeInput = requireElement(document.querySelector<HTMLInputElement>("#previewSizeInput"), "#previewSizeInput");
const previewZoomOutButton = requireElement(document.querySelector<HTMLButtonElement>("#previewZoomOutButton"), "#previewZoomOutButton");
const previewZoomInButton = requireElement(document.querySelector<HTMLButtonElement>("#previewZoomInButton"), "#previewZoomInButton");
const regionOverlayVisibleInput = requireElement(document.querySelector<HTMLInputElement>("#regionOverlayVisibleInput"), "#regionOverlayVisibleInput");
const regionInputs = {
  x: requireElement(document.querySelector<HTMLInputElement>("#targetRegionXInput"), "#targetRegionXInput"),
  y: requireElement(document.querySelector<HTMLInputElement>("#targetRegionYInput"), "#targetRegionYInput"),
  width: requireElement(document.querySelector<HTMLInputElement>("#targetRegionWidthInput"), "#targetRegionWidthInput"),
  height: requireElement(document.querySelector<HTMLInputElement>("#targetRegionHeightInput"), "#targetRegionHeightInput"),
};

type StoredLayerSettings = {
  recipeId?: PartRecipeId;
  characterId?: string;
  surfaceId?: string;
  layerId?: string;
  customLayerId?: string;
  intervalMs?: number;
  idleIntervalMs?: number;
  coversBase?: boolean;
  assetSaveKind?: AssetSaveKind;
  basePath?: string;
  saveDirectory?: string;
  baseAssetPath?: string;
  partAssetPaths?: string[];
  previewSize?: number;
};

/**
 * Returns the active character id used for character asset paths.
 */
function getActiveCharacterId() {
  return characterSelect.value || characterIdInput.value.trim() || "rine";
}

/**
 * Builds the browser-facing asset path prefix for the selected character folder.
 */
async function createCharacterAssetBasePath(assetSaveKind: AssetSaveKind) {
  return createCharacterAssetBrowserBasePath(getActiveCharacterId(), assetSaveKind);
}

/**
 * Builds the project-relative save directory for the selected character folder.
 */
function createCharacterAssetSaveDirectory(assetSaveKind: AssetSaveKind) {
  return `src/characters/${getActiveCharacterId()}/assets/${assetSaveKind}`;
}

/**
 * Reads the current folder choice while keeping unknown values on the safer parts path.
 */
function getAssetSaveKind(): AssetSaveKind {
  if (assetSaveKindSelect.value === "base") {
    return assetSaveKindSelect.value;
  }

  return "parts";
}

/**
 * Infers the folder choice from restored path fields.
 */
function inferAssetSaveKind(settings: StoredLayerSettings | null): AssetSaveKind {
  const configuredPath = `${settings?.basePath ?? ""} ${settings?.saveDirectory ?? ""}`;

  return configuredPath.includes("/assets/base") || configuredPath.includes("\\assets\\base")
    ? "base"
    : "parts";
}

/**
 * Applies the selected character asset folder to both editable path fields.
 */
async function syncAssetSavePathsFromKind() {
  const assetSaveKind = getAssetSaveKind();

  basePathInput.value = await createCharacterAssetBasePath(assetSaveKind);
  saveDirectoryInput.value = createCharacterAssetSaveDirectory(assetSaveKind);
}

/**
 * Clamps the layer preview size so zoom controls cannot break the page layout.
 */
function clampPreviewSize(value: number) {
  return Math.min(1400, Math.max(480, value));
}

/**
 * Reads the current preview width used by the composite stage.
 */
function getPreviewSize() {
  return clampPreviewSize(Number(previewSizeInput.value) || 760);
}

/**
 * Applies a preview zoom size and refreshes the current stage.
 */
function setPreviewSize(size: number) {
  previewSizeInput.value = String(clampPreviewSize(size));
  updatePreviewSize();
  saveLayerSettings();
}

/**
 * Updates preview scale without rebuilding image nodes, avoiding layout flicker.
 */
function updatePreviewSize() {
  const stage = layerPreview.querySelector<HTMLElement>(".asset-composite-stage");

  if (!stage) {
    renderPreview();
    return;
  }

  stage.style.setProperty("--asset-composite-width", `${getPreviewSize()}px`);
}

/**
 * Reads and stores the placement region used by the generated layer snippet.
 */
function readRegion(): TargetRegion {
  currentRegion = {
    x: Number(regionInputs.x.value),
    y: Number(regionInputs.y.value),
    width: Number(regionInputs.width.value),
    height: Number(regionInputs.height.value),
    unit: "percent",
  };
  saveStoredRegion(currentRegion);

  return currentRegion;
}

/**
 * Saves the current layer form values so reopening the page restores the last setup.
 */
function saveLayerSettings() {
  const baseAssetPath = "assetPath" in (baseImage ?? {}) ? (baseImage as LayerImage).assetPath : undefined;
  const settings: StoredLayerSettings = {
    recipeId: recipeSelect.value as PartRecipeId,
    characterId: characterSelect.value || characterIdInput.value,
    surfaceId: surfaceIdInput.value,
    layerId: layerIdSelect.value,
    customLayerId: customLayerIdInput.value,
    intervalMs: Number(intervalInput.value),
    idleIntervalMs: Number(idleIntervalInput.value),
    coversBase: coversBaseInput.checked,
    assetSaveKind: getAssetSaveKind(),
    basePath: basePathInput.value,
    saveDirectory: saveDirectoryInput.value,
    partAssetPaths: partImages.map((image) => image.assetPath).filter((assetPath): assetPath is string => Boolean(assetPath)),
    previewSize: getPreviewSize(),
    ...(baseAssetPath ? { baseAssetPath } : {}),
  };

  window.localStorage.setItem(layerSettingsStorageKey, JSON.stringify(settings));
  storedLayerSettings = settings;
}

/**
 * Applies saved layer form values from localStorage when they exist.
 */
function loadLayerSettings() {
  try {
    const rawValue = window.localStorage.getItem(layerSettingsStorageKey);
    const settings = rawValue ? JSON.parse(rawValue) as StoredLayerSettings : null;
    storedLayerSettings = settings;

    if (!settings) {
      return;
    }

    if (settings.recipeId && recipes[settings.recipeId]) {
      recipeSelect.value = settings.recipeId;
    }

    surfaceIdInput.value = settings.surfaceId ?? surfaceIdInput.value;
    characterIdInput.value = settings.characterId ?? characterIdInput.value;
    characterSelect.value = settings.characterId ?? characterSelect.value;
    layerIdSelect.value = settings.layerId ?? layerIdSelect.value;
    customLayerIdInput.value = settings.customLayerId ?? customLayerIdInput.value;
    intervalInput.value = String(settings.intervalMs ?? Number(intervalInput.value) ?? 4200);
    idleIntervalInput.value = String(settings.idleIntervalMs ?? Number(idleIntervalInput.value) ?? 0);
    coversBaseInput.checked = settings.coversBase ?? coversBaseInput.checked;
    assetSaveKindSelect.value = settings.assetSaveKind ?? inferAssetSaveKind(settings);
    if (settings.basePath) {
      basePathInput.value = settings.basePath;
    } else {
      void syncAssetSavePathsFromKind();
    }
    saveDirectoryInput.value = settings.saveDirectory ?? createCharacterAssetSaveDirectory(getAssetSaveKind());
    previewSizeInput.value = String(clampPreviewSize(settings.previewSize ?? Number(previewSizeInput.value) ?? 760));
  } catch {
    // 저장된 개발도구 설정이 깨져도 페이지 사용은 계속 가능해야 합니다.
  }
}

/**
 * Refreshes settings that are shared across crop, comfy, and layer pages.
 */
function syncSharedRegionFromStorage() {
  const recipe = recipes[recipeSelect.value as PartRecipeId] ?? recipes.eyeBlink;

  currentRegion = loadStoredRegion(recipe.defaultTargetRegion);
  renderRegionControls();
  renderOutputs();
}

/**
 * Updates region controls from the shared region state.
 */
function renderRegionControls() {
  regionInputs.x.value = String(currentRegion.x);
  regionInputs.y.value = String(currentRegion.y);
  regionInputs.width.value = String(currentRegion.width);
  regionInputs.height.value = String(currentRegion.height);
}

/**
 * Keeps dragged region values inside the preview stage.
 */
function clampRegion(region: TargetRegion): TargetRegion {
  const width = Math.min(100, Math.max(1, region.width));
  const height = Math.min(100, Math.max(1, region.height));
  const x = Math.min(100 - width, Math.max(0, region.x));
  const y = Math.min(100 - height, Math.max(0, region.y));

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(width * 10) / 10,
    height: Math.round(height * 10) / 10,
    unit: "percent",
  };
}

/**
 * Applies a region change from pointer controls and refreshes linked outputs.
 */
function applyRegion(region: TargetRegion) {
  currentRegion = clampRegion(region);
  saveStoredRegion(currentRegion);
  renderRegionControls();
  renderOutputs();
}

/**
 * Resizes the region from the requested corner while preserving the opposite corner.
 */
function resizeRegionFromPointer(mode: RegionDragMode, startRegion: TargetRegion, deltaX: number, deltaY: number) {
  const left = startRegion.x;
  const top = startRegion.y;
  const right = startRegion.x + startRegion.width;
  const bottom = startRegion.y + startRegion.height;

  if (mode === "resize-nw") {
    return {
      x: left + deltaX,
      y: top + deltaY,
      width: right - (left + deltaX),
      height: bottom - (top + deltaY),
      unit: "percent",
    } satisfies TargetRegion;
  }

  if (mode === "resize-ne") {
    return {
      x: left,
      y: top + deltaY,
      width: right + deltaX - left,
      height: bottom - (top + deltaY),
      unit: "percent",
    } satisfies TargetRegion;
  }

  if (mode === "resize-sw") {
    return {
      x: left + deltaX,
      y: top,
      width: right - (left + deltaX),
      height: bottom + deltaY - top,
      unit: "percent",
    } satisfies TargetRegion;
  }

  return {
    x: left,
    y: top,
    width: right + deltaX - left,
    height: bottom + deltaY - top,
    unit: "percent",
  } satisfies TargetRegion;
}

/**
 * Starts moving or resizing the placement box in the preview.
 */
function startRegionDrag(event: PointerEvent, stage: HTMLElement, mode: RegionDragMode) {
  event.preventDefault();
  stopPlayback();
  regionDragState = {
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    stageRect: stage.getBoundingClientRect(),
    startRegion: { ...currentRegion },
  };
}

/**
 * Updates the placement box while the pointer is dragging.
 */
function handleRegionDragMove(event: PointerEvent) {
  if (!regionDragState) {
    return;
  }

  const deltaX = ((event.clientX - regionDragState.startClientX) / regionDragState.stageRect.width) * 100;
  const deltaY = ((event.clientY - regionDragState.startClientY) / regionDragState.stageRect.height) * 100;
  const nextRegion = regionDragState.mode === "move"
    ? {
        ...regionDragState.startRegion,
        x: regionDragState.startRegion.x + deltaX,
        y: regionDragState.startRegion.y + deltaY,
      }
    : resizeRegionFromPointer(regionDragState.mode, regionDragState.startRegion, deltaX, deltaY);

  applyRegion(nextRegion);
}

/**
 * Ends the active placement drag interaction.
 */
function stopRegionDrag() {
  regionDragState = null;
}

/**
 * Returns the default layer id for the currently selected part recipe.
 */
function getRecipeLayerId(recipeId: PartRecipeId) {
  return recipeId === "mouthShapes" ? "mouth" : recipeId === "eyeBlink" ? "eyes" : "accessory";
}

/**
 * Returns default timing values for the selected layer recipe.
 */
function getRecipeTimingDefaults(recipeId: PartRecipeId) {
  if (recipeId === "mouthShapes") {
    return { intervalMs: 140, idleIntervalMs: 0 };
  }

  if (recipeId === "eyeBlink") {
    return { intervalMs: 120, idleIntervalMs: 4200 };
  }

  return { intervalMs: 160, idleIntervalMs: 2500 };
}

/**
 * Applies default input values when a user starts a new layer.
 */
function applyNewLayerDefaults() {
  const recipe = recipes[recipeSelect.value as PartRecipeId] ?? recipes.eyeBlink;
  const timing = getRecipeTimingDefaults(recipe.id);

  currentRegion = recipe.defaultTargetRegion;
  surfaceIdInput.value = surfaceIdInput.value.trim() || "0";
  layerIdSelect.value = getRecipeLayerId(recipe.id);
  intervalInput.value = String(timing.intervalMs);
  idleIntervalInput.value = String(timing.idleIntervalMs);
  coversBaseInput.checked = true;
  selectedFrameIndex = 0;
  isPreviewingBaseFrame = false;
  renderRegionControls();
}

/**
 * Checks whether the user has chosen an existing layer or the new-layer flow.
 */
function hasLayerSelection() {
  return existingLayerSelect.value !== "";
}

/**
 * Checks whether the user has selected an existing surface or the new-surface flow.
 */
function hasSurfaceSelection() {
  return surfaceSelect.value !== "";
}

/**
 * Returns the saved Set that will receive the current layer.
 */
function getTargetSurface() {
  const surfaceId = surfaceSelect.value === newSurfaceSelectValue ? surfaceIdInput.value.trim() : surfaceSelect.value;

  return existingSurfaces.find((surface) => surface.surfaceId === surfaceId) ?? null;
}

/**
 * Ensures layers are only saved onto a Set that can be reached from an expression.
 */
function validateLayerSaveTarget() {
  if (!hasSurfaceSelection()) {
    return "파츠를 저장할 표시 상태를 먼저 선택하세요.";
  }

  if (surfaceSelect.value === newSurfaceSelectValue) {
    return "새 표시 상태에는 바로 파츠를 저장하지 말고, 상태 연결에서 표정과 기준 이미지를 먼저 저장하세요.";
  }

  const surface = getTargetSurface();

  if (!surface) {
    return "선택한 표시 상태 정보를 찾지 못했어요. 캐릭터를 다시 불러온 뒤 시도하세요.";
  }

  if (!surface.expression) {
    return "이 표시 상태에는 표정이 연결되어 있지 않아요. 상태 연결에서 표정을 먼저 저장하세요.";
  }

  if (!surface.image) {
    return "이 표시 상태에는 기본 이미지가 없어요. 상태 연결에서 기준 이미지를 먼저 저장하세요.";
  }

  return null;
}

/**
 * Shows layer detail controls only after the first selection step is complete.
 */
function renderLayerSelectionStep() {
  const hasCharacter = characterSelect.value !== "";
  const shouldShowSurface = hasCharacter;
  const shouldShowLayer = hasCharacter && hasSurfaceSelection();
  const shouldShowLayerDetails = hasSurfaceSelection() && hasLayerSelection();
  const shouldShowNewSurfaceInput = surfaceSelect.value === newSurfaceSelectValue;
  const shouldShowRecipe = existingLayerSelect.value === newLayerSelectValue;

  [
    layerConfigFields,
    coversBaseField,
    layerOutputSection,
  ].forEach((element) => {
    element.hidden = !shouldShowLayerDetails;
  });
  surfaceSelectField.hidden = !shouldShowSurface;
  layerSelectField.hidden = !shouldShowLayer;
  surfaceIdField.hidden = !shouldShowNewSurfaceInput;
  layerStorageSection.hidden = !shouldShowLayerDetails;
  layerEditSection.hidden = !shouldShowLayerDetails;
  layerControlSection.hidden = !shouldShowLayerDetails;
  layerPreviewSection.hidden = !shouldShowLayerDetails;
  partRecipeField.hidden = !shouldShowLayerDetails || !shouldShowRecipe;
  saveButton.disabled = !hasLayerSelection();
  deleteButton.disabled = !getSelectedExistingLayer();
}

/**
 * Builds asset paths from selected local part files.
 */
function getPartPaths() {
  const basePath = basePathInput.value.trim() || `./src/characters/${getActiveCharacterId()}/assets/${getAssetSaveKind()}/`;

  return partImages.map((image) => image.assetPath ?? resolveAssetPath(basePath, image.fileName));
}

/**
 * Converts an asset path from the character config into a preview image record.
 */
function createAssetPathImage(assetPath: string): LayerImage {
  return {
    fileName: assetPath.split("/").pop() ?? assetPath,
    previewUrl: assetPath,
    dataUrl: assetPath,
    assetPath,
  };
}

/**
 * Converts a saved project asset record into the image shape used by layer previews.
 */
function createSavedAssetImage(assetFile: AssetFile): LayerImage {
  return createAssetPathImage(assetFile.path);
}

/**
 * Keeps saved asset pickers in sync with the selected character.
 */
function renderSavedAssetOptions() {
  const baseAssets = filterAssetFiles(savedAssetFiles, ["base"], { includeCommon: false });
  const partAssets = filterAssetFiles(savedAssetFiles, ["part"]);

  baseAssetSelect.replaceChildren(new Option(baseAssets.length > 0 ? "기본 이미지 초기화" : "기본 이미지가 없어요.", ""));
  partAssetSelect.replaceChildren();

  if (partAssets.length === 0) {
    partAssetSelect.append(new Option("캐릭터 파츠와 공통 파츠 이미지가 없어요.", ""));
  } else {
    partAssetSelect.append(new Option("파츠 선택 없음", ""));
  }

  baseAssets.forEach((assetFile) => {
    baseAssetSelect.append(new Option(createAssetOptionLabel(assetFile), assetFile.path));
  });
  appendAssetOptionGroups(partAssetSelect, partAssets, {
    character: "캐릭터 파츠",
    common: "공통 파츠",
  });
}

/**
 * Syncs image preview state from the saved asset select controls.
 */
function syncSelectedAssetImagesFromControls() {
  const selectedBaseAsset = savedAssetFiles.find((assetFile) => assetFile.path === baseAssetSelect.value);
  const selectedPartAssets = Array.from(partAssetSelect.selectedOptions)
    .filter((option) => option.value !== "")
    .map((option) => savedAssetFiles.find((assetFile) => assetFile.path === option.value))
    .filter((assetFile): assetFile is AssetFile => Boolean(assetFile));

  if (selectedBaseAsset) {
    baseImage = createSavedAssetImage(selectedBaseAsset);
  } else if (baseAssetSelect.value === "" || !savedAssetFiles.some((assetFile) => assetFile.path === baseAssetSelect.value)) {
    baseImage = null;
  }

  if (selectedPartAssets.length > 0) {
    partImages = selectedPartAssets.map(createSavedAssetImage);
    selectedFrameIndex = 0;
    isPreviewingBaseFrame = false;
  } else if (Array.from(partAssetSelect.selectedOptions).every((option) => option.value === "")) {
    partImages = [];
    selectedFrameIndex = 0;
    isPreviewingBaseFrame = false;
  }
}

/**
 * Clears character-scoped preview state before loading another character.
 */
function resetCharacterPreviewState() {
  stopPlayback();
  baseImage = null;
  partImages = [];
  selectedFrameIndex = 0;
  isPreviewingBaseFrame = false;
  baseImageInput.value = "";
  partImagesInput.value = "";
}

/**
 * Refreshes the editable frame list and its ordering controls.
 */
function renderFrameList() {
  frameListSelect.replaceChildren();
  partImages.forEach((image, index) => {
    const option = new Option(`${index + 1}. ${image.fileName}`, String(index));

    option.selected = index === selectedFrameIndex && !isPreviewingBaseFrame;
    frameListSelect.append(option);
  });

  const hasSelectedFrame = partImages.length > 0 && selectedFrameIndex >= 0 && selectedFrameIndex < partImages.length;

  moveFrameUpButton.disabled = !hasSelectedFrame || selectedFrameIndex === 0;
  moveFrameDownButton.disabled = !hasSelectedFrame || selectedFrameIndex >= partImages.length - 1;
  removeFrameButton.disabled = !hasSelectedFrame;
  clearFramesButton.disabled = partImages.length === 0;
}

/**
 * Appends frames while preserving the existing frame order.
 */
function appendPartFrames(images: LayerImage[]) {
  if (images.length === 0) {
    return;
  }

  partImages = [...partImages, ...images];
  selectedFrameIndex = Math.max(0, partImages.length - images.length);
  isPreviewingBaseFrame = false;
}

/**
 * Adds the selected saved part assets to the frame list.
 */
function appendSelectedPartAssetFrames() {
  if (Array.from(partAssetSelect.selectedOptions).some((option) => option.value === "")) {
    return;
  }

  const selectedPartAssets = Array.from(partAssetSelect.selectedOptions)
    .map((option) => savedAssetFiles.find((assetFile) => assetFile.path === option.value))
    .filter((assetFile): assetFile is AssetFile => Boolean(assetFile));

  appendPartFrames(selectedPartAssets.map(createSavedAssetImage));
  renderOutputs();
}

/**
 * Saves browser-selected images into the character asset folders.
 */
async function uploadAssetImages(assetKind: AssetSaveKind, images: LayerImage[]) {
  if (images.length === 0) {
    status.textContent = assetKind === "base"
      ? "기본 이미지로 저장할 이미지를 먼저 선택하세요."
      : "파츠 이미지로 저장할 이미지를 먼저 선택하세요.";
    return;
  }

  const targetButton = assetKind === "base" ? uploadBaseAssetButton : uploadPartAssetsButton;

  targetButton.disabled = true;
  status.textContent = `${assetKind === "base" ? "기본 이미지" : "파츠 이미지"} 폴더에 이미지 ${images.length}개를 저장하는 중이에요.`;

  try {
    const savedFiles = await saveUploadedAssetFiles(createCharacterAssetSaveDirectory(assetKind), images);

    await loadSavedAssetFiles();

    const savedPaths = createSavedAssetPaths(savedFiles);

    if (assetKind === "base") {
      baseAssetSelect.value = savedPaths[0] ?? "";
      applySavedBaseAsset();
    } else {
      Array.from(partAssetSelect.options).forEach((option) => {
        option.selected = savedPaths.includes(option.value);
      });
      applySavedPartAssets();
    }

    status.textContent = `${assetKind} 폴더에 이미지 ${savedFiles.length}개를 저장했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "이미지 저장 요청에 실패했어요.";
  } finally {
    targetButton.disabled = false;
  }
}

/**
 * Selects a frame from the editable frame list.
 */
function selectFrameFromList() {
  selectedFrameIndex = Number(frameListSelect.value) || 0;
  isPreviewingBaseFrame = false;
  renderOutputs();
}

/**
 * Moves the currently selected saved frame up or down.
 */
function moveSelectedFrame(offset: number) {
  const nextIndex = selectedFrameIndex + offset;

  if (nextIndex < 0 || nextIndex >= partImages.length) {
    return;
  }

  const nextImages = [...partImages];
  const currentImage = nextImages[selectedFrameIndex];
  const targetImage = nextImages[nextIndex];

  if (!currentImage || !targetImage) {
    return;
  }

  nextImages[selectedFrameIndex] = targetImage;
  nextImages[nextIndex] = currentImage;
  partImages = nextImages;
  selectedFrameIndex = nextIndex;
  isPreviewingBaseFrame = false;
  renderOutputs();
}

/**
 * Removes the selected frame from the editable frame list.
 */
function removeSelectedFrame() {
  if (partImages.length === 0) {
    return;
  }

  partImages = partImages.filter((_, index) => index !== selectedFrameIndex);
  selectedFrameIndex = Math.min(selectedFrameIndex, Math.max(0, partImages.length - 1));
  isPreviewingBaseFrame = false;
  renderOutputs();
}

/**
 * Clears all editable layer frames.
 */
function clearFrames() {
  partImages = [];
  selectedFrameIndex = 0;
  isPreviewingBaseFrame = false;
  renderOutputs();
}

/**
 * Loads image files already saved under the selected character asset directory.
 */
async function loadSavedAssetFiles() {
  const characterId = characterSelect.value || characterIdInput.value.trim() || "rine";

  baseAssetSelect.replaceChildren(new Option("저장된 에셋을 불러오는 중이에요.", ""));
  partAssetSelect.replaceChildren(new Option("저장된 에셋을 불러오는 중이에요.", ""));

  try {
    const response = await fetch(createDevtoolsApiPath(`/api/devtools/asset-files?characterId=${encodeURIComponent(characterId)}`));
    const result = await readApiJson<AssetFilesResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "저장된 에셋 목록을 불러오지 못했어요.");
    }

    savedAssetFiles = result.files ?? [];
    renderSavedAssetOptions();
  } catch (error) {
    savedAssetFiles = [];
    baseAssetSelect.replaceChildren(new Option("저장된 에셋을 불러오지 못했어요.", ""));
    partAssetSelect.replaceChildren(new Option("저장된 에셋을 불러오지 못했어요.", ""));
    status.textContent = error instanceof Error ? error.message : "저장된 에셋 목록을 불러오지 못했어요.";
  }
}

/**
 * Applies one saved project image as the base preview image.
 */
function applySavedBaseAsset() {
  if (baseAssetSelect.value === "") {
    baseImage = null;
    renderOutputs();
    return;
  }

  syncSelectedAssetImagesFromControls();
  renderOutputs();
}

/**
 * Applies selected saved project images as layer frames.
 */
function applySavedPartAssets() {
  if (Array.from(partAssetSelect.selectedOptions).some((option) => option.value === "")) {
    Array.from(partAssetSelect.options).forEach((option) => {
      option.selected = false;
    });
    return;
  }
}

/**
 * Restores saved base and part image selections after the asset list is loaded.
 */
function restoreSavedAssetSelection() {
  const baseAssetPath = storedLayerSettings?.baseAssetPath;
  const partAssetPaths = storedLayerSettings?.partAssetPaths ?? [];

  if (baseAssetPath) {
    const baseAssetFile = savedAssetFiles.find((assetFile) =>
      assetFile.path === baseAssetPath && assetFile.kind === "base",
    );

    if (baseAssetFile) {
      baseAssetSelect.value = baseAssetFile.path;
    }
  }

  if (partAssetPaths.length > 0) {
    Array.from(partAssetSelect.options).forEach((option) => {
      const assetFile = savedAssetFiles.find((candidate) => candidate.path === option.value);

      option.selected = Boolean(assetFile && partAssetPaths.includes(assetFile.path));
    });
  }

  syncSelectedAssetImagesFromControls();
}

/**
 * Reopens the surface and layer that were active before a reload.
 */
function restoreLayerSelection() {
  const preferredSurfaceId = storedLayerSettings?.surfaceId || surfaceIdInput.value.trim();

  if (!preferredSurfaceId) {
    return;
  }

  const matchingSurface = existingSurfaces.find((surface) => surface.surfaceId === preferredSurfaceId);

  if (matchingSurface) {
    surfaceSelect.value = matchingSurface.surfaceId;
    surfaceIdInput.value = matchingSurface.surfaceId;
    baseImage = matchingSurface.image ? createAssetPathImage(matchingSurface.image) : null;
  } else if (surfaceSelect.value !== newSurfaceSelectValue) {
    surfaceSelect.value = newSurfaceSelectValue;
    surfaceIdInput.value = preferredSurfaceId;
    baseImage = null;
  }

  renderLayerOptionsForSurface();

  const preferredLayerId = storedLayerSettings?.layerId === "etc"
    ? storedLayerSettings.customLayerId
    : storedLayerSettings?.layerId;
  const matchingLayerIndex = existingLayers.findIndex((layer) =>
    layer.surfaceId === surfaceIdInput.value && layer.layerId === preferredLayerId,
  );

  if (matchingLayerIndex >= 0) {
    existingLayerSelect.value = String(matchingLayerIndex);
    applyExistingLayer();
    return;
  }

  if (preferredLayerId) {
    existingLayerSelect.value = newLayerSelectValue;
  }
}

/**
 * Resolves the visual depth used by the renderer when an explicit depth is absent.
 */
function getLayerDepth(layer: Pick<ExistingLayer, "depth" | "layerId">) {
  return layer.depth ?? fallbackLayerDepths[layer.layerId] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Keeps loaded layers aligned with surface id and render depth order.
 */
function sortExistingLayers(layers: ExistingLayer[]) {
  return [...layers].sort((left, right) => {
    const surfaceOrder = left.surfaceId.localeCompare(right.surfaceId, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (surfaceOrder !== 0) {
      return surfaceOrder;
    }

    const depthOrder = getLayerDepth(left) - getLayerDepth(right);

    if (depthOrder !== 0) {
      return depthOrder;
    }

    return left.layerId.localeCompare(right.layerId, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/**
 * Keeps surfaces in numeric id order where possible.
 */
function sortExistingSurfaces(surfaces: ExistingSurface[]) {
  return [...surfaces].sort((left, right) =>
    left.surfaceId.localeCompare(right.surfaceId, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

/**
 * Rebuilds the layer select for the currently selected surface.
 */
function renderLayerOptionsForSurface() {
  if (!hasSurfaceSelection()) {
    existingLayerSelect.replaceChildren(new Option("캐릭터 상태를 먼저 선택하세요.", ""));
    return;
  }

  const surfaceId = surfaceSelect.value === newSurfaceSelectValue ? surfaceIdInput.value.trim() : surfaceSelect.value;
  const surfaceLayers = existingLayers.filter((layer) => layer.surfaceId === surfaceId);

  existingLayerSelect.replaceChildren(
    new Option("파츠 선택", ""),
    new Option("새 파츠 만들기", newLayerSelectValue),
  );
  surfaceLayers.forEach((layer) => {
    const layerIndex = existingLayers.indexOf(layer);
    const frameCount = layer.frames?.length ?? (layer.image ? 1 : 0);

    existingLayerSelect.append(new Option(`${layer.layerId} / 깊이 ${getLayerDepth(layer)} / ${frameCount}개 프레임`, String(layerIndex)));
  });

  if (surfaceLayers.length === 0) {
    existingLayerSelect.value = newLayerSelectValue;
    applyNewLayerDefaults();
  }
}

/**
 * Reads the selected character definition and prepares surface choices.
 */
async function loadCharacterAssets() {
  const characterId = characterSelect.value || characterIdInput.value.trim() || "rine";

  characterIdInput.value = characterId;
  resetCharacterPreviewState();
  surfaceSelect.replaceChildren(new Option("캐릭터 상태를 불러오는 중이에요.", ""));
  existingLayerSelect.replaceChildren(new Option("캐릭터 상태를 먼저 선택하세요.", ""));
  existingSurfaces = [];
  existingLayers = [];
  renderOutputs();

  try {
    const response = await fetch(createDevtoolsApiPath(`/api/devtools/character-assets?characterId=${encodeURIComponent(characterId)}`));
    const result = await readApiJson<CharacterAssetsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "캐릭터 레이어 정보를 불러오지 못했어요.");
    }

    const surfaces = result.assets?.surfaces ?? {};

    existingSurfaces = sortExistingSurfaces(Object.entries(surfaces).map(([surfaceId, surface]) => {
      const existingSurface: ExistingSurface = {
        surfaceId: surface.id ?? surfaceId,
        layerCount: Object.keys(surface.layers ?? {}).length,
      };

      if (surface.image) {
        existingSurface.image = surface.image;
      }

      if (surface.expression) {
        existingSurface.expression = surface.expression;
      }

      if (surface.alt) {
        existingSurface.alt = surface.alt;
      }

      return existingSurface;
    }));
    existingLayers = sortExistingLayers(Object.entries(surfaces).flatMap(([surfaceId, surface]) =>
      Object.entries(surface.layers ?? {}).map(([layerId, layer]) => {
        const existingLayer: ExistingLayer = { surfaceId: surface.id ?? surfaceId, layerId };

        if (surface.image) {
          existingLayer.surfaceImage = surface.image;
        }

        if (layer.image) {
          existingLayer.image = layer.image;
        }

        if (layer.frames) {
          existingLayer.frames = layer.frames;
        }

        if (layer.depth !== undefined) {
          existingLayer.depth = layer.depth;
        }

        if (layer.intervalMs !== undefined) {
          existingLayer.intervalMs = layer.intervalMs;
        }

        if (layer.idleIntervalMs !== undefined) {
          existingLayer.idleIntervalMs = layer.idleIntervalMs;
        }

        if (layer.coversBase !== undefined) {
          existingLayer.coversBase = layer.coversBase;
        }

        if (layer.placement) {
          existingLayer.placement = layer.placement;
        }

        return existingLayer;
      }),
    ));

    surfaceSelect.replaceChildren(
      new Option("표시 상태 선택", ""),
      new Option("새 상태 연결 만들기", newSurfaceSelectValue),
    );
    existingSurfaces.forEach((surface) => {
      const labelParts = [
        surface.surfaceId,
        surface.expression ? `표정 ${surface.expression}` : "",
        `${surface.layerCount}개 파츠`,
      ].filter(Boolean);

      surfaceSelect.append(new Option(labelParts.join(" / "), surface.surfaceId));
    });

    if (existingSurfaces.length === 0) {
      surfaceSelect.value = newSurfaceSelectValue;
      surfaceIdInput.value = surfaceIdInput.value.trim() || "0";
      renderLayerOptionsForSurface();
    }

    await loadSavedAssetFiles();
    restoreSavedAssetSelection();
    restoreLayerSelection();
    renderOutputs();
    status.textContent = `${characterId} 캐릭터를 불러왔어요. 파츠를 붙일 표시 상태를 선택하세요.`;
  } catch (error) {
    surfaceSelect.replaceChildren(
      new Option("표시 상태를 불러오지 못했어요.", ""),
      new Option("새 상태 연결 만들기", newSurfaceSelectValue),
    );
    existingLayerSelect.replaceChildren(new Option("표시 상태를 먼저 선택하세요.", ""));
    renderOutputs();
    status.textContent = error instanceof Error ? error.message : "캐릭터 레이어 정보를 불러오지 못했어요.";
  }
}

/**
 * Loads available character ids from the dev server.
 */
async function loadCharacters() {
  const preferredCharacterId = characterIdInput.value.trim() || "rine";

  try {
    const selectedCharacterId = await populateCharacterSelect(characterSelect, {
      emptyLabel: "캐릭터 선택",
      preferredCharacterId,
    });

    if (selectedCharacterId) {
      if (!storedLayerSettings?.basePath && !storedLayerSettings?.saveDirectory) {
        void syncAssetSavePathsFromKind();
      }
      await loadCharacterAssets();
      return;
    }

    renderOutputs();
    status.textContent = "불러올 캐릭터가 없어요. 먼저 캐릭터 빌드 결과를 확인하세요.";
  } catch (error) {
    characterSelect.replaceChildren(new Option("캐릭터를 불러오지 못했어요.", ""));
    renderOutputs();
    status.textContent = error instanceof Error ? error.message : "캐릭터 목록을 불러오지 못했어요.";
  }
}

/**
 * Returns the existing layer currently selected in the layer picker.
 */
function getSelectedExistingLayer() {
  const selectedIndex = Number(existingLayerSelect.value);

  return Number.isInteger(selectedIndex) ? existingLayers[selectedIndex] ?? null : null;
}

/**
 * Applies a selected existing layer to the editor controls and preview state.
 */
function applyExistingLayer() {
  const existingLayer = getSelectedExistingLayer();

  if (!existingLayer) {
    return;
  }

  surfaceIdInput.value = existingLayer.surfaceId;

  if (["eyes", "mouth", "ears", "accessory"].includes(existingLayer.layerId)) {
    layerIdSelect.value = existingLayer.layerId;
  } else {
    layerIdSelect.value = "etc";
    customLayerIdInput.value = existingLayer.layerId;
  }

  intervalInput.value = String(existingLayer.intervalMs ?? Number(intervalInput.value) ?? 140);
  idleIntervalInput.value = String(existingLayer.idleIntervalMs ?? Number(idleIntervalInput.value) ?? 0);
  coversBaseInput.checked = existingLayer.coversBase ?? false;

  if (existingLayer.placement) {
    currentRegion = { ...existingLayer.placement, unit: "percent" };
    saveStoredRegion(currentRegion);
    renderRegionControls();
  }

  baseImage = existingLayer.surfaceImage ? createAssetPathImage(existingLayer.surfaceImage) : baseImage;
  partImages = [
    ...(existingLayer.frames ?? []),
    ...(existingLayer.image ? [existingLayer.image] : []),
  ].map(createAssetPathImage);
  selectedFrameIndex = 0;
  isPreviewingBaseFrame = false;
  renderOutputs();
}

/**
 * Applies the selected surface and prepares its layer list.
 */
function handleSurfaceSelectionChange() {
  stopPlayback();
  existingLayerSelect.value = "";
  partImages = [];
  selectedFrameIndex = 0;
  isPreviewingBaseFrame = false;

  if (!hasSurfaceSelection()) {
    baseImage = null;
    existingLayerSelect.replaceChildren(new Option("표시 상태를 먼저 선택하세요.", ""));
    renderOutputs();
    return;
  }

  if (surfaceSelect.value === newSurfaceSelectValue) {
    surfaceIdInput.value = surfaceIdInput.value.trim() || "0";
    baseImage = null;
    renderLayerOptionsForSurface();
    renderOutputs();
    status.textContent = "새 표시 상태에 추가할 파츠를 설정하세요.";
    return;
  }

  const surface = existingSurfaces.find((item) => item.surfaceId === surfaceSelect.value);

  surfaceIdInput.value = surfaceSelect.value;
  baseImage = surface?.image ? createAssetPathImage(surface.image) : null;
  renderLayerOptionsForSurface();
  renderOutputs();
  status.textContent = `${surfaceSelect.value} 표시 상태의 파츠를 선택하세요.`;
}

/**
 * Starts a blank layer flow after the user chooses to create one.
 */
function startNewLayer() {
  applyNewLayerDefaults();
  renderOutputs();
  status.textContent = "새 파츠 설정을 만들 준비가 됐어요.";
}

/**
 * Routes the first selection step to either editing an existing layer or creating a new one.
 */
function handleLayerSelectionChange() {
  stopPlayback();

  if (existingLayerSelect.value === newLayerSelectValue) {
    startNewLayer();
    return;
  }

  if (!hasLayerSelection()) {
    renderOutputs();
    return;
  }

  applyExistingLayer();
}

/**
 * Returns the selected layer id, including a custom typed value.
 */
function getLayerId() {
  if (layerIdSelect.value !== "etc") {
    return layerIdSelect.value;
  }

  return customLayerIdInput.value.trim() || "etc";
}

/**
 * Creates a depth patch for known layer ids.
 */
function createLayerDepthPatch(layerId: string) {
  const depth = fallbackLayerDepths[layerId];

  return depth === undefined ? {} : { depth };
}

/**
 * Creates a layer snippet that can be copied into assets.surfaces[surfaceId].layers.
 */
function createLayerSnippet() {
  const partPaths = getPartPaths();
  const layerId = getLayerId();
  const idleIntervalMs = Number(idleIntervalInput.value) || 0;
  const shouldSaveIdleInterval = layerId !== "mouth" && idleIntervalMs > 0;

  return {
    surfaceId: surfaceIdInput.value.trim() || "0",
    layerId,
    layer: {
      frames: partPaths,
      ...createLayerDepthPatch(layerId),
      intervalMs: Number(intervalInput.value) || 140,
      ...(shouldSaveIdleInterval ? { idleIntervalMs } : {}),
      coversBase: coversBaseInput.checked,
      placement: readRegion(),
    },
  };
}

/**
 * Creates a manifest patch preview for the selected surface and layer.
 */
function createManifestSnippet() {
  const layerSnippet = createLayerSnippet();

  return {
    surfaces: {
      [layerSnippet.surfaceId]: {
        layers: {
          [layerSnippet.layerId]: layerSnippet.layer,
        },
      },
    },
  };
}

/**
 * Normalizes the save response into a concrete character source target.
 */
function resolveSaveTarget(saved: SaveResponse["saved"], layerSnippet: ReturnType<typeof createLayerSnippet>): CharacterLayerSaveTarget {
  if (saved && !Array.isArray(saved)) {
    return saved;
  }

  const characterId = characterSelect.value || characterIdInput.value.trim() || "rine";

  return {
    characterId,
    path: `src/characters/${characterId}/index.ts`,
    buildPath: null,
    surfaceId: layerSnippet.surfaceId,
    layerId: layerSnippet.layerId,
  };
}

/**
 * Shows the exact source path and layer object that were saved.
 */
function renderSaveResult(saveTarget: CharacterLayerSaveTarget, layerSnippet: ReturnType<typeof createLayerSnippet>) {
  const layerPath = `assets.surfaces[${JSON.stringify(saveTarget.surfaceId)}].layers[${JSON.stringify(saveTarget.layerId)}]`;

  status.textContent = `${saveTarget.path} 저장 완료 · ${layerPath}`;
  manifestOutput.textContent = JSON.stringify({
    savedTo: saveTarget.path,
    refreshSource: saveTarget.buildPath ?? "dist build file was not found",
    characterId: saveTarget.characterId,
    layerPath,
    surfaceId: saveTarget.surfaceId,
    layerId: saveTarget.layerId,
  }, null, 2);
  layerOutput.textContent = JSON.stringify(layerSnippet, null, 2);
}

/**
 * Shows the exact source path and layer key that were deleted.
 */
function renderDeleteResult(deleteTarget: CharacterLayerSaveTarget) {
  const layerPath = `assets.surfaces[${JSON.stringify(deleteTarget.surfaceId)}].layers[${JSON.stringify(deleteTarget.layerId)}]`;

  status.textContent = `${deleteTarget.path} 삭제 완료 · ${layerPath}`;
  layerOutputSection.hidden = false;
  manifestOutput.textContent = JSON.stringify({
    deletedFrom: deleteTarget.path,
    refreshSource: deleteTarget.buildPath ?? "dist build file was not found",
    characterId: deleteTarget.characterId,
    layerPath,
    surfaceId: deleteTarget.surfaceId,
    layerId: deleteTarget.layerId,
  }, null, 2);
  layerOutput.textContent = "선택한 파츠 설정이 캐릭터 index.ts에서 삭제됐어요.";
}

/**
 * Shows the custom layer input only when direct entry is selected.
 */
function renderCustomLayerField() {
  const isCustomLayer = layerIdSelect.value === "etc";

  customLayerIdField.hidden = !isCustomLayer;
  customLayerIdField.style.display = isCustomLayer ? "grid" : "none";
}

/**
 * Renders a concise readable summary of the active layer settings.
 */
function renderSummary() {
  const snippet = createLayerSnippet();
  const currentFrame = isPreviewingBaseFrame
    ? baseImage?.fileName ?? "base"
    : partImages[selectedFrameIndex]?.fileName ?? "선택 없음";
  const rows: Array<[string, string, string]> = [
    ["surface", "캐릭터 상태", snippet.surfaceId],
    ["layer", "파츠", snippet.layerId],
    ["frameCount", "프레임 수", `${partImages.length}개`],
    ["currentFrame", "현재 프레임", currentFrame],
    ["depth", "겹침 순서", String(snippet.layer.depth ?? getLayerDepth({ layerId: snippet.layerId }))],
    ["interval", "프레임 전환 간격", `${snippet.layer.intervalMs}ms`],
    ["idleInterval", "자동 반복 간격", `${snippet.layer.idleIntervalMs ?? 0}ms`],
    ["coversBase", "기본 이미지 덮기", snippet.layer.coversBase ? "예" : "아니오"],
    ["placement", "위치 / 크기", `x ${currentRegion.x}%, y ${currentRegion.y}%, w ${currentRegion.width}%, h ${currentRegion.height}%`],
  ];

  layerSummary.replaceChildren();
  rows.forEach(([key, label, value]) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    item.className = "asset-layer-summary-item";
    term.textContent = label;
    description.textContent = value;
    description.dataset.summaryKey = key;
    item.append(term, description);
    layerSummary.append(item);
  });
}

/**
 * Updates only the summary row that changes during frame playback.
 */
function renderCurrentFrameSummary() {
  const frameDescription = layerSummary.querySelector<HTMLElement>("[data-summary-key='currentFrame']");

  if (!frameDescription) {
    renderSummary();
    return;
  }

  frameDescription.textContent = isPreviewingBaseFrame
    ? baseImage?.fileName ?? "base"
    : partImages[selectedFrameIndex]?.fileName ?? "선택 없음";
}

/**
 * Allows one overlay to preview as base -> overlay without changing saved frames.
 */
function canPreviewBaseFrame() {
  return Boolean(baseImage && partImages.length > 0);
}

/**
 * Counts frames available to the preview controls.
 */
function getPreviewFrameCount() {
  return partImages.length + (canPreviewBaseFrame() ? 1 : 0);
}

/**
 * Converts the current visible preview frame to a control slot.
 */
function getPreviewSlotIndex() {
  if (!canPreviewBaseFrame()) {
    return selectedFrameIndex;
  }

  return isPreviewingBaseFrame ? 0 : selectedFrameIndex + 1;
}

/**
 * Applies a control slot back to preview state.
 */
function setPreviewSlotIndex(slotIndex: number) {
  const frameCount = getPreviewFrameCount();
  const nextSlotIndex = (slotIndex + frameCount) % frameCount;

  if (canPreviewBaseFrame() && nextSlotIndex === 0) {
    isPreviewingBaseFrame = true;
    return;
  }

  isPreviewingBaseFrame = false;
  selectedFrameIndex = canPreviewBaseFrame() ? nextSlotIndex - 1 : nextSlotIndex;
}

/**
 * Stops active preview playback and restores the button state.
 */
function stopPlayback() {
  if (playTimerId === null) {
    return;
  }

  window.clearInterval(playTimerId);
  playTimerId = null;
  playFramesButton.textContent = "재생";
}

/**
 * Keeps playback controls in sync without rebuilding the preview DOM.
 */
function syncPlaybackControls() {
  const previewFrameCount = getPreviewFrameCount();

  previousFrameButton.disabled = previewFrameCount <= 1;
  nextFrameButton.disabled = previewFrameCount <= 1;
  playFramesButton.disabled = previewFrameCount <= 1;

  if (previewFrameCount <= 1) {
    stopPlayback();
  }
}

/**
 * Updates the existing overlay image for frame playback.
 */
function updatePreviewFrame() {
  const selectedPart = isPreviewingBaseFrame ? null : partImages[selectedFrameIndex] ?? null;
  const overlay = layerPreview.querySelector<HTMLImageElement>(".asset-composite-overlay");

  syncPlaybackControls();

  if (!overlay) {
    renderPreview();
    return;
  }

  if (!selectedPart) {
    overlay.hidden = true;
    overlay.removeAttribute("src");
  } else {
    overlay.hidden = false;
    if (overlay.getAttribute("src") !== selectedPart.previewUrl) {
      overlay.src = selectedPart.previewUrl;
    }
    overlay.alt = selectedPart.fileName;
  }

  renderCurrentFrameSummary();
  saveLayerSettings();
}

/**
 * Renders the selected frame on top of the base image using placement values.
 */
function renderPreview() {
  const previewFrameCount = getPreviewFrameCount();
  const selectedPart = isPreviewingBaseFrame ? null : partImages[selectedFrameIndex] ?? null;
  layerPreview.replaceChildren();
  syncPlaybackControls();

  if (!baseImage && !selectedPart) {
    const empty = document.createElement("p");
    empty.className = "asset-composite-placeholder";
    empty.textContent = "기준 이미지와 파츠 이미지를 선택하면 실제 배치 느낌을 확인할 수 있어요.";
    layerPreview.append(empty);
    return;
  }

  const stage = document.createElement("div");
  stage.className = "asset-composite-stage";
  stage.style.setProperty("--asset-composite-width", `${getPreviewSize()}px`);

  if (baseImage) {
    const base = document.createElement("img");
    base.className = "asset-composite-base";
    base.src = baseImage.previewUrl;
    base.alt = "파츠 기준 이미지";
    stage.append(base);
  }

  const overlay = document.createElement("img");
  overlay.className = "asset-composite-overlay";
  overlay.alt = selectedPart?.fileName ?? "";
  overlay.hidden = !selectedPart;
  if (selectedPart) {
    overlay.src = selectedPart.previewUrl;
  }
  overlay.style.left = `${currentRegion.x}%`;
  overlay.style.top = `${currentRegion.y}%`;
  overlay.style.width = `${currentRegion.width}%`;
  overlay.style.height = `${currentRegion.height}%`;
  stage.append(overlay);

  if (regionOverlayVisibleInput.checked) {
    const region = document.createElement("span");
    region.className = "asset-composite-region";
    region.title = "드래그해서 위치를 옮기고, 모서리를 드래그해서 크기를 조절하세요.";
    region.style.left = `${currentRegion.x}%`;
    region.style.top = `${currentRegion.y}%`;
    region.style.width = `${currentRegion.width}%`;
    region.style.height = `${currentRegion.height}%`;
    region.addEventListener("pointerdown", (event) => {
      startRegionDrag(event, stage, "move");
    });
    (["nw", "ne", "se", "sw"] as const).forEach((corner) => {
      const handle = document.createElement("span");

      handle.className = `asset-composite-region-handle asset-composite-region-handle-${corner}`;
      handle.dataset.regionHandle = corner;
      handle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        startRegionDrag(event, stage, `resize-${corner}`);
      });
      region.append(handle);
    });
    stage.append(region);
  }
  layerPreview.append(stage);
}

/**
 * Renders both layer and manifest JSON outputs.
 */
function renderOutputs() {
  if (getLayerId() === "mouth" && idleIntervalInput.value !== "0") {
    idleIntervalInput.value = "0";
  }

  renderLayerSelectionStep();
  renderCustomLayerField();
  selectedFrameIndex = Math.min(selectedFrameIndex, Math.max(0, partImages.length - 1));
  isPreviewingBaseFrame = canPreviewBaseFrame() ? isPreviewingBaseFrame : false;
  layerOutput.textContent = JSON.stringify(createLayerSnippet(), null, 2);
  manifestOutput.textContent = JSON.stringify(createManifestSnippet(), null, 2);
  renderSummary();
  renderPreview();
  renderFrameList();
  saveLayerSettings();
}

/**
 * Saves the layer and manifest snippets as project files.
 */
async function saveLayerConfig() {
  const validationMessage = validateLayerSaveTarget();

  if (validationMessage) {
    status.textContent = validationMessage;
    return;
  }

  const layerSnippet = createLayerSnippet();
  let savedResult: SaveResponse | null = null;

  saveButton.disabled = true;
  status.textContent = "캐릭터 파츠 설정을 저장하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-character-layer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: characterSelect.value || characterIdInput.value,
        layer: layerSnippet,
      }),
    });
    const result = await readApiJson<SaveResponse>(response);
    savedResult = result;

    if (!response.ok || !result.ok) {
      status.textContent = result.message ?? `저장 실패: ${result.error ?? response.status}`;
      return;
    }

    status.textContent = "캐릭터 index.ts에 파츠 설정을 저장했어요.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "저장 요청에 실패했어요.";
  } finally {
    if (savedResult?.ok) {
      await loadCharacterAssets();
      renderSaveResult(resolveSaveTarget(savedResult.saved, layerSnippet), layerSnippet);
    }

    saveButton.disabled = false;
  }
}

/**
 * Deletes the selected existing layer from the character source file.
 */
async function deleteLayerConfig() {
  const existingLayer = getSelectedExistingLayer();

  if (!existingLayer) {
    status.textContent = "삭제할 기존 파츠를 먼저 선택하세요.";
    return;
  }

  const characterId = characterSelect.value || characterIdInput.value;
  const confirmed = window.confirm(`${characterId} / 캐릭터 상태 ${existingLayer.surfaceId} / 파츠 ${existingLayer.layerId} 설정을 삭제할까요?`);

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  status.textContent = "선택한 파츠 설정을 삭제하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-character-layer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId,
        surfaceId: existingLayer.surfaceId,
        layerId: existingLayer.layerId,
      }),
    });
    const result = await readApiJson<DeleteResponse>(response);

    if (!response.ok || !result.ok || !result.deleted) {
      status.textContent = result.message ?? `삭제 실패: ${result.error ?? response.status}`;
      return;
    }

    await loadCharacterAssets();
    renderDeleteResult(result.deleted);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "삭제 요청에 실패했어요.";
  } finally {
    deleteButton.disabled = !getSelectedExistingLayer();
  }
}

/**
 * Copies text to the clipboard and gives short button feedback.
 */
async function copyText(text: string, button: HTMLButtonElement, label: string) {
  await navigator.clipboard.writeText(text);
  button.textContent = "복사됨";
  window.setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

/**
 * Moves the preview to a sibling frame.
 */
function moveFrame(offset: number) {
  const previewFrameCount = getPreviewFrameCount();

  if (previewFrameCount === 0) {
    selectedFrameIndex = 0;
    isPreviewingBaseFrame = false;
    updatePreviewFrame();
    return;
  }

  setPreviewSlotIndex(getPreviewSlotIndex() + offset);
  updatePreviewFrame();
}

/**
 * Starts or stops the frame animation preview.
 */
function togglePlayback() {
  if (playTimerId !== null) {
    stopPlayback();
    return;
  }

  if (getPreviewFrameCount() <= 1) {
    return;
  }

  const intervalMs = Math.max(40, Number(intervalInput.value) || 140);

  playTimerId = window.setInterval(() => {
    moveFrame(1);
  }, intervalMs);
  playFramesButton.textContent = "정지";
}

/**
 * Wires layer page controls.
 */
function init() {
  enhanceStatusNotice(status);
  loadLayerSettings();
  regionOverlayVisibleInput.checked = loadRegionOverlayVisible();
  if (!storedLayerSettings) {
    void syncAssetSavePathsFromKind();
  }
  renderRegionControls();
  renderOutputs();

  recipeSelect.addEventListener("change", () => {
    const recipe = recipes[recipeSelect.value as PartRecipeId] ?? recipes.eyeBlink;
    const timing = getRecipeTimingDefaults(recipe.id);

    currentRegion = recipe.defaultTargetRegion;
    layerIdSelect.value = getRecipeLayerId(recipe.id);
    intervalInput.value = String(timing.intervalMs);
    idleIntervalInput.value = String(timing.idleIntervalMs);
    renderRegionControls();
    renderOutputs();
  });
  partImagesInput.addEventListener("change", async () => {
    const files = Array.from(partImagesInput.files ?? []);
    appendPartFrames(await Promise.all(files.map(readImageFile)));
    partImagesInput.value = "";
    renderOutputs();
  });
  partAssetSelect.addEventListener("change", applySavedPartAssets);
  addPartAssetFramesButton.addEventListener("click", appendSelectedPartAssetFrames);
  frameListSelect.addEventListener("change", selectFrameFromList);
  moveFrameUpButton.addEventListener("click", () => moveSelectedFrame(-1));
  moveFrameDownButton.addEventListener("click", () => moveSelectedFrame(1));
  removeFrameButton.addEventListener("click", removeSelectedFrame);
  clearFramesButton.addEventListener("click", clearFrames);
  baseImageInput.addEventListener("change", async () => {
    const file = baseImageInput.files?.[0];
    baseImage = file ? await readImageFile(file) : null;
    renderOutputs();
  });
  uploadBaseAssetButton.addEventListener("click", () => {
    void uploadAssetImages("base", isUploadImage(baseImage) ? [baseImage] : []);
  });
  baseAssetSelect.addEventListener("change", applySavedBaseAsset);
  uploadPartAssetsButton.addEventListener("click", () => {
    void uploadAssetImages(getAssetSaveKind(), partImages.filter(isUploadImage));
  });
  previewSizeInput.addEventListener("input", () => {
    setPreviewSize(getPreviewSize());
  });
  previewZoomOutButton.addEventListener("click", () => {
    setPreviewSize(getPreviewSize() - 120);
  });
  previewZoomInButton.addEventListener("click", () => {
    setPreviewSize(getPreviewSize() + 120);
  });
  assetSaveKindSelect.addEventListener("change", () => {
    void syncAssetSavePathsFromKind();
    renderOutputs();
  });
  [
    basePathInput,
    saveDirectoryInput,
    surfaceIdInput,
    layerIdSelect,
    customLayerIdInput,
    intervalInput,
    idleIntervalInput,
    coversBaseInput,
    ...Object.values(regionInputs),
  ].forEach((input) => {
    input.addEventListener("input", renderOutputs);
    input.addEventListener("change", renderOutputs);
  });
  characterSelect.addEventListener("change", () => {
    void syncAssetSavePathsFromKind();
    void loadCharacterAssets();
  });
  surfaceSelect.addEventListener("change", handleSurfaceSelectionChange);
  existingLayerSelect.addEventListener("change", handleLayerSelectionChange);
  window.addEventListener("pointermove", handleRegionDragMove);
  window.addEventListener("pointerup", stopRegionDrag);
  window.addEventListener("pointercancel", stopRegionDrag);
  window.addEventListener("focus", syncSharedRegionFromStorage);
  window.addEventListener("storage", (event) => {
    if (event.key === "ghost-nest.asset-generator.target-region.v1" || event.key === layerSettingsStorageKey) {
      loadLayerSettings();
      syncSharedRegionFromStorage();
    }
  });
  saveButton.addEventListener("click", () => {
    void saveLayerConfig();
  });
  deleteButton.addEventListener("click", () => {
    void deleteLayerConfig();
  });
  copyLayerButton.addEventListener("click", () => {
    void copyText(layerOutput.textContent ?? "", copyLayerButton, "저장 데이터 복사");
  });
  copyManifestButton.addEventListener("click", () => {
    void copyText(manifestOutput.textContent ?? "", copyManifestButton, "Manifest 복사");
  });
  previousFrameButton.addEventListener("click", () => moveFrame(-1));
  nextFrameButton.addEventListener("click", () => moveFrame(1));
  playFramesButton.addEventListener("click", togglePlayback);
  regionOverlayVisibleInput.addEventListener("change", () => {
    saveRegionOverlayVisible(regionOverlayVisibleInput.checked);
    renderOutputs();
  });
  void loadCharacters();
}

init();
