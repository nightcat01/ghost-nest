import { requireElement } from "./assetShared.js";
import {
  AssetFile,
  createDevtoolsApiPath,
  fetchAssetFiles,
  fetchCharacterAssets,
  readApiJson,
} from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { createExpressionLabel } from "./assetTerminology.js";
import { createAssetOptionLabel, filterAssetFiles } from "./assetSelect.js";
import type { CharacterExpressionAsset, RuntimeScene } from "../core/types.js";

type SurfaceSaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  saved?: {
    path: string;
    surfaceId: string;
  };
};
type ExistingSurface = {
  surfaceId: string;
  sceneId?: string;
  image?: string;
  expression?: string;
  alt?: string;
  layerCount: number;
};

const newSurfaceSelectValue = "__new_surface__";
const manualSurfaceIdSelectValue = "__manual_surface_id__";
const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const surfaceSelect = requireElement(document.querySelector<HTMLSelectElement>("#surfaceSelect"), "#surfaceSelect");
const surfaceIdPresetSelect = requireElement(document.querySelector<HTMLSelectElement>("#surfaceIdPresetSelect"), "#surfaceIdPresetSelect");
const surfaceIdInput = requireElement(document.querySelector<HTMLInputElement>("#surfaceIdInput"), "#surfaceIdInput");
const surfaceExpressionSelect = requireElement(document.querySelector<HTMLSelectElement>("#surfaceExpressionSelect"), "#surfaceExpressionSelect");
const surfaceAltInput = requireElement(document.querySelector<HTMLInputElement>("#surfaceAltInput"), "#surfaceAltInput");
const baseAssetSelect = requireElement(document.querySelector<HTMLSelectElement>("#baseAssetSelect"), "#baseAssetSelect");
const surfaceImageInput = requireElement(document.querySelector<HTMLInputElement>("#surfaceImageInput"), "#surfaceImageInput");
const surfaceSceneSelect = requireElement(document.querySelector<HTMLSelectElement>("#surfaceSceneSelect"), "#surfaceSceneSelect");
const preview = requireElement(document.querySelector<HTMLElement>("#setPreview"), "#setPreview");
const output = requireElement(document.querySelector<HTMLElement>("#setOutput"), "#setOutput");
const status = requireElement(document.querySelector<HTMLElement>("#setStatus"), "#setStatus");
const saveButton = requireElement(document.querySelector<HTMLButtonElement>("#saveSurfaceConfigButton"), "#saveSurfaceConfigButton");
const deleteButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteSurfaceConfigButton"), "#deleteSurfaceConfigButton");

let existingSurfaces: ExistingSurface[] = [];
let existingExpressions: Record<string, CharacterExpressionAsset> = {};
let existingScenes: Record<string, RuntimeScene> = {};
let savedAssetFiles: AssetFile[] = [];

/**
 * Keeps Set options in numeric id order when possible.
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
 * Suggests the next numeric surface key without assuming keys must be numeric.
 */
function createNextSurfaceId() {
  const numericIds = existingSurfaces
    .map((surface) => Number(surface.surfaceId))
    .filter((surfaceId) => Number.isInteger(surfaceId) && surfaceId >= 0);

  if (numericIds.length === 0) {
    return "0";
  }

  return String(Math.max(...numericIds) + 1);
}

/**
 * Keeps the quick surface key selector in sync with existing keys and the manual input.
 */
function renderSurfaceIdPresetOptions(preferredValue = surfaceIdInput.value.trim()) {
  const nextSurfaceId = createNextSurfaceId();
  const fixedOptions = [
    new Option(`자동 추천: ${nextSurfaceId}`, nextSurfaceId),
    new Option("직접 입력", manualSurfaceIdSelectValue),
  ];
  const existingOptions = existingSurfaces.map((surface) =>
    new Option(`기존 키 수정: ${surface.surfaceId}`, surface.surfaceId),
  );

  surfaceIdPresetSelect.replaceChildren(...fixedOptions, ...existingOptions);

  const hasPreferredOption = Array.from(surfaceIdPresetSelect.options)
    .some((option) => option.value === preferredValue);

  surfaceIdPresetSelect.value = preferredValue && hasPreferredOption
    ? preferredValue
    : manualSurfaceIdSelectValue;
}

/**
 * Applies a quick-selected surface key to the editable input.
 */
function applySurfaceIdPresetSelection() {
  if (surfaceIdPresetSelect.value && surfaceIdPresetSelect.value !== manualSurfaceIdSelectValue) {
    surfaceIdInput.value = surfaceIdPresetSelect.value;
  }

  renderSurfaceIdPresetOptions(surfaceIdInput.value.trim());
  renderOutputs();
}

/**
 * Reflects a manually typed surface key in the quick selector when possible.
 */
function syncSurfaceIdPresetFromInput() {
  renderSurfaceIdPresetOptions(surfaceIdInput.value.trim());
  renderOutputs();
}

/**
 * Builds the Set payload shown and saved by this page.
 */
function createSurfaceSnippet() {
  const surfaceId = surfaceIdInput.value.trim() || "0";
  const image = surfaceImageInput.value.trim();
  const sceneId = surfaceSceneSelect.value.trim();
  const expression = surfaceExpressionSelect.value.trim();
  const alt = surfaceAltInput.value.trim();

  return {
    surfaceId,
    surface: {
      id: surfaceId,
      ...(sceneId ? { visual: { type: "scene", sceneId } } : {}),
      ...(image ? { image } : {}),
      ...(expression ? { expression } : {}),
      ...(alt ? { alt } : {}),
    },
  };
}

/**
 * Returns saved base image candidates for an expression.
 */
function getExpressionAssetPaths(expression: string) {
  const savedAsset = existingExpressions[expression];
  const candidates = Array.isArray(savedAsset)
    ? savedAsset
    : savedAsset
      ? [savedAsset]
      : [];

  return candidates.filter((asset): asset is string => typeof asset === "string");
}

/**
 * Checks whether the Set can be reached by the runtime expression flow.
 */
function validateSurfaceSnippet(surfaceSnippet: ReturnType<typeof createSurfaceSnippet>) {
  const expression = surfaceSnippet.surface.expression;
  const image = surfaceSnippet.surface.image;
  const sceneId = surfaceSnippet.surface.visual?.type === "scene" ? surfaceSnippet.surface.visual.sceneId : "";

  if (!expression) {
    return "표시 상태에 연결할 표정을 선택하세요.";
  }

  if (!image && !sceneId) {
    return "표시 상태의 기준 이미지 또는 무대 조합을 선택하세요.";
  }

  if (image && !getExpressionAssetPaths(expression).includes(image)) {
    return `먼저 표정 '${expression}' 등록을 완료하고, 그 후보 안에 표시 상태용 기본 이미지를 포함하세요.`;
  }

  return null;
}

/**
 * Refreshes the image and JSON preview.
 */
function renderOutputs() {
  const surfaceSnippet = createSurfaceSnippet();

  preview.replaceChildren();

  if (surfaceSnippet.surface.visual?.type === "scene") {
    renderScenePreview(surfaceSnippet.surface.visual.sceneId);
  } else if (surfaceSnippet.surface.image) {
    const image = document.createElement("img");

    image.src = surfaceSnippet.surface.image;
    image.alt = surfaceSnippet.surface.alt ?? surfaceSnippet.surface.id;
    preview.append(image);
  } else {
    const empty = document.createElement("p");

    empty.textContent = "표시 상태의 기준 이미지를 선택하세요.";
    preview.append(empty);
  }

  output.textContent = JSON.stringify({
    surfacePath: `assets.surfaces[${JSON.stringify(surfaceSnippet.surfaceId)}]`,
    surface: surfaceSnippet.surface,
  }, null, 2);
}

/**
 * Renders a saved Scene composition as the Set visual preview.
 */
function renderScenePreview(sceneId: string) {
  const scene = existingScenes[sceneId];
  const stage = document.createElement("div");

  stage.className = "asset-scene-preview asset-set-scene-preview";
  stage.dataset.sceneId = sceneId;

  if (!scene) {
    const empty = document.createElement("p");

    empty.textContent = `${sceneId} 무대 조합을 찾지 못했어요.`;
    preview.append(empty);
    return;
  }

  scene.layers
    .filter((layer) => layer.role !== "character")
    .filter((layer) => layer.image || layer.color || layer.role === "background")
    .sort((current, next) => (current.depth ?? 0) - (next.depth ?? 0))
    .forEach((layer) => {
      const layerElement = document.createElement("div");

      layerElement.className = "asset-scene-preview-layer";
      layerElement.style.zIndex = String(layer.depth ?? 0);
      if (layer.placement) {
        layerElement.style.left = `${layer.placement.x}%`;
        layerElement.style.top = `${layer.placement.y}%`;
        layerElement.style.width = `${layer.placement.width}%`;
        layerElement.style.height = `${layer.placement.height}%`;
      } else {
        layerElement.style.inset = "0";
      }

      if (layer.color) {
        layerElement.style.background = layer.color;
      }

      if (layer.image) {
        const image = document.createElement("img");

        image.src = layer.image;
        image.alt = layer.alt ?? layer.id;
        layerElement.append(image);
      }

      stage.append(layerElement);
    });
  preview.append(stage);
}

/**
 * Renders base asset options for Set image selection.
 */
function renderBaseAssetOptions() {
  const baseAssets = filterAssetFiles(savedAssetFiles, ["base"], { includeCommon: false });

  baseAssetSelect.replaceChildren(new Option(baseAssets.length > 0 ? "기본 이미지 선택" : "기본 이미지가 없어요.", ""));
  baseAssets.forEach((assetFile) => {
    baseAssetSelect.append(new Option(createAssetOptionLabel(assetFile), assetFile.path));
  });
}

/**
 * Renders expression options from the saved expression map.
 */
function renderExpressionOptions() {
  const fixedExpressions = new Set(["neutral", "happy", "thinking", "surprised"]);
  const currentValue = surfaceExpressionSelect.value;

  surfaceExpressionSelect.replaceChildren(new Option("없음", ""));
  ["neutral", "happy", "thinking", "surprised"].forEach((expression) => {
    surfaceExpressionSelect.append(new Option(createExpressionLabel(expression), expression));
  });
  Object.keys(existingExpressions)
    .filter((expression) => !fixedExpressions.has(expression))
    .sort((left, right) => left.localeCompare(right))
    .forEach((expression) => {
      surfaceExpressionSelect.append(new Option(createExpressionLabel(expression), expression));
    });

  if (currentValue && Array.from(surfaceExpressionSelect.options).some((option) => option.value === currentValue)) {
    surfaceExpressionSelect.value = currentValue;
  }
}

/**
 * Renders saved scene compositions separately from image files.
 */
function renderSceneOptions() {
  const currentValue = surfaceSceneSelect.value;
  const scenes = Object.values(existingScenes).sort((left, right) =>
    left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" }),
  );

  surfaceSceneSelect.replaceChildren(new Option("무대 조합 사용 안 함", ""));
  scenes.forEach((scene) => {
    surfaceSceneSelect.append(new Option(`${scene.id} / ${scene.layers.length}개 요소`, scene.id));
  });

  if (currentValue && Array.from(surfaceSceneSelect.options).some((option) => option.value === currentValue)) {
    surfaceSceneSelect.value = currentValue;
  }
}

/**
 * Loads saved base image files.
 */
async function loadSavedAssetFiles() {
  const characterId = characterSelect.value || "rine";

  savedAssetFiles = await fetchAssetFiles(characterId);
  renderBaseAssetOptions();
}

/**
 * Loads existing Set and Expression data for the selected character.
 */
async function loadCharacterAssets() {
  const characterId = characterSelect.value || "rine";
  const result = await fetchCharacterAssets(characterId);

  const surfaces = result.assets?.surfaces ?? {};

  existingExpressions = result.assets?.expressions ?? {};
  existingScenes = result.assets?.scenes ?? {};
  renderExpressionOptions();
  renderSceneOptions();
  existingSurfaces = sortExistingSurfaces(Object.entries(surfaces).map(([surfaceId, surface]) => {
    const existingSurface: ExistingSurface = {
      surfaceId: surface.id ?? surfaceId,
      layerCount: Object.keys(surface.layers ?? {}).length,
    };

    if (surface.image) {
      existingSurface.image = surface.image;
    }

    if (surface.visual?.type === "scene") {
      existingSurface.sceneId = surface.visual.sceneId;
    }

    if (surface.expression) {
      existingSurface.expression = surface.expression;
    }

    if (surface.alt) {
      existingSurface.alt = surface.alt;
    }

    return existingSurface;
  }));

  surfaceSelect.replaceChildren(
    new Option("상태 연결 선택", ""),
    new Option("새 상태 연결 만들기", newSurfaceSelectValue),
  );
  existingSurfaces.forEach((surface) => {
    const label = [
      surface.surfaceId,
      surface.expression ? `표정 ${surface.expression}` : "",
      `${surface.layerCount}개 파츠`,
    ].filter(Boolean).join(" / ");

    surfaceSelect.append(new Option(label, surface.surfaceId));
  });

  await loadSavedAssetFiles();
  renderSurfaceIdPresetOptions();
  applySurfaceSelection();
  status.textContent = `${characterId} 상태 연결을 불러왔어요.`;
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
 * Applies the selected Set to the editable fields.
 */
function applySurfaceSelection() {
  deleteButton.disabled = surfaceSelect.value === newSurfaceSelectValue || !surfaceSelect.value;

  if (surfaceSelect.value === newSurfaceSelectValue) {
    surfaceIdInput.value = createNextSurfaceId();
    surfaceExpressionSelect.value = "";
    surfaceAltInput.value = "";
    surfaceImageInput.value = "";
    baseAssetSelect.value = "";
    surfaceSceneSelect.value = "";
    renderSurfaceIdPresetOptions(surfaceIdInput.value);
    renderOutputs();
    return;
  }

  const surface = existingSurfaces.find((item) => item.surfaceId === surfaceSelect.value);

  surfaceIdInput.value = surface?.surfaceId ?? surfaceIdInput.value;
  surfaceExpressionSelect.value = surface?.expression ?? "";
  surfaceAltInput.value = surface?.alt ?? "";
  surfaceImageInput.value = surface?.image ?? "";
  baseAssetSelect.value = surface?.image ?? "";
  surfaceSceneSelect.value = surface?.sceneId ?? "";
  renderSurfaceIdPresetOptions(surfaceIdInput.value);
  renderOutputs();
}

/**
 * Saves the current Set metadata to the selected character.
 */
async function saveSurfaceConfig() {
  const surfaceSnippet = createSurfaceSnippet();
  const validationMessage = validateSurfaceSnippet(surfaceSnippet);

  if (validationMessage) {
    status.textContent = validationMessage;
    return;
  }

  saveButton.disabled = true;
  status.textContent = "상태 연결을 저장하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-character-surface"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: characterSelect.value || "rine",
        surface: surfaceSnippet,
      }),
    });
    const result = await readApiJson<SurfaceSaveResponse>(response);

    if (!response.ok || !result.ok) {
      status.textContent = result.message ?? `상태 연결 저장 실패: ${result.error ?? response.status}`;
      return;
    }

    await loadCharacterAssets();
    surfaceSelect.value = surfaceSnippet.surfaceId;
    status.textContent = `${result.saved?.path ?? "character index.ts"}에 상태 연결을 저장했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "상태 연결 저장 요청에 실패했어요.";
  } finally {
    saveButton.disabled = false;
    renderOutputs();
  }
}

/**
 * Deletes the selected Set from the character surfaces.
 */
async function deleteSurfaceConfig() {
  const surfaceId = surfaceSelect.value;

  if (!surfaceId || surfaceId === newSurfaceSelectValue) {
    status.textContent = "삭제할 기존 상태 연결을 선택하세요.";
    return;
  }

  const confirmed = window.confirm(`${characterSelect.value || "rine"} 캐릭터의 상태 연결 ${surfaceId}를 삭제할까요?\n\n이 표시 상태에 붙은 파츠 설정도 함께 삭제됩니다.`);

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  status.textContent = "상태 연결을 삭제하는 중이에요.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-character-surface"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: characterSelect.value || "rine",
        surfaceId,
      }),
    });
    const result = await readApiJson<SurfaceSaveResponse>(response);

    if (!response.ok || !result.ok) {
      status.textContent = result.message ?? `상태 연결 삭제 실패: ${result.error ?? response.status}`;
      return;
    }

    await loadCharacterAssets();
    status.textContent = `상태 연결 ${surfaceId}를 삭제했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "상태 연결 삭제 요청에 실패했어요.";
  } finally {
    applySurfaceSelection();
  }
}

/**
 * Wires the Set settings page.
 */
function init() {
  characterSelect.addEventListener("change", () => {
    void loadCharacterAssets();
  });
  surfaceSelect.addEventListener("change", applySurfaceSelection);
  surfaceIdPresetSelect.addEventListener("change", applySurfaceIdPresetSelection);
  baseAssetSelect.addEventListener("change", () => {
    surfaceImageInput.value = baseAssetSelect.value;
    if (baseAssetSelect.value) {
      surfaceSceneSelect.value = "";
    }
    renderOutputs();
  });
  surfaceSceneSelect.addEventListener("change", () => {
    if (surfaceSceneSelect.value) {
      surfaceImageInput.value = "";
      baseAssetSelect.value = "";
    }
    renderOutputs();
  });
  surfaceIdInput.addEventListener("input", syncSurfaceIdPresetFromInput);
  surfaceIdInput.addEventListener("change", syncSurfaceIdPresetFromInput);
  [surfaceExpressionSelect, surfaceAltInput, surfaceImageInput].forEach((input) => {
    input.addEventListener("input", renderOutputs);
    input.addEventListener("change", renderOutputs);
  });
  saveButton.addEventListener("click", () => {
    void saveSurfaceConfig();
  });
  deleteButton.addEventListener("click", () => {
    void deleteSurfaceConfig();
  });

  void loadCharacters();
}

init();
