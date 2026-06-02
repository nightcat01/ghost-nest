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

let baseImage: LabImage | null = null;
let currentRegion = loadStoredRegion(recipes.eyeBlink.defaultTargetRegion);
let regionDragState: RegionDragState | null = null;

const recipeSelect = requireElement(document.querySelector<HTMLSelectElement>("#partRecipeSelect"), "#partRecipeSelect");
const baseImageInput = requireElement(document.querySelector<HTMLInputElement>("#baseImageInput"), "#baseImageInput");
const cropAdjustSection = requireElement(document.querySelector<HTMLElement>("#cropAdjustSection"), "#cropAdjustSection");
const cropActionSection = requireElement(document.querySelector<HTMLElement>("#cropActionSection"), "#cropActionSection");
const preview = requireElement(document.querySelector<HTMLElement>("#cropPreview"), "#cropPreview");
const status = requireElement(document.querySelector<HTMLElement>("#cropStatus"), "#cropStatus");
const downloadButton = requireElement(document.querySelector<HTMLButtonElement>("#downloadCropButton"), "#downloadCropButton");
const regionOverlayVisibleInput = requireElement(document.querySelector<HTMLInputElement>("#regionOverlayVisibleInput"), "#regionOverlayVisibleInput");
const regionInputs = {
  x: requireElement(document.querySelector<HTMLInputElement>("#targetRegionXInput"), "#targetRegionXInput"),
  y: requireElement(document.querySelector<HTMLInputElement>("#targetRegionYInput"), "#targetRegionYInput"),
  width: requireElement(document.querySelector<HTMLInputElement>("#targetRegionWidthInput"), "#targetRegionWidthInput"),
  height: requireElement(document.querySelector<HTMLInputElement>("#targetRegionHeightInput"), "#targetRegionHeightInput"),
};

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
  stage.style.setProperty("--asset-composite-width", "680px");

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
  renderRegionControls();
  renderPreview();

  recipeSelect.addEventListener("change", applyRecipeRegion);
  Object.values(regionInputs).forEach((input) => {
    input.addEventListener("input", () => {
      applyRegion(readRegion());
    });
  });
  baseImageInput.addEventListener("change", async () => {
    const file = baseImageInput.files?.[0];
    baseImage = file ? await readImageFile(file) : null;
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
