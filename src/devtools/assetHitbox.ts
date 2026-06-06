import { fetchCharacterAssets, saveCharacterHitAreas } from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { requireElement } from "./assetShared.js";

type HitArea = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type HitAreaFormValue = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type HitAreaDragMode = "move" | "resize-nw" | "resize-ne" | "resize-se" | "resize-sw";
type HitAreaDragState = {
  id: string;
  mode: HitAreaDragMode;
  startClientX: number;
  startClientY: number;
  stageRect: DOMRect;
  startValue: HitAreaFormValue;
};

const defaultHitAreas: Record<string, HitArea> = {
  head: { minX: 0.38, maxX: 0.62, minY: 0.08, maxY: 0.3 },
  face: { minX: 0.4, maxX: 0.6, minY: 0.22, maxY: 0.42 },
  body: { minX: 0.3, maxX: 0.7, minY: 0.38, maxY: 0.86 },
};

const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const hitAreaList = requireElement(document.querySelector<HTMLElement>("#hitAreaList"), "#hitAreaList");
const addHitAreaButton = requireElement(document.querySelector<HTMLButtonElement>("#addHitAreaButton"), "#addHitAreaButton");
const saveHitAreasButton = requireElement(document.querySelector<HTMLButtonElement>("#saveHitAreasButton"), "#saveHitAreasButton");
const previewImage = requireElement(document.querySelector<HTMLImageElement>("#hitboxPreviewImage"), "#hitboxPreviewImage");
const overlay = requireElement(document.querySelector<HTMLElement>("#hitboxOverlay"), "#hitboxOverlay");
const output = requireElement(document.querySelector<HTMLElement>("#hitboxOutput"), "#hitboxOutput");
const status = requireElement(document.querySelector<HTMLElement>("#hitboxStatus"), "#hitboxStatus");

let hitAreas: Record<string, HitArea> = {};
let baseImage = "";
let activeHitAreaId = "";
let hitAreaDragState: HitAreaDragState | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

function fromPercent(value: number) {
  return clamp(value / 100, 0, 1);
}

function areaToFormValue(id: string, area: HitArea): HitAreaFormValue {
  return {
    id,
    x: toPercent(area.minX),
    y: toPercent(area.minY),
    width: toPercent(area.maxX - area.minX),
    height: toPercent(area.maxY - area.minY),
  };
}

function formValueToArea(value: HitAreaFormValue): HitArea {
  const minX = fromPercent(value.x);
  const minY = fromPercent(value.y);
  const width = fromPercent(value.width);
  const height = fromPercent(value.height);

  return {
    minX,
    minY,
    maxX: clamp(minX + Math.max(width, 0.01), 0.01, 1),
    maxY: clamp(minY + Math.max(height, 0.01), 0.01, 1),
  };
}

function clampFormValue(value: HitAreaFormValue): HitAreaFormValue {
  const width = clamp(value.width, 1, 100);
  const height = clamp(value.height, 1, 100);

  return {
    id: value.id,
    x: clamp(value.x, 0, 100 - width),
    y: clamp(value.y, 0, 100 - height),
    width,
    height,
  };
}

function getSurfaceImage(assets: Awaited<ReturnType<typeof fetchCharacterAssets>>["assets"]) {
  const surfaces = assets?.surfaces ?? {};
  const firstSurface = Object.values(surfaces).find((surface) =>
    surface && typeof surface === "object" && ("image" in surface || "visual" in surface),
  );
  const visual = firstSurface?.visual;

  if (visual?.type === "image") {
    return visual.src;
  }

  return firstSurface?.image ?? "";
}

function readFormHitAreas() {
  const nextAreas: Record<string, HitArea> = {};

  hitAreaList.querySelectorAll<HTMLElement>("[data-hit-area-card]").forEach((card) => {
    const id = card.querySelector<HTMLInputElement>("[data-hit-area-id]")?.value.trim();
    const x = Number(card.querySelector<HTMLInputElement>("[data-axis='x']")?.value ?? 0);
    const y = Number(card.querySelector<HTMLInputElement>("[data-axis='y']")?.value ?? 0);
    const width = Number(card.querySelector<HTMLInputElement>("[data-axis='width']")?.value ?? 1);
    const height = Number(card.querySelector<HTMLInputElement>("[data-axis='height']")?.value ?? 1);

    if (!id) {
      return;
    }

    nextAreas[id] = formValueToArea({ id, x, y, width, height });
  });

  return nextAreas;
}

function findHitAreaCard(id: string) {
  return Array.from(hitAreaList.querySelectorAll<HTMLElement>("[data-hit-area-card]"))
    .find((card) => card.querySelector<HTMLInputElement>("[data-hit-area-id]")?.value.trim() === id) ?? null;
}

function readHitAreaCardValue(id: string): HitAreaFormValue | null {
  const card = findHitAreaCard(id);

  if (!card) {
    return null;
  }

  return {
    id,
    x: Number(card.querySelector<HTMLInputElement>("[data-axis='x']")?.value ?? 0),
    y: Number(card.querySelector<HTMLInputElement>("[data-axis='y']")?.value ?? 0),
    width: Number(card.querySelector<HTMLInputElement>("[data-axis='width']")?.value ?? 1),
    height: Number(card.querySelector<HTMLInputElement>("[data-axis='height']")?.value ?? 1),
  };
}

function writeHitAreaCardValue(value: HitAreaFormValue) {
  const card = findHitAreaCard(value.id);

  if (!card) {
    return;
  }

  const safeValue = clampFormValue(value);
  (["x", "y", "width", "height"] as const).forEach((axis) => {
    const input = card.querySelector<HTMLInputElement>(`[data-axis='${axis}']`);

    if (input) {
      input.value = String(Math.round(safeValue[axis] * 10) / 10);
    }
  });
}

function setActiveHitArea(id: string) {
  activeHitAreaId = id;
  hitAreaList.querySelectorAll<HTMLElement>("[data-hit-area-card]").forEach((card) => {
    const cardId = card.querySelector<HTMLInputElement>("[data-hit-area-id]")?.value.trim();
    card.toggleAttribute("data-active-hit-area", cardId === id);
  });
}

function resizeFormValue(value: HitAreaFormValue, mode: HitAreaDragMode, deltaX: number, deltaY: number): HitAreaFormValue {
  if (mode === "resize-nw") {
    return {
      ...value,
      x: value.x + deltaX,
      y: value.y + deltaY,
      width: value.width - deltaX,
      height: value.height - deltaY,
    };
  }

  if (mode === "resize-ne") {
    return {
      ...value,
      y: value.y + deltaY,
      width: value.width + deltaX,
      height: value.height - deltaY,
    };
  }

  if (mode === "resize-sw") {
    return {
      ...value,
      x: value.x + deltaX,
      width: value.width - deltaX,
      height: value.height + deltaY,
    };
  }

  return {
    ...value,
    width: value.width + deltaX,
    height: value.height + deltaY,
  };
}

function startHitAreaDrag(event: PointerEvent, id: string, mode: HitAreaDragMode) {
  const startValue = readHitAreaCardValue(id);

  if (!startValue) {
    return;
  }

  event.preventDefault();
  setActiveHitArea(id);
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  hitAreaDragState = {
    id,
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    stageRect: overlay.getBoundingClientRect(),
    startValue,
  };
}

function handleHitAreaDragMove(event: PointerEvent) {
  if (!hitAreaDragState) {
    return;
  }

  const deltaX = ((event.clientX - hitAreaDragState.startClientX) / hitAreaDragState.stageRect.width) * 100;
  const deltaY = ((event.clientY - hitAreaDragState.startClientY) / hitAreaDragState.stageRect.height) * 100;
  const nextValue = hitAreaDragState.mode === "move"
    ? {
      ...hitAreaDragState.startValue,
      x: hitAreaDragState.startValue.x + deltaX,
      y: hitAreaDragState.startValue.y + deltaY,
    }
    : resizeFormValue(hitAreaDragState.startValue, hitAreaDragState.mode, deltaX, deltaY);

  writeHitAreaCardValue(clampFormValue(nextValue));
  renderPreview();
}

function stopHitAreaDrag() {
  hitAreaDragState = null;
}

function renderPreview() {
  hitAreas = readFormHitAreas();
  overlay.replaceChildren(...Object.entries(hitAreas).map(([id, area]) => {
    const region = document.createElement("div");
    const label = document.createElement("span");

    region.className = "asset-hitbox-region";
    region.style.left = `${toPercent(area.minX)}%`;
    region.style.top = `${toPercent(area.minY)}%`;
    region.style.width = `${toPercent(area.maxX - area.minX)}%`;
    region.style.height = `${toPercent(area.maxY - area.minY)}%`;
    region.dataset.hitAreaRegion = id;
    region.toggleAttribute("data-active-hit-area", activeHitAreaId === id);
    region.title = "드래그해서 위치를 옮기고, 모서리를 드래그해서 크기를 조절하세요.";
    region.addEventListener("pointerdown", (event) => {
      startHitAreaDrag(event, id, "move");
    });
    label.className = "asset-hitbox-region-label";
    label.textContent = id;
    region.append(label);
    (["nw", "ne", "se", "sw"] as const).forEach((corner) => {
      const handle = document.createElement("span");

      handle.className = `asset-composite-region-handle asset-composite-region-handle-${corner}`;
      handle.dataset.hitAreaHandle = corner;
      handle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        startHitAreaDrag(event, id, `resize-${corner}`);
      });
      region.append(handle);
    });

    return region;
  }));
  output.textContent = JSON.stringify({ hitAreas }, null, 2);
}

function createNumberField(labelText: string, axis: "x" | "y" | "width" | "height", value: number) {
  const label = document.createElement("label");
  const input = document.createElement("input");

  label.textContent = labelText;
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.step = "0.1";
  input.value = String(value);
  input.dataset.axis = axis;
  input.addEventListener("input", renderPreview);
  label.append(input);

  return label;
}

function createHitAreaCard(id: string, area: HitArea) {
  const value = areaToFormValue(id, area);
  const card = document.createElement("article");
  const header = document.createElement("div");
  const idLabel = document.createElement("label");
  const idInput = document.createElement("input");
  const deleteButton = document.createElement("button");
  const fields = document.createElement("div");

  card.className = "asset-hitbox-card";
  card.dataset.hitAreaCard = "true";
  header.className = "asset-hitbox-card-header";
  idLabel.textContent = "영역 key";
  idInput.value = id;
  idInput.dataset.hitAreaId = "true";
  idInput.addEventListener("input", () => {
    activeHitAreaId = idInput.value.trim();
    renderPreview();
  });
  idLabel.append(idInput);
  deleteButton.type = "button";
  deleteButton.textContent = "삭제";
  deleteButton.className = "asset-quiet-danger-button";
  deleteButton.addEventListener("click", () => {
    card.remove();
    renderPreview();
  });
  fields.className = "asset-hitbox-axis-grid";
  fields.append(
    createNumberField("X", "x", value.x),
    createNumberField("Y", "y", value.y),
    createNumberField("W", "width", value.width),
    createNumberField("H", "height", value.height),
  );
  header.append(idLabel, deleteButton);
  card.append(header, fields);
  card.addEventListener("focusin", () => {
    const nextId = idInput.value.trim();

    if (nextId) {
      setActiveHitArea(nextId);
      renderPreview();
    }
  });

  return card;
}

function renderHitAreas() {
  hitAreaList.replaceChildren(...Object.entries(hitAreas).map(([id, area]) => createHitAreaCard(id, area)));
  activeHitAreaId = Object.keys(hitAreas)[0] ?? "";
  setActiveHitArea(activeHitAreaId);
  renderPreview();
}

function addHitArea() {
  hitAreas = readFormHitAreas();
  let index = Object.keys(hitAreas).length + 1;
  let id = `area${index}`;

  while (hitAreas[id]) {
    index += 1;
    id = `area${index}`;
  }

  hitAreas[id] = { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 };
  renderHitAreas();
}

async function loadCharacterHitAreas() {
  const characterId = characterSelect.value;

  if (!characterId) {
    return;
  }

  status.textContent = `${characterId} 터치 영역을 불러오는 중입니다.`;

  try {
    const result = await fetchCharacterAssets(characterId);
    const savedAreas = result.assets?.hitAreas ?? {};

    hitAreas = Object.keys(savedAreas).length > 0
      ? savedAreas as Record<string, HitArea>
      : { ...defaultHitAreas };
    baseImage = getSurfaceImage(result.assets);
    previewImage.hidden = !baseImage;
    previewImage.src = baseImage;
    renderHitAreas();
    status.textContent = `${characterId} 터치 영역을 불러왔어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "터치 영역을 불러오지 못했어요.";
  }
}

async function saveHitAreas() {
  const characterId = characterSelect.value;

  if (!characterId) {
    status.textContent = "저장할 캐릭터를 먼저 선택하세요.";
    return;
  }

  try {
    const saved = await saveCharacterHitAreas(characterId, readFormHitAreas());
    status.textContent = `${saved?.characterId ?? characterId} 터치 영역을 저장했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "터치 영역을 저장하지 못했어요.";
  }
}

characterSelect.addEventListener("change", () => {
  void loadCharacterHitAreas();
});
addHitAreaButton.addEventListener("click", addHitArea);
saveHitAreasButton.addEventListener("click", () => {
  void saveHitAreas();
});
window.addEventListener("pointermove", handleHitAreaDragMove);
window.addEventListener("pointerup", stopHitAreaDrag);
window.addEventListener("pointercancel", stopHitAreaDrag);

void populateCharacterSelect(characterSelect).then(() => loadCharacterHitAreas());
