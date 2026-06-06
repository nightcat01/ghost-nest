import type { CharacterAssets, CharacterDefinition, ManagementMenuItem, RuntimeAction } from "../core/types.js";
import {
  createDemoDeveloperMenuItems,
  createDemoManagementMenuItems,
  createDemoUserMenuItems,
} from "../demo/demoManagementMenu.js";
import { fetchCharacterAssets } from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";
import { requireElement } from "./assetShared.js";

type MenuMode = "user" | "developer" | "all";

const menuModes = [
  { id: "user", label: "사용자 메뉴", description: "실제 사용자에게 보여주기 좋은 메뉴만 봅니다." },
  { id: "developer", label: "개발자 메뉴", description: "설정, 진단, 개발 도구 메뉴만 봅니다." },
  { id: "all", label: "전체 데모 메뉴", description: "사용자 메뉴와 개발자 메뉴를 모두 포함합니다." },
] satisfies Array<{ id: MenuMode; label: string; description: string }>;

const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const modeList = requireElement(document.querySelector<HTMLElement>("#menuModeList"), "#menuModeList");
const menuTree = requireElement(document.querySelector<HTMLElement>("#menuTree"), "#menuTree");
const output = requireElement(document.querySelector<HTMLElement>("#menuOutput"), "#menuOutput");
const status = requireElement(document.querySelector<HTMLElement>("#menuStatus"), "#menuStatus");
const copyButton = requireElement(document.querySelector<HTMLButtonElement>("#copyMenuJsonButton"), "#copyMenuJsonButton");

let currentMode: MenuMode = "user";
let currentCharacter: CharacterDefinition | undefined;
let currentItems: ManagementMenuItem[] = [];

function createCharacterShell(characterId: string, assets: Awaited<ReturnType<typeof fetchCharacterAssets>>["assets"]): CharacterDefinition {
  const characterAssets: CharacterAssets = {
    alt: assets?.alt ?? characterId,
    expressions: assets?.expressions ?? {},
  };

  if (assets?.surfaces) {
    characterAssets.surfaces = assets.surfaces as NonNullable<CharacterAssets["surfaces"]>;
  }

  if (assets?.defaultScene) {
    characterAssets.defaultScene = assets.defaultScene;
  }

  if (assets?.scenes) {
    characterAssets.scenes = assets.scenes;
  }

  if (assets?.hitAreas) {
    characterAssets.hitAreas = assets.hitAreas as NonNullable<CharacterAssets["hitAreas"]>;
  }

  return {
    profile: {
      id: characterId,
      name: characterId,
      description: `${characterId} 캐릭터 메뉴 설정용 임시 프로필입니다.`,
      tone: "friendly",
      defaultExpression: "neutral",
    },
    lines: {},
    assets: characterAssets,
  };
}

function summarizeAction(action: RuntimeAction) {
  const data = action as Record<string, unknown>;

  if (action.type === "open_management_menu") {
    return `하위 메뉴 열기: ${String(data.menuId ?? data.title ?? "직접 메뉴")}`;
  }

  if (action.type === "speak") {
    return `대사 말하기: ${String(data.category ?? "")}`;
  }

  if (action.type === "speak_text") {
    return "고정 대사 말하기";
  }

  if (action.type === "surface") {
    return `상태 변경: ${String(data.id ?? "")}`;
  }

  if (action.type === "scene") {
    return `무대 조합 변경: ${String(data.id ?? "")}`;
  }

  if (action.type === "change_balloon") {
    return `말풍선 테마: ${String(data.theme ?? "")}`;
  }

  if (action.type === "log") {
    return `로그: ${String(data.label ?? "")}`;
  }

  return action.type;
}

function createMenuCard(item: ManagementMenuItem, depth = 0): HTMLElement {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const title = document.createElement("strong");
  const key = document.createElement("code");
  const description = document.createElement("p");
  const meta = document.createElement("div");
  const actionList = document.createElement("ul");

  card.className = "asset-menu-card";
  card.style.setProperty("--menu-depth", String(depth));
  header.className = "asset-menu-card-header";
  title.textContent = item.label;
  key.textContent = item.id;
  description.textContent = item.description ?? "설명이 없는 메뉴 항목입니다.";
  meta.className = "asset-menu-card-meta";
  meta.append(
    createBadge(`액션 ${item.actions?.length ?? 0}`),
    createBadge(`하위 ${item.children?.length ?? 0}`),
  );
  actionList.className = "asset-menu-action-list";
  (item.actions ?? []).slice(0, 6).forEach((action) => {
    const actionItem = document.createElement("li");

    actionItem.textContent = summarizeAction(action);
    actionList.append(actionItem);
  });
  header.append(title, key);
  card.append(header, description, meta);
  if (actionList.children.length > 0) {
    card.append(actionList);
  }
  if (item.children?.length) {
    const children = document.createElement("div");

    children.className = "asset-menu-children";
    children.replaceChildren(...item.children.map((child) => createMenuCard(child, depth + 1)));
    card.append(children);
  }

  return card;
}

function createBadge(text: string) {
  const badge = document.createElement("span");

  badge.className = "asset-pill";
  badge.textContent = text;

  return badge;
}

function getMenuItems() {
  if (currentMode === "developer") {
    return createDemoDeveloperMenuItems();
  }

  if (currentMode === "all") {
    return createDemoManagementMenuItems(currentCharacter, { includeDeveloperTools: true });
  }

  return createDemoUserMenuItems(currentCharacter);
}

function renderModeTabs() {
  modeList.replaceChildren(...menuModes.map((mode) => {
    const button = document.createElement("button");
    const label = document.createElement("strong");
    const description = document.createElement("span");

    button.type = "button";
    button.className = "asset-menu-mode-button";
    button.dataset.active = String(mode.id === currentMode);
    label.textContent = mode.label;
    description.textContent = mode.description;
    button.append(label, description);
    button.addEventListener("click", () => {
      currentMode = mode.id;
      render();
    });

    return button;
  }));
}

function render() {
  currentItems = getMenuItems();
  renderModeTabs();
  menuTree.replaceChildren(...currentItems.map((item) => createMenuCard(item)));
  output.textContent = JSON.stringify({
    menuId: `demo.${currentMode}`,
    characterId: currentCharacter?.profile.id ?? null,
    items: currentItems,
  }, null, 2);
  status.textContent = `${menuModes.find((mode) => mode.id === currentMode)?.label ?? "메뉴"} ${currentItems.length}개를 표시 중입니다.`;
}

async function loadCharacter() {
  const characterId = characterSelect.value;

  if (!characterId) {
    currentCharacter = undefined;
    render();
    return;
  }

  try {
    const result = await fetchCharacterAssets(characterId);

    currentCharacter = createCharacterShell(characterId, result.assets);
    render();
  } catch (error) {
    currentCharacter = undefined;
    status.textContent = error instanceof Error ? error.message : "캐릭터 메뉴 재료를 불러오지 못했어요.";
    render();
  }
}

async function copyMenuJson() {
  try {
    await navigator.clipboard.writeText(output.textContent ?? "{}");
    status.textContent = "메뉴 JSON을 복사했어요.";
  } catch {
    status.textContent = "브라우저가 복사를 막았어요. 오른쪽 JSON을 직접 선택해서 복사하세요.";
  }
}

characterSelect.addEventListener("change", () => {
  void loadCharacter();
});
copyButton.addEventListener("click", () => {
  void copyMenuJson();
});

void populateCharacterSelect(characterSelect).then(() => loadCharacter());
