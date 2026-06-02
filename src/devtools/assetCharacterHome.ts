import { enhanceStatusNotice, requireElement } from "./assetShared.js";
import {
  AssetFile,
  CharacterWorkspace,
  CharacterAssetsResponse,
  deleteCharacter,
  fetchAssetFiles,
  fetchCharacterAssets,
  fetchCharacterWorkspace,
  saveCharacterWorkspace,
} from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";

type CharacterProgress = {
  characterId: string;
  baseCount: number;
  partCount: number;
  sceneAssetCount: number;
  expressionCount: number;
  setCount: number;
  layerCount: number;
  sceneCount: number;
};
type StepConfig = {
  id: string;
  title: string;
  description: string;
  href: string;
  required: boolean;
  complete: (progress: CharacterProgress) => boolean;
  detail: (progress: CharacterProgress) => string;
};

const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const summary = requireElement(document.querySelector<HTMLElement>("#characterSummary"), "#characterSummary");
const readinessMap = requireElement(document.querySelector<HTMLElement>("#characterReadinessMap"), "#characterReadinessMap");
const stepList = requireElement(document.querySelector<HTMLElement>("#characterStepList"), "#characterStepList");
const status = requireElement(document.querySelector<HTMLElement>("#characterHomeStatus"), "#characterHomeStatus");
const deleteCharacterButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteCharacterButton"), "#deleteCharacterButton");
const saveWorkspaceButton = requireElement(document.querySelector<HTMLButtonElement>("#saveWorkspaceButton"), "#saveWorkspaceButton");
const workspaceResolvedText = requireElement(document.querySelector<HTMLElement>("#workspaceResolvedText"), "#workspaceResolvedText");
const workspaceInputs = {
  sourceCharacters: requireElement(document.querySelector<HTMLInputElement>("#sourceCharactersInput"), "#sourceCharactersInput"),
  buildCharacters: requireElement(document.querySelector<HTMLInputElement>("#buildCharactersInput"), "#buildCharactersInput"),
  commonAssets: requireElement(document.querySelector<HTMLInputElement>("#commonAssetsInput"), "#commonAssetsInput"),
  browserSourcePrefix: requireElement(document.querySelector<HTMLInputElement>("#browserSourcePrefixInput"), "#browserSourcePrefixInput"),
  browserCommonPrefix: requireElement(document.querySelector<HTMLInputElement>("#browserCommonPrefixInput"), "#browserCommonPrefixInput"),
  allowLocalhost: requireElement(document.querySelector<HTMLInputElement>("#allowLocalhostInput"), "#allowLocalhostInput"),
  devtoolsBasePath: requireElement(document.querySelector<HTMLInputElement>("#devtoolsBasePathInput"), "#devtoolsBasePathInput"),
  allowedIps: requireElement(document.querySelector<HTMLTextAreaElement>("#allowedIpsInput"), "#allowedIpsInput"),
};

const emptyProgress: CharacterProgress = {
  characterId: "",
  baseCount: 0,
  partCount: 0,
  sceneAssetCount: 0,
  expressionCount: 0,
  setCount: 0,
  layerCount: 0,
  sceneCount: 0,
};

const steps: StepConfig[] = [
  {
    id: "create",
    title: "1. 캐릭터 만들기",
    description: "캐릭터 폴더와 기본 설정 파일을 만듭니다. 이미지 한 장만 쓰고 싶어도 여기서 시작합니다.",
    href: "./dev-character-create.html",
    required: true,
    complete: (progress) => Boolean(progress.characterId),
    detail: (progress) => progress.characterId ? `${progress.characterId} 선택됨` : "먼저 캐릭터를 만들어야 해요.",
  },
  {
    id: "expression",
    title: "2. 표정 이미지 등록",
    description: "neutral, happy 같은 저장 키에 사용자가 알아볼 표정 이름과 기본 이미지 후보를 연결합니다.",
    href: "./dev-character-expression.html",
    required: true,
    complete: (progress) => progress.expressionCount > 0,
    detail: (progress) => `${progress.expressionCount}개 표정 / ${progress.baseCount}개 기본 이미지`,
  },
  {
    id: "set",
    title: "3. 캐릭터 상태 만들기",
    description: "표정 후보 중 실제로 쓸 기본 이미지나 장면 조합을 골라 파츠를 붙일 기준 상태를 만듭니다.",
    href: "./dev-character-set.html",
    required: true,
    complete: (progress) => progress.setCount > 0,
    detail: (progress) => `${progress.setCount}개 상태`,
  },
  {
    id: "layer",
    title: "4. 파츠 / 애니메이션 추가",
    description: "눈깜빡임, 말할 때 입모양, 장식 같은 파츠를 특정 상태 위에 얹습니다.",
    href: "./dev-assets-layer.html",
    required: false,
    complete: (progress) => progress.layerCount > 0,
    detail: (progress) => `${progress.layerCount}개 파츠 움직임 / ${progress.partCount}개 파츠 이미지`,
  },
  {
    id: "scene",
    title: "5. 배경 / 소품 배치",
    description: "배경, 책상, 앞쪽 소품, FX를 캐릭터 바깥의 무대 조합으로 저장합니다.",
    href: "./dev-character-scene.html",
    required: false,
    complete: (progress) => progress.sceneCount > 0,
    detail: (progress) => `${progress.sceneCount}개 무대 조합 / ${progress.sceneAssetCount}개 무대 재료 이미지`,
  },
  {
    id: "crop",
    title: "보조. 영역 선택",
    description: "base 이미지에서 눈, 입 같은 파츠를 만들 영역을 잡을 때 사용합니다.",
    href: "./dev-assets-crop.html",
    required: false,
    complete: (progress) => progress.partCount > 0,
    detail: (progress) => progress.partCount > 0 ? "파츠 재료가 있어요." : "필요할 때만 사용하세요.",
  },
];

/**
 * Counts layer entries across every saved character state.
 */
function countLayers(surfaces: CharacterAssetsResponse["assets"] extends infer Assets
  ? Assets extends { surfaces?: infer Surfaces } ? Surfaces : never
  : never) {
  if (!surfaces || typeof surfaces !== "object") {
    return 0;
  }

  return Object.values(surfaces).reduce((total, surface) => {
    if (!surface || typeof surface !== "object" || !("layers" in surface)) {
      return total;
    }

    const layers = surface.layers;

    return total + (layers && typeof layers === "object" ? Object.keys(layers).length : 0);
  }, 0);
}

/**
 * Builds a progress snapshot from character assets and saved image files.
 */
function createProgress(characterId: string, assetsResult: CharacterAssetsResponse, files: AssetFile[]): CharacterProgress {
  const assets = assetsResult.assets ?? {};
  const characterFiles = files.filter((file) => file.scope !== "common");
  const surfaces = assets.surfaces ?? {};
  const scenes = assets.scenes ?? {};

  return {
    characterId,
    baseCount: characterFiles.filter((file) => file.kind === "base").length,
    partCount: characterFiles.filter((file) => file.kind === "part").length,
    sceneAssetCount: characterFiles.filter((file) => file.kind === "scene").length,
    expressionCount: Object.keys(assets.expressions ?? {}).length,
    setCount: Object.keys(surfaces).length,
    layerCount: countLayers(surfaces),
    sceneCount: Object.keys(scenes).length,
  };
}

/**
 * Renders one compact summary stat.
 */
function createSummaryItem(label: string, value: string | number, isReady: boolean) {
  const item = document.createElement("div");
  const valueElement = document.createElement("strong");
  const labelElement = document.createElement("span");

  item.className = "asset-character-summary-item";
  item.dataset.ready = String(isReady);
  valueElement.textContent = String(value);
  labelElement.textContent = label;
  item.append(valueElement, labelElement);

  return item;
}

/**
 * Renders the current character progress numbers.
 */
function renderSummary(progress: CharacterProgress) {
  summary.replaceChildren(
    createSummaryItem("기본 이미지", progress.baseCount, progress.baseCount > 0),
    createSummaryItem("표정", progress.expressionCount, progress.expressionCount > 0),
    createSummaryItem("캐릭터 상태", progress.setCount, progress.setCount > 0),
    createSummaryItem("파츠 움직임", progress.layerCount, progress.layerCount > 0),
    createSummaryItem("무대 조합", progress.sceneCount, progress.sceneCount > 0),
  );
}

/**
 * Creates one node in the character-centered material map.
 */
function createReadinessNode(title: string, detail: string, state: "ready" | "missing" | "optional") {
  const node = document.createElement("article");
  const titleElement = document.createElement("strong");
  const detailElement = document.createElement("span");

  node.className = "asset-character-readiness-node";
  node.dataset.state = state;
  titleElement.textContent = title;
  detailElement.textContent = detail;
  node.append(titleElement, detailElement);

  return node;
}

/**
 * Renders how the selected character will appear as reusable mapping materials.
 */
function renderReadinessMap(progress: CharacterProgress) {
  const characterLabel = progress.characterId || "캐릭터 미선택";
  const nodes = [
    createReadinessNode("나니카 실행", "나니카가 실행되는 가장 큰 영역입니다.", "ready"),
    createReadinessNode(
      characterLabel,
      progress.characterId ? "이 캐릭터를 기준으로 재료를 연결합니다." : "먼저 캐릭터를 만들거나 선택하세요.",
      progress.characterId ? "ready" : "missing",
    ),
    createReadinessNode(
      "표정",
      `${progress.expressionCount}개 표정 후보`,
      progress.expressionCount > 0 ? "ready" : "missing",
    ),
    createReadinessNode(
      "캐릭터 상태",
      `${progress.setCount}개 실제 표시 상태`,
      progress.setCount > 0 ? "ready" : "missing",
    ),
    createReadinessNode(
      "파츠 움직임",
      `${progress.layerCount}개 보조 움직임`,
      progress.layerCount > 0 ? "ready" : "optional",
    ),
    createReadinessNode(
      "무대 조합",
      `${progress.sceneCount}개 이미지 그룹`,
      progress.sceneCount > 0 ? "ready" : "optional",
    ),
    createReadinessNode(
      "기능 연결",
      progress.setCount > 0 ? "행동에 연결할 기본 재료가 준비됐습니다." : "표정과 캐릭터 상태를 먼저 준비하세요.",
      progress.setCount > 0 ? "ready" : "missing",
    ),
  ];

  readinessMap.replaceChildren(...nodes);
}

/**
 * Finds the first required step that still needs work.
 */
function findNextRequiredStep(progress: CharacterProgress) {
  return steps.find((step) => step.required && !step.complete(progress));
}

/**
 * Renders one production step card.
 */
function createStepCard(step: StepConfig, progress: CharacterProgress, nextStepId: string | null) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const badge = document.createElement("span");
  const description = document.createElement("p");
  const detail = document.createElement("small");
  const action = document.createElement("a");
  const isComplete = step.complete(progress);
  const isNext = nextStepId === step.id;

  card.className = "asset-character-step-card";
  card.dataset.state = isComplete ? "complete" : isNext ? "next" : step.required ? "required" : "optional";
  header.className = "asset-character-step-header";
  title.textContent = step.title;
  badge.textContent = isComplete ? "완료" : isNext ? "다음" : step.required ? "필요" : "선택";
  description.textContent = step.description;
  detail.textContent = step.detail(progress);
  action.href = step.href;
  action.textContent = isComplete ? "다시 편집" : isNext ? "이 단계 시작" : "열기";
  action.className = "asset-primary-link";
  header.append(title, badge);
  card.append(header, description, detail, action);

  return card;
}

/**
 * Renders all production steps in the recommended order.
 */
function renderSteps(progress: CharacterProgress) {
  const nextStep = findNextRequiredStep(progress);

  stepList.replaceChildren(...steps.map((step) => createStepCard(step, progress, nextStep?.id ?? null)));
}

/**
 * Applies workspace config values to the path form.
 */
function renderWorkspace(workspace: CharacterWorkspace) {
  workspaceInputs.sourceCharacters.value = workspace.sourceCharacters;
  workspaceInputs.buildCharacters.value = workspace.buildCharacters;
  workspaceInputs.commonAssets.value = workspace.commonAssets;
  workspaceInputs.browserSourcePrefix.value = workspace.browserSourcePrefix;
  workspaceInputs.browserCommonPrefix.value = workspace.browserCommonPrefix;
  workspaceInputs.allowLocalhost.checked = workspace.devServer?.allowLocalhost ?? workspace.allowLocalhost ?? true;
  workspaceInputs.devtoolsBasePath.value = workspace.devServer?.basePath ?? workspace.basePath ?? "";
  workspaceInputs.allowedIps.value = (workspace.devServer?.allowedIps ?? workspace.allowedIps ?? []).join("\n");
  workspaceResolvedText.textContent = workspace.resolved
    ? `현재 해석된 경로: 캐릭터 ${workspace.resolved.sourceCharacters} / 빌드 ${workspace.resolved.buildCharacters} / 공통 ${workspace.resolved.commonAssets}`
    : "작업 경로가 설정되어 있어요.";
}

/**
 * Reads workspace form values for saving.
 */
function readWorkspaceForm(): CharacterWorkspace {
  return {
    sourceCharacters: workspaceInputs.sourceCharacters.value.trim(),
    buildCharacters: workspaceInputs.buildCharacters.value.trim(),
    commonAssets: workspaceInputs.commonAssets.value.trim(),
    browserSourcePrefix: workspaceInputs.browserSourcePrefix.value.trim(),
    browserCommonPrefix: workspaceInputs.browserCommonPrefix.value.trim(),
    allowLocalhost: workspaceInputs.allowLocalhost.checked,
    basePath: workspaceInputs.devtoolsBasePath.value.trim(),
    allowedIps: workspaceInputs.allowedIps.value
      .split(/\r?\n|,/)
      .map((ip) => ip.trim())
      .filter(Boolean),
  };
}

/**
 * Enables destructive actions only when a character is selected.
 */
function renderCharacterActions() {
  deleteCharacterButton.disabled = !characterSelect.value;
}

/**
 * Loads a selected character and refreshes the dashboard.
 */
async function loadCharacterProgress(characterId: string) {
  if (!characterId) {
    renderSummary(emptyProgress);
    renderReadinessMap(emptyProgress);
    renderSteps(emptyProgress);
    renderCharacterActions();
    status.textContent = "먼저 캐릭터를 만들거나 선택하세요.";
    return;
  }

  status.textContent = `${characterId} 캐릭터 상태를 확인하는 중이에요.`;

  const [assetsResult, assetFiles] = await Promise.all([
    fetchCharacterAssets(characterId),
    fetchAssetFiles(characterId),
  ]);

  const progress = createProgress(characterId, assetsResult, assetFiles);
  const nextStep = findNextRequiredStep(progress);

  renderSummary(progress);
  renderReadinessMap(progress);
  renderSteps(progress);
  renderCharacterActions();
  status.textContent = nextStep
    ? `다음 추천 단계는 "${nextStep.title}"입니다.`
    : "필수 단계가 준비됐어요. 파츠, 무대, 테스트를 더해보세요.";
}

/**
 * Loads available characters and selects a useful default.
 */
async function loadCharacters() {
  try {
    const selectedCharacterId = await populateCharacterSelect(characterSelect);

    if (!selectedCharacterId) {
        renderSummary(emptyProgress);
        renderReadinessMap(emptyProgress);
        renderSteps(emptyProgress);
      renderCharacterActions();
      status.textContent = "캐릭터가 없어요. 작업 경로가 맞는지 확인한 뒤 새 캐릭터 만들기부터 시작하세요.";
      return;
    }

    await loadCharacterProgress(selectedCharacterId);
  } catch (error) {
    renderSummary(emptyProgress);
    renderReadinessMap(emptyProgress);
    renderSteps(emptyProgress);
    renderCharacterActions();
    status.textContent = error instanceof Error ? error.message : "캐릭터 목록을 불러오지 못했어요.";
  }
}

/**
 * Loads workspace path settings into the dashboard.
 */
async function loadWorkspace() {
  try {
    renderWorkspace(await fetchCharacterWorkspace());
  } catch (error) {
    workspaceResolvedText.textContent = error instanceof Error ? error.message : "작업 경로를 불러오지 못했어요.";
  }
}

/**
 * Saves workspace path settings and reloads character state from the new location.
 */
async function saveWorkspaceConfig() {
  saveWorkspaceButton.disabled = true;
  status.textContent = "작업 경로를 저장하는 중이에요.";

  try {
    renderWorkspace(await saveCharacterWorkspace(readWorkspaceForm()));
    status.textContent = "작업 경로를 저장했어요. 캐릭터 목록을 다시 불러옵니다.";
    await loadCharacters();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "작업 경로 저장 요청에 실패했어요.";
  } finally {
    saveWorkspaceButton.disabled = false;
  }
}

/**
 * Deletes the selected character after an explicit user confirmation.
 */
async function deleteSelectedCharacter() {
  const characterId = characterSelect.value;

  if (!characterId) {
    status.textContent = "삭제할 캐릭터를 먼저 선택하세요.";
    return;
  }

  const confirmed = window.confirm(`${characterId} 캐릭터 폴더와 저장된 에셋을 삭제할까요?\n\nsrc/characters/${characterId} 전체가 삭제됩니다.`);

  if (!confirmed) {
    return;
  }

  deleteCharacterButton.disabled = true;
  status.textContent = `${characterId} 캐릭터를 삭제하는 중이에요.`;

  try {
    const deleted = await deleteCharacter(characterId);

    status.textContent = `${deleted?.characterId ?? characterId} 캐릭터를 삭제했어요.`;
    await loadCharacters();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 삭제 요청에 실패했어요.";
  } finally {
    renderCharacterActions();
  }
}

/**
 * Wires the character production dashboard.
 */
function init() {
  enhanceStatusNotice(status);
  characterSelect.addEventListener("change", () => {
    renderCharacterActions();
    loadCharacterProgress(characterSelect.value).catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : "캐릭터 상태를 불러오지 못했어요.";
    });
  });
  deleteCharacterButton.addEventListener("click", () => {
    void deleteSelectedCharacter();
  });
  saveWorkspaceButton.addEventListener("click", () => {
    void saveWorkspaceConfig();
  });
  renderSummary(emptyProgress);
  renderReadinessMap(emptyProgress);
  renderSteps(emptyProgress);
  renderCharacterActions();
  void loadWorkspace();
  void loadCharacters();
}

init();
