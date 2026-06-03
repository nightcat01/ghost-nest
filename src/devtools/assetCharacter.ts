import { requireElement } from "./assetShared.js";
import type { CharacterWorkspace } from "./assetApi.js";
import { createDevtoolsApiPath, fetchCharacterWorkspace, saveCharacterWorkspace } from "./assetApi.js";

type CreateCharacterResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  created?: {
    characterId: string;
    path: string;
    buildPath?: string | null;
  };
};

const characterIdInput = requireElement(document.querySelector<HTMLInputElement>("#characterIdInput"), "#characterIdInput");
const characterNameInput = requireElement(document.querySelector<HTMLInputElement>("#characterNameInput"), "#characterNameInput");
const characterDescriptionInput = requireElement(document.querySelector<HTMLInputElement>("#characterDescriptionInput"), "#characterDescriptionInput");
const characterToneInput = requireElement(document.querySelector<HTMLInputElement>("#characterToneInput"), "#characterToneInput");
const charactersRootUrlInput = requireElement(document.querySelector<HTMLInputElement>("#charactersRootUrlInput"), "#charactersRootUrlInput");
const commonAssetsRootUrlInput = requireElement(document.querySelector<HTMLInputElement>("#commonAssetsRootUrlInput"), "#commonAssetsRootUrlInput");
const assetPathPreview = requireElement(document.querySelector<HTMLElement>("#assetPathPreview"), "#assetPathPreview");
const createButton = requireElement(document.querySelector<HTMLButtonElement>("#createCharacterButton"), "#createCharacterButton");
const status = requireElement(document.querySelector<HTMLElement>("#characterCreateStatus"), "#characterCreateStatus");
const output = requireElement(document.querySelector<HTMLElement>("#characterCreateOutput"), "#characterCreateOutput");

let workspaceSettings: CharacterWorkspace | null = null;

/**
 * Reads a dev API response while preserving useful server error text.
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
      message: "API가 JSON이 아닌 응답을 보냈어요. 서버를 다시 시작했는지 확인하세요.",
    } as T;
  }
}

/**
 * Normalizes user input into a folder-safe character id preview.
 */
function sanitizeCharacterId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Normalizes browser-facing asset root paths without forcing one host URL shape.
 */
function normalizeBrowserPrefix(value: string, fallback: string) {
  const trimmedValue = value.trim().replaceAll("\\", "/").replace(/\/+$/, "");

  return trimmedValue || fallback;
}

/**
 * Returns the root path placed immediately before each character id.
 */
function getCharactersRootUrl() {
  return normalizeBrowserPrefix(charactersRootUrlInput.value, "./src/characters");
}

/**
 * Returns the root path for shared common assets.
 */
function getCommonAssetsRootUrl() {
  return normalizeBrowserPrefix(commonAssetsRootUrlInput.value, "./src/assets/common");
}

/**
 * Merges edited public asset paths into the persisted workspace settings.
 */
function createWorkspacePayload(): CharacterWorkspace {
  return {
    sourceCharacters: workspaceSettings?.sourceCharacters ?? "src/characters",
    buildCharacters: workspaceSettings?.buildCharacters ?? "src/characters",
    commonAssets: workspaceSettings?.commonAssets ?? "src/assets/common",
    browserSourcePrefix: getCharactersRootUrl(),
    browserCommonPrefix: getCommonAssetsRootUrl(),
    allowLocalhost: workspaceSettings?.allowLocalhost ?? true,
    allowedIps: workspaceSettings?.allowedIps ?? [],
    basePath: workspaceSettings?.basePath ?? "",
  };
}

/**
 * Builds the create-character payload.
 */
function createCharacterPayload() {
  const characterId = sanitizeCharacterId(characterIdInput.value);
  const name = characterNameInput.value.trim() || characterId;

  return {
    characterId,
    name,
    description: characterDescriptionInput.value.trim() || `${name} character`,
    tone: characterToneInput.value.trim() || "차분하고 친근한 말투",
  };
}

/**
 * Refreshes the path examples so asset ownership is visible before creation.
 */
function renderAssetPathPreview() {
  const characterId = sanitizeCharacterId(characterIdInput.value) || "character-id";
  const charactersRootUrl = getCharactersRootUrl();
  const commonAssetsRootUrl = getCommonAssetsRootUrl();
  const characterArticle = document.createElement("article");
  const characterTitle = document.createElement("strong");
  const characterBasePath = document.createElement("span");
  const characterPartsPath = document.createElement("span");
  const commonArticle = document.createElement("article");
  const commonTitle = document.createElement("strong");
  const commonPartsPath = document.createElement("span");
  const commonScenesPath = document.createElement("span");

  characterTitle.textContent = "캐릭터 이미지";
  characterBasePath.textContent = `${charactersRootUrl}/${characterId}/assets/base/`;
  characterPartsPath.textContent = `${charactersRootUrl}/${characterId}/assets/parts/`;
  characterArticle.append(characterTitle, characterBasePath, characterPartsPath);

  commonTitle.textContent = "공통 이미지";
  commonPartsPath.textContent = `${commonAssetsRootUrl}/parts/`;
  commonScenesPath.textContent = `${commonAssetsRootUrl}/scenes/`;
  commonArticle.append(commonTitle, commonPartsPath, commonScenesPath);

  assetPathPreview.replaceChildren(characterArticle, commonArticle);
}

/**
 * Refreshes the JSON preview shown before creation.
 */
function renderOutput() {
  const payload = createCharacterPayload();
  const charactersRootUrl = getCharactersRootUrl();
  const commonAssetsRootUrl = getCommonAssetsRootUrl();

  output.textContent = JSON.stringify({
    create: payload,
    assetPaths: payload.characterId
      ? {
          charactersRootUrl,
          commonAssetsRootUrl,
          characterBase: `${charactersRootUrl}/${payload.characterId}/assets/base/`,
          characterParts: `${charactersRootUrl}/${payload.characterId}/assets/parts/`,
          commonParts: `${commonAssetsRootUrl}/parts/`,
          commonScenes: `${commonAssetsRootUrl}/scenes/`,
        }
      : {},
    files: payload.characterId
      ? [
          `src/characters/${payload.characterId}/profile.ts`,
          `src/characters/${payload.characterId}/lines.ts`,
          `src/characters/${payload.characterId}/index.ts`,
          `src/characters/${payload.characterId}/assets/base`,
          `src/characters/${payload.characterId}/assets/parts`,
        ]
      : [],
  }, null, 2);
  renderAssetPathPreview();
}

/**
 * Loads current workspace paths into the creation page.
 */
async function loadWorkspaceSettings() {
  try {
    workspaceSettings = await fetchCharacterWorkspace();
    charactersRootUrlInput.value = workspaceSettings.browserSourcePrefix;
    commonAssetsRootUrlInput.value = workspaceSettings.browserCommonPrefix;
    renderOutput();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 에셋 경로 설정을 불러오지 못했어요.";
    renderOutput();
  }
}

/**
 * Saves browser-facing asset paths before creating a character.
 */
async function saveWorkspaceSettings() {
  workspaceSettings = await saveCharacterWorkspace(createWorkspacePayload());
  charactersRootUrlInput.value = workspaceSettings.browserSourcePrefix;
  commonAssetsRootUrlInput.value = workspaceSettings.browserCommonPrefix;

  return workspaceSettings;
}

/**
 * Creates a new character scaffold through the dev server.
 */
async function createCharacter() {
  const payload = createCharacterPayload();

  if (!payload.characterId) {
    status.textContent = "캐릭터 ID를 입력하세요.";
    return;
  }

  createButton.disabled = true;
  status.textContent = "에셋 경로를 저장하고 캐릭터를 만드는 중이에요.";

  try {
    await saveWorkspaceSettings();

    const response = await fetch(createDevtoolsApiPath("/api/devtools/create-character"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await readApiJson<CreateCharacterResponse>(response);

    if (!response.ok || !result.ok || !result.created) {
      status.textContent = result.error === "character_already_exists"
        ? "이미 같은 ID의 캐릭터가 있어요."
        : result.message ?? `캐릭터 생성 실패: ${result.error ?? response.status}`;
      return;
    }

    status.textContent = `${result.created.characterId} 캐릭터를 만들었어요. 다음 단계에서 Expression을 등록하세요.`;
    output.textContent = JSON.stringify({
      created: result.created,
      workspace: {
        charactersRootUrl: getCharactersRootUrl(),
        commonAssetsRootUrl: getCommonAssetsRootUrl(),
      },
    }, null, 2);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 생성 요청에 실패했어요.";
  } finally {
    createButton.disabled = false;
  }
}

/**
 * Wires the character creation page.
 */
function init() {
  [
    characterIdInput,
    characterNameInput,
    characterDescriptionInput,
    characterToneInput,
    charactersRootUrlInput,
    commonAssetsRootUrlInput,
  ].forEach((input) => {
    input.addEventListener("input", renderOutput);
    input.addEventListener("change", renderOutput);
  });
  createButton.addEventListener("click", () => {
    void createCharacter();
  });
  renderOutput();
  void loadWorkspaceSettings();
}

init();
