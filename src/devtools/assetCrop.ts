import {
  CharacterAssetsPayload,
  fetchAssetFiles,
  fetchCharacterAssets,
} from "./assetApi.js";
import { appendAssetOptionGroups, filterAssetFiles } from "./assetSelect.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import {
  clampRegion,
  createCropDataUrl,
  downloadDataUrl,
  LabImage,
  loadRegionOverlayVisible,
  loadStoredRegion,
  PartRecipeId,
  readImageFile,
  recipes,
  requireElement,
  saveRegionOverlayVisible,
  saveStoredRegion,
  TargetRegion,
} from "./assetShared.js";

type RegionDragMode = "move" | "resize-nw" | "resize-ne" | "resize-se" | "resize-sw";
type RegionDragState = {
  mode: RegionDragMode;
  startClientX: number;
  startClientY: number;
  stageRect: DOMRect;
  startRegion: TargetRegion;
};
type SavedPartRegion = {
  id: string;
  surfaceId: string;
  layerId: string;
  region: TargetRegion;
};

let baseImage: LabImage | null = null;
let currentRegion = loadStoredRegion(recipes.eyeBlink.defaultTargetRegion);
let regionDragState: RegionDragState | null = null;
let cropPreviewSize = 680;
let savedPartRegions: SavedPartRegion[] = [];

const recipeSelect = requireElement(document.querySelector<HTMLSelectElement>("#partRecipeSelect"), "#partRecipeSelect");
const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const savedBaseImageSelect = requireElement(document.querySelector<HTMLSelectElement>("#savedBaseImageSelect"), "#savedBaseImageSelect");
const savedPartRegionSelect = requireElement(document.querySelector<HTMLSelectElement>("#savedPartRegionSelect"), "#savedPartRegionSelect");
const baseImageInput = requireElement(document.querySelector<HTMLInputElement>("#baseImageInput"), "#baseImageInput");
const cropAdjustSection = requireElement(document.querySelector<HTMLElement>("#cropAdjustSection"), "#cropAdjustSection");
const cropActionSection = requireElement(document.querySelector<HTMLElement>("#cropActionSection"), "#cropActionSection");
const preview = requireElement(document.querySelector<HTMLElement>("#cropPreview"), "#cropPreview");
const status = requireElement(document.querySelector<HTMLElement>("#cropStatus"), "#cropStatus");
const downloadButton = requireElement(document.querySelector<HTMLButtonElement>("#downloadCropButton"), "#downloadCropButton");
const previewSizeInput = requireElement(document.querySelector<HTMLInputElement>("#cropPreviewSizeInput"), "#cropPreviewSizeInput");
const previewZoomOutButton = requireElement(document.querySelector<HTMLButtonElement>("#cropPreviewZoomOutButton"), "#cropPreviewZoomOutButton");
const previewZoomInButton = requireElement(document.querySelector<HTMLButtonElement>("#cropPreviewZoomInButton"), "#cropPreviewZoomInButton");
const previewResetButton = requireElement(document.querySelector<HTMLButtonElement>("#cropPreviewResetButton"), "#cropPreviewResetButton");
const regionOverlayVisibleInput = requireElement(document.querySelector<HTMLInputElement>("#regionOverlayVisibleInput"), "#regionOverlayVisibleInput");
const regionInputs = {
  x: requireElement(document.querySelector<HTMLInputElement>("#targetRegionXInput"), "#targetRegionXInput"),
  y: requireElement(document.querySelector<HTMLInputElement>("#targetRegionYInput"), "#targetRegionYInput"),
  width: requireElement(document.querySelector<HTMLInputElement>("#targetRegionWidthInput"), "#targetRegionWidthInput"),
  height: requireElement(document.querySelector<HTMLInputElement>("#targetRegionHeightInput"), "#targetRegionHeightInput"),
};

/**
 * Keeps crop preview size inside the workbench bounds.
 */
function clampPreviewSize(size: number) {
  return Math.min(1100, Math.max(360, Math.round(size / 20) * 20));
}

/**
 * Applies preview zoom without changing the selected crop region.
 */
function setCropPreviewSize(size: number) {
  cropPreviewSize = clampPreviewSize(size);
  previewSizeInput.value = String(cropPreviewSize);
  renderPreview();
}

/**
 * Returns the conventional layer id for a part recipe.
 */
function getRecipeLayerId(recipeId: PartRecipeId) {
  return recipeId === "mouthShapes" ? "mouth" : recipeId === "eyeBlink" ? "eyes" : "accessory";
}

/**
 * Checks whether a loaded layer value contains percent placement data.
 */
function readLayerPlacement(layer: unknown): TargetRegion | null {
  if (!layer || typeof layer !== "object" || !("placement" in layer)) {
    return null;
  }

  const placement = (layer as { placement?: Partial<TargetRegion> }).placement;

  if (!placement) {
    return null;
  }

  const region = clampRegion({
    x: Number(placement.x),
    y: Number(placement.y),
    width: Number(placement.width),
    height: Number(placement.height),
    unit: "percent",
  });

  return Number.isFinite(region.x) && Number.isFinite(region.y) ? region : null;
}

/**
 * Collects every saved layer placement so crop can reuse custom part regions.
 */
function collectSavedPartRegions(assets: CharacterAssetsPayload | undefined): SavedPartRegion[] {
  return Object.entries(assets?.surfaces ?? {}).flatMap(([surfaceId, surface]) =>
    Object.entries(surface.layers ?? {}).flatMap(([layerId, layer]) => {
      const region = readLayerPlacement(layer);

      return region ? [{
        id: `${surfaceId}:${layerId}`,
        surfaceId,
        layerId,
        region,
      }] : [];
    }),
  );
}

/**
 * Applies a saved layer placement to the crop box.
 */
function applySavedPartRegion(regionId: string) {
  const savedRegion = savedPartRegions.find((region) => region.id === regionId);

  if (!savedRegion) {
    return false;
  }

  applyRegion(savedRegion.region);
  status.textContent = `${savedRegion.surfaceId} / ${savedRegion.layerId} 파츠 영역을 불러왔어요.`;

  return true;
}

/**
 * Reads a fetched image blob into the same structure as a user-selected file.
 */
function readImageBlob(blob: Blob, fileName: string): Promise<LabImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지를 data URL로 읽지 못했어요."));
        return;
      }

      resolve({
        fileName,
        previewUrl: reader.result,
        dataUrl: reader.result,
      });
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("이미지를 읽지 못했어요."));
    });
    reader.readAsDataURL(blob);
  });
}

/**
 * Loads an already-saved base image so crop can start without a new upload.
 */
async function loadSavedBaseImage(assetPath: string) {
  const response = await fetch(assetPath);

  if (!response.ok) {
    throw new Error(`저장된 base 이미지를 불러오지 못했어요. (${response.status})`);
  }

  const fileName = assetPath.split("/").pop() || "base-image.png";

  return readImageBlob(await response.blob(), fileName);
}

/**
 * Refreshes the saved base image choices for the selected character.
 */
async function refreshSavedBaseImages() {
  const characterId = characterSelect.value;

  savedBaseImageSelect.disabled = true;
  savedBaseImageSelect.replaceChildren(new Option("저장된 base 이미지 불러오는 중...", ""));

  if (!characterId) {
    savedBaseImageSelect.replaceChildren(new Option("먼저 캐릭터를 선택하세요.", ""));
    return;
  }

  try {
    const baseFiles = filterAssetFiles(await fetchAssetFiles(characterId), ["base"], { includeCommon: false });

    if (baseFiles.length === 0) {
      savedBaseImageSelect.replaceChildren(new Option("저장된 base 이미지가 없어요. 파일을 업로드하세요.", ""));
      return;
    }

    savedBaseImageSelect.replaceChildren(new Option("저장된 base 이미지 선택", ""));
    appendAssetOptionGroups(savedBaseImageSelect, baseFiles, {
      character: "저장된 base 이미지",
    });
    savedBaseImageSelect.disabled = false;
  } catch (error) {
    savedBaseImageSelect.replaceChildren(new Option(error instanceof Error ? error.message : "base 이미지를 불러오지 못했어요.", ""));
  }
}

/**
 * Refreshes saved part placement choices for the selected character.
 */
async function refreshSavedPartRegions() {
  const characterId = characterSelect.value;
  const preferredLayerId = getRecipeLayerId(recipeSelect.value as PartRecipeId);

  savedPartRegionSelect.disabled = true;
  savedPartRegionSelect.replaceChildren(new Option("저장된 파츠 영역 불러오는 중...", ""));
  savedPartRegions = [];

  if (!characterId) {
    savedPartRegionSelect.replaceChildren(new Option("먼저 캐릭터를 선택하세요.", ""));
    return;
  }

  try {
    const result = await fetchCharacterAssets(characterId);
    const regions = collectSavedPartRegions(result.assets)
      .sort((left, right) => {
        if (left.layerId === preferredLayerId && right.layerId !== preferredLayerId) {
          return -1;
        }

        if (right.layerId === preferredLayerId && left.layerId !== preferredLayerId) {
          return 1;
        }

        return `${left.surfaceId}:${left.layerId}`.localeCompare(`${right.surfaceId}:${right.layerId}`, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });

    if (regions.length === 0) {
      savedPartRegionSelect.replaceChildren(new Option("저장된 파츠 영역이 없어요. 기본 영역을 사용하세요.", ""));
      return;
    }

    savedPartRegions = regions;
    savedPartRegionSelect.replaceChildren(new Option("저장된 파츠 영역 선택", ""));
    regions.forEach((region) => {
      const option = new Option(
        `${region.surfaceId} / ${region.layerId} - x ${region.region.x}%, y ${region.region.y}%, w ${region.region.width}%, h ${region.region.height}%`,
        region.id,
      );

      savedPartRegionSelect.append(option);
    });
    savedPartRegionSelect.disabled = false;
  } catch (error) {
    savedPartRegionSelect.replaceChildren(new Option(error instanceof Error ? error.message : "파츠 영역을 불러오지 못했어요.", ""));
  }
}

/**
 * Applies the first saved placement that matches the current recipe layer id.
 */
function applyPreferredSavedRegionForRecipe() {
  const preferredLayerId = getRecipeLayerId(recipeSelect.value as PartRecipeId);
  const preferredRegion = savedPartRegions.find((region) => region.layerId === preferredLayerId);

  if (!preferredRegion) {
    return false;
  }

  savedPartRegionSelect.value = preferredRegion.id;

  return applySavedPartRegion(preferredRegion.id);
}

/**
 * Reveals region editing only after a base image is available.
 */
function renderCropSteps() {
  const hasImage = Boolean(baseImage);

  cropAdjustSection.hidden = !hasImage;
  cropActionSection.hidden = !hasImage;
  downloadButton.disabled = !hasImage;
}

/**
 * Reads the current region controls and stores them for the other asset pages.
 */
function readRegion(): TargetRegion {
  currentRegion = clampRegion({
    x: Number(regionInputs.x.value),
    y: Number(regionInputs.y.value),
    width: Number(regionInputs.width.value),
    height: Number(regionInputs.height.value),
    unit: "percent",
  });
  saveStoredRegion(currentRegion);

  return currentRegion;
}

/**
 * Applies a region change from either number inputs or pointer controls.
 */
function applyRegion(region: TargetRegion) {
  currentRegion = clampRegion(region);
  saveStoredRegion(currentRegion);
  renderRegionControls();
  renderPreview();
}

/**
 * Starts moving or resizing the crop box in the preview.
 */
function startRegionDrag(event: PointerEvent, stage: HTMLElement, mode: RegionDragMode) {
  event.preventDefault();
  regionDragState = {
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    stageRect: stage.getBoundingClientRect(),
    startRegion: { ...currentRegion },
  };
}

/**
 * Updates the crop box while the pointer is dragging.
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
    : resizeRegion(regionDragState.startRegion, regionDragState.mode, deltaX, deltaY);

  applyRegion(nextRegion);
}

/**
 * Stops an active crop box drag.
 */
function stopRegionDrag() {
  regionDragState = null;
}

/**
 * Converts a resize handle drag into a new region rectangle.
 */
function resizeRegion(region: TargetRegion, mode: RegionDragMode, deltaX: number, deltaY: number): TargetRegion {
  if (mode === "resize-nw") {
    return {
      ...region,
      x: region.x + deltaX,
      y: region.y + deltaY,
      width: region.width - deltaX,
      height: region.height - deltaY,
    };
  }

  if (mode === "resize-ne") {
    return {
      ...region,
      y: region.y + deltaY,
      width: region.width + deltaX,
      height: region.height - deltaY,
    };
  }

  if (mode === "resize-sw") {
    return {
      ...region,
      x: region.x + deltaX,
      width: region.width - deltaX,
      height: region.height + deltaY,
    };
  }

  return {
    ...region,
    width: region.width + deltaX,
    height: region.height + deltaY,
  };
}

/**
 * Applies a recipe default region to the controls.
 */
function applyRecipeRegion() {
  const recipe = recipes[recipeSelect.value as PartRecipeId] ?? recipes.eyeBlink;

  if (applyPreferredSavedRegionForRecipe()) {
    return;
  }

  currentRegion = recipe.defaultTargetRegion;
  saveStoredRegion(currentRegion);
  renderRegionControls();
  renderPreview();
}

/**
 * Mirrors the current region state into numeric inputs.
 */
function renderRegionControls() {
  regionInputs.x.value = String(currentRegion.x);
  regionInputs.y.value = String(currentRegion.y);
  regionInputs.width.value = String(currentRegion.width);
  regionInputs.height.value = String(currentRegion.height);
}

/**
 * Renders the base image and selected crop rectangle.
 */
function renderPreview() {
  preview.replaceChildren();

  if (!baseImage) {
    const empty = document.createElement("p");
    empty.className = "asset-composite-placeholder";
    empty.textContent = "기준 이미지를 선택하면 crop 영역을 확인할 수 있어요.";
    preview.append(empty);
    renderCropSteps();
    return;
  }

  const stage = document.createElement("div");
  stage.className = "asset-composite-stage";
  stage.style.setProperty("--asset-composite-width", `${cropPreviewSize}px`);

  const image = document.createElement("img");
  image.className = "asset-composite-base";
  image.src = baseImage.previewUrl;
  image.alt = "crop 기준 이미지";
  stage.append(image);

  if (regionOverlayVisibleInput.checked) {
    const region = document.createElement("span");
    region.className = "asset-composite-region";
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
  preview.append(stage);
  renderCropSteps();
}

/**
 * Downloads the selected region as a PNG crop.
 */
async function downloadCrop() {
  if (!baseImage) {
    status.textContent = "먼저 기준 이미지를 선택해야 해요.";
    return;
  }

  const recipe = recipes[recipeSelect.value as PartRecipeId] ?? recipes.eyeBlink;
  const cropDataUrl = await createCropDataUrl(baseImage.dataUrl, readRegion());

  downloadDataUrl(cropDataUrl, `${recipe.id}-crop.png`);
  status.textContent = "선택 영역 crop 다운로드를 시작했어요.";
}

/**
 * Wires crop page controls.
 */
function init() {
  regionOverlayVisibleInput.checked = loadRegionOverlayVisible();
  cropPreviewSize = clampPreviewSize(Number(previewSizeInput.value) || cropPreviewSize);
  previewSizeInput.value = String(cropPreviewSize);
  renderRegionControls();
  renderPreview();
  void populateCharacterSelect(characterSelect).then(async () => {
    await Promise.all([
      refreshSavedBaseImages(),
      refreshSavedPartRegions(),
    ]);
    applyPreferredSavedRegionForRecipe();
  });

  characterSelect.addEventListener("change", () => {
    baseImage = null;
    baseImageInput.value = "";
    savedBaseImageSelect.value = "";
    savedPartRegionSelect.value = "";
    renderPreview();
    void refreshSavedBaseImages();
    void refreshSavedPartRegions();
  });
  recipeSelect.addEventListener("change", async () => {
    await refreshSavedPartRegions();
    applyRecipeRegion();
  });
  previewSizeInput.addEventListener("input", () => {
    setCropPreviewSize(Number(previewSizeInput.value));
  });
  previewZoomOutButton.addEventListener("click", () => {
    setCropPreviewSize(cropPreviewSize - 80);
  });
  previewZoomInButton.addEventListener("click", () => {
    setCropPreviewSize(cropPreviewSize + 80);
  });
  previewResetButton.addEventListener("click", () => {
    setCropPreviewSize(680);
  });
  Object.values(regionInputs).forEach((input) => {
    input.addEventListener("input", () => {
      applyRegion(readRegion());
    });
  });
  savedBaseImageSelect.addEventListener("change", async () => {
    if (!savedBaseImageSelect.value) {
      return;
    }

    try {
      baseImageInput.value = "";
      baseImage = await loadSavedBaseImage(savedBaseImageSelect.value);
      status.textContent = `${baseImage.fileName} 이미지를 기준 이미지로 불러왔어요.`;
      renderPreview();
    } catch (error) {
      baseImage = null;
      status.textContent = error instanceof Error ? error.message : "저장된 base 이미지를 불러오지 못했어요.";
      renderPreview();
    }
  });
  savedPartRegionSelect.addEventListener("change", () => {
    applySavedPartRegion(savedPartRegionSelect.value);
  });
  baseImageInput.addEventListener("change", async () => {
    const file = baseImageInput.files?.[0];
    baseImage = file ? await readImageFile(file) : null;
    savedBaseImageSelect.value = "";
    renderPreview();
  });
  downloadButton.addEventListener("click", () => {
    void downloadCrop();
  });
  regionOverlayVisibleInput.addEventListener("change", () => {
    saveRegionOverlayVisible(regionOverlayVisibleInput.checked);
    renderPreview();
  });
  window.addEventListener("pointermove", handleRegionDragMove);
  window.addEventListener("pointerup", stopRegionDrag);
  window.addEventListener("pointercancel", stopRegionDrag);
}

init();
