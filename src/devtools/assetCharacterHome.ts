import { enhanceStatusNotice, requireElement } from "./assetShared.js";
import {
  AssetFile,
  CharacterWorkspace,
  CharacterAssetsResponse,
  CharacterSurfaceAsset,
  deleteCharacter,
  fetchAssetFiles,
  fetchCharacterAssets,
  fetchCharacterWorkspace,
  saveCharacterWorkspace,
} from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { defaultNanikaCommonKeys, type NanikaCommonKeyDefinition } from "../plugins/nanikaMapping/index.js";

type CharacterProgress = {
  characterId: string;
  baseCount: number;
  partCount: number;
  sceneAssetCount: number;
  expressionCount: number;
  dialogueCount: number;
  stateCount: number;
  layerCount: number;
  stageCount: number;
};

type StepConfig = {
  id: string;
  title: string;
  lane: "character" | "material" | "support";
  description: string;
  href: string;
  required: boolean;
  requiresCharacter: boolean;
  complete: (progress: CharacterProgress) => boolean;
  detail: (progress: CharacterProgress) => string;
};

const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const summary = requireElement(document.querySelector<HTMLElement>("#characterSummary"), "#characterSummary");
const readinessMap = requireElement(document.querySelector<HTMLElement>("#characterReadinessMap"), "#characterReadinessMap");
const commonKeyRegistry = requireElement(document.querySelector<HTMLElement>("#commonKeyRegistry"), "#commonKeyRegistry");
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
  dialogueCount: 0,
  stateCount: 0,
  layerCount: 0,
  stageCount: 0,
};

const steps: StepConfig[] = [
  {
    id: "character",
    title: "1. 캐릭터 만들기",
    lane: "character",
    description: "작업의 기준이 되는 캐릭터 폴더와 기본 설정을 만듭니다.",
    href: "./dev-character-create.html",
    required: true,
    requiresCharacter: false,
    complete: (progress) => Boolean(progress.characterId),
    detail: (progress) => progress.characterId ? `${progress.characterId} 선택됨` : "먼저 캐릭터가 필요합니다.",
  },
  {
    id: "base",
    title: "2. 표정 만들기",
    lane: "character",
    description: "표정 이름과 기본 이미지를 연결합니다. 이후 캐릭터 상태의 재료가 됩니다.",
    href: "./dev-character-expression.html",
    required: true,
    requiresCharacter: true,
    complete: (progress) => progress.expressionCount > 0,
    detail: (progress) => `${progress.expressionCount}개 표정 / ${progress.baseCount}개 기본 이미지`,
  },
  {
    id: "dialogue",
    title: "3. 대사 만들기",
    lane: "character",
    description: "말풍선에서 사용할 기본 대사 묶음을 준비합니다. 매핑의 대사 액션이 여기 있는 카테고리를 사용합니다.",
    href: "./dev-character-dialogue.html",
    required: true,
    requiresCharacter: true,
    complete: (progress) => progress.dialogueCount > 0,
    detail: (progress) => `${progress.dialogueCount}개 대사 묶음`,
  },
  {
    id: "state",
    title: "4. 상태 연결하기",
    lane: "character",
    description: "이미 만든 표정, 기본 이미지, 무대 조합을 런타임 표시 상태에 연결합니다.",
    href: "./dev-character-set.html",
    required: true,
    requiresCharacter: true,
    complete: (progress) => progress.stateCount > 0,
    detail: (progress) => `${progress.stateCount}개 표시 상태`,
  },
  {
    id: "crop",
    title: "영역 선택",
    lane: "support",
    description: "큰 이미지에서 눈, 입, 장식처럼 필요한 파츠 영역을 잘라냅니다.",
    href: "./dev-assets-crop.html",
    required: false,
    requiresCharacter: false,
    complete: (progress) => progress.partCount > 0,
    detail: (progress) => progress.partCount > 0 ? `${progress.partCount}개 파츠 이미지` : "필요할 때만 사용합니다.",
  },
  {
    id: "layer",
    title: "5. 파츠 움직임 만들기",
    lane: "material",
    description: "눈 깜빡임, 입모양처럼 특정 캐릭터 상태 위에서 움직일 파츠를 만듭니다.",
    href: "./dev-assets-layer.html",
    required: false,
    requiresCharacter: true,
    complete: (progress) => progress.layerCount > 0,
    detail: (progress) => `${progress.layerCount}개 파츠 움직임 / ${progress.partCount}개 파츠 이미지`,
  },
  {
    id: "stage",
    title: "6. 무대 조합 만들기",
    lane: "material",
    description: "배경, 책상, 소품, FX를 한 묶음으로 배치해 캐릭터 주변 무대를 만듭니다.",
    href: "./dev-character-scene.html",
    required: false,
    requiresCharacter: true,
    complete: (progress) => progress.stageCount > 0,
    detail: (progress) => `${progress.stageCount}개 무대 조합 / ${progress.sceneAssetCount}개 무대 재료`,
  },
];

/**
 * Counts layer entries across every saved character state.
 */
function countLayers(surfaces: Record<string, CharacterSurfaceAsset> | undefined) {
  if (!surfaces || typeof surfaces !== "object") {
    return 0;
  }

  return Object.values(surfaces).reduce((total, surface) => {
    const layers = surface?.layers;

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
    dialogueCount: Object.keys(assetsResult.lines ?? {}).length,
    stateCount: Object.keys(surfaces).length,
    layerCount: countLayers(surfaces),
    stageCount: Object.keys(scenes).length,
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
    createSummaryItem("대사", progress.dialogueCount, progress.dialogueCount > 0),
    createSummaryItem("상태 연결", progress.stateCount, progress.stateCount > 0),
    createSummaryItem("파츠 움직임", progress.layerCount, progress.layerCount > 0),
    createSummaryItem("무대 조합", progress.stageCount, progress.stageCount > 0),
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
 * Renders how the selected character moves through material and composition stages.
 */
function renderReadinessMap(progress: CharacterProgress) {
  const characterLabel = progress.characterId || "캐릭터 미선택";
  const nodes = [
    createReadinessNode("재료", `${progress.baseCount + progress.partCount + progress.sceneAssetCount}개 이미지 재료`, progress.baseCount > 0 ? "ready" : "missing"),
    createReadinessNode(characterLabel, progress.characterId ? "이 캐릭터를 기준으로 조합합니다." : "먼저 캐릭터를 만들거나 선택하세요.", progress.characterId ? "ready" : "missing"),
    createReadinessNode("표정", `${progress.expressionCount}개 표정 후보`, progress.expressionCount > 0 ? "ready" : "missing"),
    createReadinessNode("대사", `${progress.dialogueCount}개 대사 묶음`, progress.dialogueCount > 0 ? "ready" : "missing"),
    createReadinessNode("상태 연결", `${progress.stateCount}개 실제 표시 상태`, progress.stateCount > 0 ? "ready" : "missing"),
    createReadinessNode("파츠 움직임", `${progress.layerCount}개 보조 움직임`, progress.layerCount > 0 ? "ready" : "optional"),
    createReadinessNode("무대 조합", `${progress.stageCount}개 배경/소품 묶음`, progress.stageCount > 0 ? "ready" : "optional"),
    createReadinessNode("다음 도구", progress.stateCount > 0 ? "기능 연결과 런타임 테스트로 넘어갈 수 있습니다." : "상태 연결을 먼저 준비하세요.", progress.stateCount > 0 ? "ready" : "missing"),
  ];

  readinessMap.replaceChildren(...nodes);
}

/**
 * Reads the part after the common role namespace.
 */
function getCommonKeyTargetId(key: string) {
  const [, ...parts] = key.split(".");

  return parts.join(".");
}

/**
 * Finds a likely character resource that can satisfy one shared Nanika role key.
 */
function findCommonKeyBinding(key: NanikaCommonKeyDefinition, assetsResult?: CharacterAssetsResponse) {
  const assets = assetsResult?.assets ?? {};
  const targetId = getCommonKeyTargetId(key.key);
  const lastSegment = targetId.split(".").filter(Boolean).at(-1) ?? targetId;

  if (key.kind === "expression" && assets.expressions?.[targetId]) {
    return targetId;
  }

  if (key.kind === "surface" && assets.surfaces?.[targetId]) {
    return targetId;
  }

  if (key.kind === "scene") {
    if (targetId === "default" && assets.defaultScene) {
      return assets.defaultScene;
    }

    if (assets.scenes?.[targetId]) {
      return targetId;
    }
  }

  if (key.kind === "layer") {
    const layerCandidates = [targetId, lastSegment, targetId.split(".")[0]]
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
    const layerIds = new Set(
      Object.values(assets.surfaces ?? {})
        .flatMap((surface) => Object.keys(surface.layers ?? {})),
    );

    return layerCandidates.find((candidate) => layerIds.has(candidate));
  }

  if (key.kind === "hitArea") {
    const hitAreas = (assets as { hitAreas?: Record<string, unknown> }).hitAreas ?? {};

    if (hitAreas[targetId]) {
      return targetId;
    }

    if (hitAreas[lastSegment]) {
      return lastSegment;
    }
  }

  return undefined;
}

/**
 * Creates one card that explains whether a shared role key is connected for this character.
 */
function createCommonKeyCard(key: NanikaCommonKeyDefinition, assetsResult?: CharacterAssetsResponse) {
  const card = document.createElement("article");
  const title = document.createElement("strong");
  const keyText = document.createElement("code");
  const detail = document.createElement("span");
  const binding = findCommonKeyBinding(key, assetsResult);

  card.className = "asset-common-key-card";
  card.dataset.kind = key.kind;
  card.dataset.state = binding ? "bound" : key.required ? "missing" : "optional";
  title.textContent = key.label;
  keyText.textContent = key.key;
  detail.textContent = binding
    ? `연결 대상: ${binding}`
    : key.required
      ? "필수 역할이지만 아직 연결할 재료를 찾지 못했어요."
      : "선택 역할입니다. 필요할 때 같은 key로 연결하면 됩니다.";
  card.append(title, keyText, detail);

  return card;
}

/**
 * Renders shared role keys so character resources can be matched across pages and profiles.
 */
function renderCommonKeyRegistry(assetsResult?: CharacterAssetsResponse) {
  const heading = document.createElement("div");
  const title = document.createElement("h3");
  const help = document.createElement("p");
  const cards = document.createElement("div");

  heading.className = "asset-common-key-heading";
  title.textContent = "공통 역할 key";
  help.textContent = "파일명은 달라도 같은 역할 key를 쓰면 런타임 프로필과 매핑 세트가 캐릭터별 재료를 찾아갈 수 있어요.";
  cards.className = "asset-common-key-grid";
  cards.replaceChildren(...defaultNanikaCommonKeys.map((key) => createCommonKeyCard(key, assetsResult)));
  heading.append(title, help);
  commonKeyRegistry.replaceChildren(heading, cards);
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
  const isLocked = step.requiresCharacter && !progress.characterId;
  const isComplete = step.complete(progress);
  const isNext = nextStepId === step.id;

  card.className = "asset-character-step-card";
  card.dataset.lane = step.lane;
  card.dataset.state = isLocked ? "locked" : isComplete ? "complete" : isNext ? "next" : step.required ? "required" : "optional";
  header.className = "asset-character-step-header";
  title.textContent = step.title;
  badge.textContent = isLocked ? "잠김" : isComplete ? "완료" : isNext ? "다음" : step.required ? "필수" : "선택";
  description.textContent = step.description;
  detail.textContent = isLocked ? "캐릭터를 먼저 선택해야 사용할 수 있습니다." : step.detail(progress);
  action.href = isLocked ? "./dev-character-create.html" : step.href;
  action.textContent = isLocked ? "캐릭터 먼저 만들기" : isComplete ? "다시 열기" : isNext ? "다음 단계 시작" : "열기";
  action.className = "asset-primary-link";
  header.append(title, badge);
  card.append(header, description, detail, action);

  return card;
}

/**
 * Creates one lane for the left-to-right production queue.
 */
function createLane(title: string, description: string, lane: StepConfig["lane"], progress: CharacterProgress, nextStepId: string | null) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const heading = document.createElement("h3");
  const help = document.createElement("p");
  const cards = steps.filter((step) => step.lane === lane).map((step) => createStepCard(step, progress, nextStepId));

  section.className = "asset-production-lane";
  section.dataset.lane = lane;
  header.className = "asset-production-lane-header";
  heading.textContent = title;
  help.textContent = description;
  header.append(heading, help);
  section.append(header, ...cards);

  return section;
}

/**
 * Creates follow-up links that live outside the character setting workflow.
 */
function createExternalNextSteps(progress: CharacterProgress) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const heading = document.createElement("h3");
  const help = document.createElement("p");
  const links = document.createElement("div");
  const mappingLink = document.createElement("a");
  const runtimeLink = document.createElement("a");

  section.className = "asset-production-lane asset-production-lane-external";
  header.className = "asset-production-lane-header";
  heading.textContent = "다음으로 넘어갈 작업";
  help.textContent = progress.stateCount > 0
    ? "캐릭터 설정이 준비되면 별도 도구에서 기능 연결과 런타임 테스트를 진행합니다."
    : "상태 연결을 만든 뒤 별도 도구로 넘어가는 것이 좋습니다.";
  links.className = "asset-lab-button-row";
  mappingLink.className = "asset-primary-link";
  mappingLink.href = "./dev-nanika-mapping.html";
  mappingLink.textContent = "기능 연결 열기";
  runtimeLink.className = "asset-primary-link";
  runtimeLink.href = "./index.html";
  runtimeLink.textContent = "런타임 테스트 열기";
  header.append(heading, help);
  links.append(mappingLink, runtimeLink);
  section.append(header, links);

  return section;
}

/**
 * Renders all production steps in the recommended left-to-right order.
 */
function renderSteps(progress: CharacterProgress) {
  const nextStep = findNextRequiredStep(progress);

  stepList.replaceChildren(
    createLane("캐릭터 흐름", "캐릭터와 표정을 만들고, 실제 표시 상태에 재료를 연결합니다.", "character", progress, nextStep?.id ?? null),
    createLane("재료 편집", "파츠 움직임과 무대 조합처럼 상태에 붙일 재료를 만듭니다.", "material", progress, nextStep?.id ?? null),
    createLane("보조 도구", "필요할 때만 이미지 영역 선택을 사용합니다.", "support", progress, nextStep?.id ?? null),
    createExternalNextSteps(progress),
  );
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
    : "작업 경로가 설정되어 있습니다.";
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
    renderCommonKeyRegistry();
    renderSteps(emptyProgress);
    renderCharacterActions();
    status.textContent = "먼저 캐릭터를 만들거나 선택하세요. 캐릭터가 있어야 표정, 상태, 파츠, 무대 조합을 진행할 수 있습니다.";
    return;
  }

  status.textContent = `${characterId} 상태 연결을 확인하는 중입니다.`;

  const [assetsResult, assetFiles] = await Promise.all([
    fetchCharacterAssets(characterId),
    fetchAssetFiles(characterId),
  ]);

  const progress = createProgress(characterId, assetsResult, assetFiles);
  const nextStep = findNextRequiredStep(progress);

  renderSummary(progress);
  renderReadinessMap(progress);
  renderCommonKeyRegistry(assetsResult);
  renderSteps(progress);
  renderCharacterActions();
  status.textContent = nextStep
    ? `다음 추천 단계는 "${nextStep.title}"입니다. 캐릭터 설정 안에서는 1번부터 5번 순서로 진행하세요.`
    : "필수 단계가 준비됐습니다. 파츠와 무대 조합을 더하거나 별도 기능 연결 도구로 넘어갈 수 있습니다.";
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
      renderCommonKeyRegistry();
      renderSteps(emptyProgress);
      renderCharacterActions();
      status.textContent = "캐릭터가 없습니다. 새 캐릭터 만들기에서 시작하세요.";
      return;
    }

    await loadCharacterProgress(selectedCharacterId);
  } catch (error) {
    renderSummary(emptyProgress);
    renderReadinessMap(emptyProgress);
    renderCommonKeyRegistry();
    renderSteps(emptyProgress);
    renderCharacterActions();
    status.textContent = error instanceof Error ? error.message : "캐릭터 목록을 불러오지 못했습니다.";
  }
}

/**
 * Loads workspace path settings into the dashboard.
 */
async function loadWorkspace() {
  try {
    renderWorkspace(await fetchCharacterWorkspace());
  } catch (error) {
    workspaceResolvedText.textContent = error instanceof Error ? error.message : "작업 경로를 불러오지 못했습니다.";
  }
}

/**
 * Saves workspace path settings and reloads character state from the new location.
 */
async function saveWorkspaceConfig() {
  saveWorkspaceButton.disabled = true;
  status.textContent = "작업 경로를 저장하는 중입니다.";

  try {
    renderWorkspace(await saveCharacterWorkspace(readWorkspaceForm()));
    status.textContent = "작업 경로를 저장했습니다. 캐릭터 목록을 다시 불러옵니다.";
    await loadCharacters();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "작업 경로 저장 요청이 실패했습니다.";
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
  status.textContent = `${characterId} 캐릭터를 삭제하는 중입니다.`;

  try {
    const deleted = await deleteCharacter(characterId);

    status.textContent = `${deleted?.characterId ?? characterId} 캐릭터를 삭제했습니다.`;
    await loadCharacters();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 삭제 요청이 실패했습니다.";
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
      status.textContent = error instanceof Error ? error.message : "캐릭터 상태를 불러오지 못했습니다.";
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
  renderCommonKeyRegistry();
  renderSteps(emptyProgress);
  renderCharacterActions();
  void loadWorkspace();
  void loadCharacters();
}

init();
