import type { ManagementMenuDisplay, ManagementMenuItem, RuntimeAction } from "../../../core/types.js";
import {
  createDemoDeveloperMenuItems,
  createDemoManagementMenuItems,
  createDemoUserMenuItems,
} from "../../../demo/demoManagementMenu.js";
import { listNanikaData, saveNanikaDataItem, deleteNanikaDataItem } from "../../../devtools/nanikaDataClient.js";
import { requireElement } from "../../../devtools/assetShared.js";

type MenuMode = "user" | "developer" | "all";
type MenuAudience = "user" | "developer" | "custom";

type NanikaMenuSet = {
  id: string;
  name?: string;
  description?: string;
  audience?: MenuAudience;
  defaultDisplay?: ManagementMenuDisplay;
  closeOnSelect?: boolean;
  draggable?: boolean;
  items: ManagementMenuItem[];
};

type MenuItemPath = number[];

const menuModes = [
  { id: "user", label: "사용자 메뉴", description: "사용자에게 보여주기 좋은 기본 메뉴를 불러옵니다." },
  { id: "developer", label: "개발자 메뉴", description: "설정과 진단 도구 메뉴를 불러옵니다." },
  { id: "all", label: "전체 데모 메뉴", description: "사용자 메뉴와 개발자 메뉴를 함께 불러옵니다." },
] satisfies Array<{ id: MenuMode; label: string; description: string }>;

const modeList = requireElement(document.querySelector<HTMLElement>("#menuModeList"), "#menuModeList");
const menuTree = requireElement(document.querySelector<HTMLElement>("#menuTree"), "#menuTree");
const output = requireElement(document.querySelector<HTMLElement>("#menuOutput"), "#menuOutput");
const status = requireElement(document.querySelector<HTMLElement>("#menuStatus"), "#menuStatus");
const copyButton = requireElement(document.querySelector<HTMLButtonElement>("#copyMenuJsonButton"), "#copyMenuJsonButton");
const newMenuButton = requireElement(document.querySelector<HTMLButtonElement>("#newMenuButton"), "#newMenuButton");
const saveMenuButton = requireElement(document.querySelector<HTMLButtonElement>("#saveMenuButton"), "#saveMenuButton");
const deleteMenuButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteMenuButton"), "#deleteMenuButton");
const addRootItemButton = requireElement(document.querySelector<HTMLButtonElement>("#addRootItemButton"), "#addRootItemButton");
const addChildItemButton = requireElement(document.querySelector<HTMLButtonElement>("#addChildItemButton"), "#addChildItemButton");
const applyItemButton = requireElement(document.querySelector<HTMLButtonElement>("#applyItemButton"), "#applyItemButton");
const deleteItemButton = requireElement(document.querySelector<HTMLButtonElement>("#deleteItemButton"), "#deleteItemButton");
const menuIdInput = requireElement(document.querySelector<HTMLInputElement>("#menuIdInput"), "#menuIdInput");
const menuNameInput = requireElement(document.querySelector<HTMLInputElement>("#menuNameInput"), "#menuNameInput");
const menuDescriptionInput = requireElement(document.querySelector<HTMLInputElement>("#menuDescriptionInput"), "#menuDescriptionInput");
const menuAudienceSelect = requireElement(document.querySelector<HTMLSelectElement>("#menuAudienceSelect"), "#menuAudienceSelect");
const menuDisplaySelect = requireElement(document.querySelector<HTMLSelectElement>("#menuDisplaySelect"), "#menuDisplaySelect");
const menuCloseOnSelectInput = requireElement(document.querySelector<HTMLInputElement>("#menuCloseOnSelectInput"), "#menuCloseOnSelectInput");
const menuDraggableInput = requireElement(document.querySelector<HTMLInputElement>("#menuDraggableInput"), "#menuDraggableInput");
const menuItemIdInput = requireElement(document.querySelector<HTMLInputElement>("#menuItemIdInput"), "#menuItemIdInput");
const menuItemLabelInput = requireElement(document.querySelector<HTMLInputElement>("#menuItemLabelInput"), "#menuItemLabelInput");
const menuItemDescriptionInput = requireElement(document.querySelector<HTMLInputElement>("#menuItemDescriptionInput"), "#menuItemDescriptionInput");
const menuActionTypeSelect = requireElement(document.querySelector<HTMLSelectElement>("#menuActionTypeSelect"), "#menuActionTypeSelect");
const menuActionValueInput = requireElement(document.querySelector<HTMLInputElement>("#menuActionValueInput"), "#menuActionValueInput");
const menuActionValueSelect = requireElement(document.querySelector<HTMLSelectElement>("#menuActionValueSelect"), "#menuActionValueSelect");
const addMenuActionButton = requireElement(document.querySelector<HTMLButtonElement>("#addMenuActionButton"), "#addMenuActionButton");
const menuItemActionsInput = requireElement(document.querySelector<HTMLTextAreaElement>("#menuItemActionsInput"), "#menuItemActionsInput");
const menuItemActionList = requireElement(document.querySelector<HTMLElement>("#menuItemActionList"), "#menuItemActionList");
const selectedItemPath = requireElement(document.querySelector<HTMLElement>("#selectedItemPath"), "#selectedItemPath");
const savedMenuList = requireElement(document.querySelector<HTMLElement>("#savedMenuList"), "#savedMenuList");

let currentMode: MenuMode = "user";
let currentItems: ManagementMenuItem[] = [];
let savedMenus: NanikaMenuSet[] = [];
let selectedPath: MenuItemPath | null = null;
let currentItemActions: RuntimeAction[] = [];

const dialogueCategoryOptions = [
  { value: "onMount", label: "시작 대사" },
  { value: "onClick", label: "클릭 대사" },
  { value: "onTouchHead", label: "머리 터치 대사" },
  { value: "onTouchFace", label: "얼굴 터치 대사" },
  { value: "onTouchBody", label: "몸 터치 대사" },
  { value: "onHoverCommandMenu", label: "메뉴 hover 대사" },
  { value: "onRandomPrompt", label: "랜덤 대사" },
  { value: "onIdle", label: "대기 대사" },
  { value: "onHide", label: "숨기기 대사" },
  { value: "onShow", label: "다시 보이기 대사" },
  { value: "speech", label: "일반 대사" },
];

const pluginOptions = [
  { value: "sample_result", label: "샘플 결과 플러그인" },
  { value: "weather", label: "날씨 플러그인" },
  { value: "timer", label: "타이머 플러그인" },
];

const runtimeProfileOptions = [
  { value: "nanika.rine.default", label: "리네 기본 프로필" },
  { value: "nanika.rine.home", label: "리네 홈 프로필 예시" },
  { value: "nanika.rine.selection", label: "리네 선택 화면 프로필 예시" },
];

function cloneItems(items: readonly ManagementMenuItem[]) {
  return JSON.parse(JSON.stringify(items)) as ManagementMenuItem[];
}

function createEmptyMenuItem(): ManagementMenuItem {
  return {
    id: `menu-item-${Date.now().toString(36)}`,
    label: "새 메뉴",
    description: "메뉴 설명을 입력하세요.",
    actions: [],
  };
}

function getTemplateItems(mode: MenuMode) {
  if (mode === "developer") {
    return createDemoDeveloperMenuItems();
  }

  if (mode === "all") {
    return createDemoManagementMenuItems(undefined, { includeDeveloperTools: true });
  }

  return createDemoUserMenuItems();
}

function summarizeAction(action: RuntimeAction) {
  const data = action as Record<string, unknown>;

  if (action.type === "navigate") {
    return `이동: ${String(data.route ?? "")}`;
  }

  if (action.type === "open_management_menu") {
    return `하위 메뉴 열기: ${String(data.menuId ?? data.title ?? "직접 메뉴")}`;
  }

  if (action.type === "request_profile_change") {
    return `프로필 전환: ${String(data.profileId ?? "")}`;
  }

  if (action.type === "speak") {
    return `대사: ${String(data.category ?? "")}`;
  }

  if (action.type === "speak_text") {
    return "고정 대사";
  }

  if (action.type === "call_plugin") {
    return `플러그인: ${String(data.pluginId ?? "")}`;
  }

  return action.type;
}

function describeAction(action: RuntimeAction) {
  const data = action as Record<string, unknown>;

  if (action.type === "navigate") {
    return `route: ${String(data.route ?? "") || "(경로 없음)"}`;
  }

  if (action.type === "speak_text") {
    return String(data.text ?? "") || "(문장 없음)";
  }

  if (action.type === "speak") {
    return `대사 묶음: ${String(data.category ?? "") || "(미지정)"}`;
  }

  if (action.type === "call_plugin") {
    return `pluginId: ${String(data.pluginId ?? "") || "(미지정)"}`;
  }

  if (action.type === "open_management_menu") {
    return `menuId: ${String(data.menuId ?? "") || "(직접 메뉴)"}`;
  }

  if (action.type === "request_profile_change") {
    return `profileId: ${String(data.profileId ?? "") || "(미지정)"}`;
  }

  return JSON.stringify(action);
}

function actionTypeUsesSelect(actionType: string) {
  return actionType === "speak"
    || actionType === "call_plugin"
    || actionType === "open_management_menu"
    || actionType === "request_profile_change";
}

function getActionValuePlaceholder(actionType: string) {
  if (actionType === "navigate") {
    return "/sample/result";
  }

  if (actionType === "speak_text") {
    return "메뉴를 선택했어요.";
  }

  if (actionType === "speak") {
    return "speech";
  }

  if (actionType === "call_plugin") {
    return "sample_result";
  }

  if (actionType === "open_management_menu") {
    return "demo.main.menu";
  }

  if (actionType === "request_profile_change") {
    return "nanika.rine.default";
  }

  return "";
}

function getActionValueSelectOptions(actionType: string) {
  if (actionType === "speak") {
    return dialogueCategoryOptions;
  }

  if (actionType === "call_plugin") {
    return pluginOptions;
  }

  if (actionType === "open_management_menu") {
    const menuOptions = savedMenus
      .filter((menu) => menu.id !== menuIdInput.value.trim())
      .map((menu) => ({ value: menu.id, label: menu.name ? `${menu.name} (${menu.id})` : menu.id }));

    return menuOptions.length > 0
      ? menuOptions
      : [{ value: "demo.user", label: "사용자 메뉴 예시" }];
  }

  if (actionType === "request_profile_change") {
    return runtimeProfileOptions;
  }

  return [];
}

function readActionValue() {
  return actionTypeUsesSelect(menuActionTypeSelect.value)
    ? menuActionValueSelect.value.trim()
    : menuActionValueInput.value.trim();
}

function createActionFromForm(): RuntimeAction {
  const actionType = menuActionTypeSelect.value;
  const value = readActionValue();

  if (!value) {
    throw new Error("기능에 사용할 값을 입력하세요.");
  }

  if (actionType === "navigate") {
    return { type: "navigate", route: value };
  }

  if (actionType === "speak_text") {
    return { type: "speak_text", text: value };
  }

  if (actionType === "speak") {
    return { type: "speak", category: value };
  }

  if (actionType === "call_plugin") {
    return { type: "call_plugin", pluginId: value };
  }

  if (actionType === "open_management_menu") {
    const menu = savedMenus.find((item) => item.id === value);
    const action: Extract<RuntimeAction, { type: "open_management_menu" }> = {
      type: "open_management_menu",
      menuId: value,
      title: menu?.name ?? "메뉴",
      items: [],
    };

    if (menu?.defaultDisplay) {
      action.display = menu.defaultDisplay;
    }

    if (typeof menu?.closeOnSelect === "boolean") {
      action.closeOnSelect = menu.closeOnSelect;
    }

    if (typeof menu?.draggable === "boolean") {
      action.draggable = menu.draggable;
    }

    return action;
  }

  if (actionType === "request_profile_change") {
    return { type: "request_profile_change", profileId: value, reason: "menu" };
  }

  return { type: "log", label: value };
}

function updateActionValuePlaceholder() {
  const actionType = menuActionTypeSelect.value;
  const usesSelect = actionTypeUsesSelect(actionType);
  const options = getActionValueSelectOptions(actionType);

  menuActionValueInput.hidden = usesSelect;
  menuActionValueSelect.hidden = !usesSelect;
  menuActionValueInput.placeholder = getActionValuePlaceholder(actionType);
  menuActionValueSelect.replaceChildren(...options.map((option) => {
    const item = document.createElement("option");

    item.value = option.value;
    item.textContent = option.label;

    return item;
  }));
}

function createBadge(text: string) {
  const badge = document.createElement("span");

  badge.className = "asset-pill";
  badge.textContent = text;

  return badge;
}

function formatPath(path: MenuItemPath | null) {
  if (!path) {
    return "선택된 항목이 없습니다.";
  }

  const labels: string[] = [];
  let items = currentItems;

  for (const index of path) {
    const item = items[index];
    if (!item) {
      break;
    }

    labels.push(item.label);
    items = item.children ?? [];
  }

  return labels.length > 0 ? labels.join(" / ") : "선택된 항목이 없습니다.";
}

function getItemAtPath(path: MenuItemPath | null) {
  if (!path) {
    return null;
  }

  let items = currentItems;
  let found: ManagementMenuItem | null = null;

  for (const index of path) {
    found = items[index] ?? null;
    if (!found) {
      return null;
    }

    items = found.children ?? [];
  }

  return found;
}

function getContainerAtPath(path: MenuItemPath | null) {
  if (!path || path.length === 0) {
    return currentItems;
  }

  const parent = getItemAtPath(path.slice(0, -1));
  if (!parent) {
    return currentItems;
  }

  parent.children = parent.children ?? [];
  return parent.children;
}

function parseActionsInput() {
  const source = menuItemActionsInput.value.trim();

  if (!source) {
    return [];
  }

  const parsed = JSON.parse(source) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("액션 JSON은 배열이어야 합니다.");
  }

  return parsed as RuntimeAction[];
}

function syncActionsTextarea() {
  menuItemActionsInput.value = JSON.stringify(currentItemActions, null, 2);
}

function syncActionsFromTextarea() {
  currentItemActions = parseActionsInput();
  renderActionListEditor();
}

function persistCurrentActionsToSelectedItem() {
  const item = getItemAtPath(selectedPath);

  if (!item) {
    return;
  }

  if (currentItemActions.length > 0) {
    item.actions = JSON.parse(JSON.stringify(currentItemActions)) as RuntimeAction[];
  } else {
    delete item.actions;
  }
}

function renderActionListEditor() {
  if (currentItemActions.length === 0) {
    menuItemActionList.replaceChildren(createEmptyState("아직 실행 액션이 없습니다. 아래 버튼으로 대표 액션을 추가하세요."));
    return;
  }

  menuItemActionList.replaceChildren(...currentItemActions.map((action, index) => {
    const row = document.createElement("article");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("p");
    const controls = document.createElement("div");
    const removeButton = document.createElement("button");

    row.className = "asset-menu-action-row";
    title.textContent = summarizeAction(action);
    description.textContent = describeAction(action);
    controls.className = "asset-lab-button-row";
    removeButton.type = "button";
    removeButton.textContent = "삭제";
    removeButton.addEventListener("click", () => {
      currentItemActions.splice(index, 1);
      persistCurrentActionsToSelectedItem();
      syncActionsTextarea();
      renderActionListEditor();
      output.textContent = JSON.stringify(readCurrentMenuSet(), null, 2);
    });
    controls.append(removeButton);
    main.append(title, description);
    row.append(main, controls);

    return row;
  }));
}

function readCurrentMenuSet(): NanikaMenuSet {
  const id = menuIdInput.value.trim();

  return {
    id,
    ...(menuNameInput.value.trim() ? { name: menuNameInput.value.trim() } : {}),
    ...(menuDescriptionInput.value.trim() ? { description: menuDescriptionInput.value.trim() } : {}),
    audience: menuAudienceSelect.value === "developer" || menuAudienceSelect.value === "custom"
      ? menuAudienceSelect.value
      : "user",
    defaultDisplay: menuDisplaySelect.value === "panel" ? "panel" : "balloon",
    closeOnSelect: menuCloseOnSelectInput.checked,
    draggable: menuDraggableInput.checked,
    items: currentItems,
  };
}

function applyMenuSet(menu: NanikaMenuSet) {
  menuIdInput.value = menu.id;
  menuNameInput.value = menu.name ?? "";
  menuDescriptionInput.value = menu.description ?? "";
  menuAudienceSelect.value = menu.audience ?? "user";
  menuDisplaySelect.value = menu.defaultDisplay === "panel" ? "panel" : "balloon";
  menuCloseOnSelectInput.checked = menu.closeOnSelect ?? true;
  menuDraggableInput.checked = menu.draggable ?? true;
  currentItems = cloneItems(menu.items ?? []);
  selectedPath = currentItems.length > 0 ? [0] : null;
  render();
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
      currentItems = cloneItems(getTemplateItems(mode.id));
      menuIdInput.value = `demo.${mode.id}`;
      menuNameInput.value = mode.label;
      menuDescriptionInput.value = mode.description;
      menuAudienceSelect.value = mode.id === "developer" ? "developer" : mode.id === "all" ? "custom" : "user";
      selectedPath = currentItems.length > 0 ? [0] : null;
      render();
      status.textContent = `${mode.label} 템플릿을 편집 초안으로 불러왔어요.`;
      status.dataset.state = "ready";
    });

    return button;
  }));
}

function createMenuTreeNode(item: ManagementMenuItem, path: MenuItemPath): HTMLElement {
  const node = document.createElement("details");
  const summary = document.createElement("summary");
  const main = document.createElement("button");
  const meta = document.createElement("span");
  const actionPreview = document.createElement("div");

  node.className = "asset-menu-tree-node";
  node.open = true;
  node.dataset.selected = String(JSON.stringify(path) === JSON.stringify(selectedPath));
  main.type = "button";
  main.className = "asset-menu-tree-button";
  main.textContent = item.label;
  main.addEventListener("click", (event) => {
    event.preventDefault();
    selectedPath = path;
    fillItemForm(item);
    render();
  });
  meta.className = "asset-menu-tree-meta";
  meta.append(
    createBadge(item.id),
    createBadge(`액션 ${item.actions?.length ?? 0}`),
    createBadge(`하위 ${item.children?.length ?? 0}`),
  );
  summary.append(main, meta);
  node.append(summary);

  if (item.description || item.actions?.length) {
    actionPreview.className = "asset-menu-tree-preview";
    actionPreview.textContent = [
      item.description,
      ...(item.actions ?? []).slice(0, 3).map(summarizeAction),
    ].filter(Boolean).join(" · ");
    node.append(actionPreview);
  }

  if (item.children?.length) {
    const children = document.createElement("div");

    children.className = "asset-menu-tree-children";
    children.replaceChildren(...item.children.map((child, index) => createMenuTreeNode(child, [...path, index])));
    node.append(children);
  }

  return node;
}

function fillItemForm(item: ManagementMenuItem | null) {
  selectedItemPath.textContent = formatPath(selectedPath);
  menuItemIdInput.value = item?.id ?? "";
  menuItemLabelInput.value = item?.label ?? "";
  menuItemDescriptionInput.value = item?.description ?? "";
  currentItemActions = JSON.parse(JSON.stringify(item?.actions ?? [])) as RuntimeAction[];
  syncActionsTextarea();
  renderActionListEditor();
  addChildItemButton.disabled = !item;
  applyItemButton.disabled = !item;
  deleteItemButton.disabled = !item;
  addMenuActionButton.disabled = !item;
  menuActionTypeSelect.disabled = !item;
  menuActionValueInput.disabled = !item;
  menuActionValueSelect.disabled = !item;
}

function renderSavedMenus() {
  if (savedMenus.length === 0) {
    savedMenuList.replaceChildren(createEmptyState("저장된 메뉴가 없습니다."));
    return;
  }

  savedMenuList.replaceChildren(...savedMenus.map((menu) => {
    const card = document.createElement("article");
    const title = document.createElement("strong");
    const description = document.createElement("p");
    const actions = document.createElement("div");

    card.className = "asset-menu-saved-card";
    title.textContent = menu.name ?? menu.id;
    description.textContent = `${menu.id} · ${menu.items.length}개 상위 항목 · ${menu.defaultDisplay ?? "balloon"}`;
    actions.className = "asset-lab-button-row";
    actions.append(
      createActionButton("불러오기", () => applyMenuSet(menu)),
      createActionButton("복제", () => {
        applyMenuSet({
          ...menu,
          id: `${menu.id}.copy`,
          name: `${menu.name ?? menu.id} 복제`,
          items: cloneItems(menu.items),
        });
      }),
    );
    card.append(title, description, actions);

    return card;
  }));
}

function createActionButton(label: string, onClick: () => void) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);

  return button;
}

function createEmptyState(text: string) {
  const empty = document.createElement("p");

  empty.className = "asset-lab-help";
  empty.textContent = text;

  return empty;
}

function render() {
  const selectedItem = getItemAtPath(selectedPath);

  renderModeTabs();
  menuTree.replaceChildren(
    ...(currentItems.length > 0
      ? currentItems.map((item, index) => createMenuTreeNode(item, [index]))
      : [createEmptyState("상위 항목 추가 버튼으로 메뉴를 시작하세요.")]),
  );
  fillItemForm(selectedItem);
  renderSavedMenus();
  output.textContent = JSON.stringify(readCurrentMenuSet(), null, 2);
}

function createNewMenu() {
  menuIdInput.value = `menu.common.${Date.now().toString(36)}`;
  menuNameInput.value = "새 메뉴";
  menuDescriptionInput.value = "";
  menuAudienceSelect.value = "user";
  menuDisplaySelect.value = "panel";
  menuCloseOnSelectInput.checked = false;
  menuDraggableInput.checked = false;
  currentItems = [createEmptyMenuItem()];
  selectedPath = [0];
  render();
}

function addRootItem() {
  currentItems.push(createEmptyMenuItem());
  selectedPath = [currentItems.length - 1];
  render();
}

function addChildItem() {
  const parent = getItemAtPath(selectedPath);

  if (!parent) {
    return;
  }

  parent.children = parent.children ?? [];
  parent.children.push(createEmptyMenuItem());
  selectedPath = [...(selectedPath ?? []), parent.children.length - 1];
  render();
}

function applyCurrentItem() {
  const item = getItemAtPath(selectedPath);

  if (!item) {
    return;
  }

  try {
    item.id = menuItemIdInput.value.trim();
    item.label = menuItemLabelInput.value.trim();
    const description = menuItemDescriptionInput.value.trim();
    syncActionsFromTextarea();
    const actions = currentItemActions;
    if (description) {
      item.description = description;
    } else {
      delete item.description;
    }
    if (actions.length > 0) {
      item.actions = actions;
    } else {
      delete item.actions;
    }
    if (!item.id || !item.label) {
      throw new Error("항목 ID와 라벨을 입력하세요.");
    }
    render();
    status.textContent = `${item.label} 항목을 반영했어요.`;
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "항목을 반영하지 못했어요.";
    status.dataset.state = "warning";
  }
}

function deleteCurrentItem() {
  if (!selectedPath) {
    return;
  }

  const container = getContainerAtPath(selectedPath);
  const index = selectedPath[selectedPath.length - 1];

  if (index === undefined) {
    return;
  }

  container.splice(index, 1);
  selectedPath = container.length > 0 ? [...selectedPath.slice(0, -1), Math.max(0, index - 1)] : null;
  render();
}

async function loadSavedMenus() {
  try {
    const result = await listNanikaData<NanikaMenuSet>("menus");

    savedMenus = result.items;
    renderSavedMenus();
    updateActionValuePlaceholder();
    status.textContent = result.path
      ? `${result.path}에서 ${savedMenus.length}개 메뉴를 불러왔어요.`
      : `${savedMenus.length}개 메뉴를 불러왔어요.`;
    status.dataset.state = "ready";
  } catch (error) {
    savedMenus = [];
    renderSavedMenus();
    status.textContent = error instanceof Error ? error.message : "저장된 메뉴를 불러오지 못했어요.";
    status.dataset.state = "warning";
  }
}

async function saveMenu() {
  const menu = readCurrentMenuSet();

  if (!menu.id) {
    status.textContent = "메뉴 ID를 입력하세요.";
    status.dataset.state = "warning";
    return;
  }

  saveMenuButton.disabled = true;
  try {
    const result = await saveNanikaDataItem<NanikaMenuSet>("menus", menu.id, menu);

    savedMenus = result.items;
    render();
    status.textContent = `${menu.id} 메뉴를 저장했어요.`;
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "메뉴를 저장하지 못했어요.";
    status.dataset.state = "warning";
  } finally {
    saveMenuButton.disabled = false;
  }
}

async function deleteMenu() {
  const menuId = menuIdInput.value.trim();

  if (!menuId) {
    status.textContent = "삭제할 메뉴 ID가 없습니다.";
    status.dataset.state = "warning";
    return;
  }

  try {
    const result = await deleteNanikaDataItem<NanikaMenuSet>("menus", menuId);

    savedMenus = result.items;
    createNewMenu();
    renderSavedMenus();
    status.textContent = `${menuId} 메뉴를 삭제했어요.`;
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "메뉴를 삭제하지 못했어요.";
    status.dataset.state = "warning";
  }
}

async function copyMenuJson() {
  try {
    await navigator.clipboard.writeText(output.textContent ?? "{}");
    status.textContent = "메뉴 JSON을 복사했어요.";
    status.dataset.state = "ready";
  } catch {
    status.textContent = "브라우저가 복사를 막았어요. 오른쪽 JSON을 직접 선택해서 복사하세요.";
    status.dataset.state = "warning";
  }
}

[menuIdInput, menuNameInput, menuDescriptionInput, menuAudienceSelect, menuDisplaySelect, menuCloseOnSelectInput, menuDraggableInput].forEach((input) => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
});
copyButton.addEventListener("click", () => {
  void copyMenuJson();
});
newMenuButton.addEventListener("click", createNewMenu);
saveMenuButton.addEventListener("click", () => {
  void saveMenu();
});
deleteMenuButton.addEventListener("click", () => {
  void deleteMenu();
});
addRootItemButton.addEventListener("click", addRootItem);
addChildItemButton.addEventListener("click", addChildItem);
applyItemButton.addEventListener("click", applyCurrentItem);
deleteItemButton.addEventListener("click", deleteCurrentItem);
menuItemActionsInput.addEventListener("change", () => {
  try {
    syncActionsFromTextarea();
    persistCurrentActionsToSelectedItem();
    status.textContent = "액션 JSON을 항목 편집에 반영했어요.";
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "액션 JSON을 읽지 못했어요.";
    status.dataset.state = "warning";
  }
});
menuActionTypeSelect.addEventListener("change", updateActionValuePlaceholder);
addMenuActionButton.addEventListener("click", () => {
  try {
    currentItemActions.push(createActionFromForm());
    persistCurrentActionsToSelectedItem();
    menuActionValueInput.value = "";
    syncActionsTextarea();
    renderActionListEditor();
    output.textContent = JSON.stringify(readCurrentMenuSet(), null, 2);
    status.textContent = "기능을 현재 항목에 추가했어요.";
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "기능을 추가하지 못했어요.";
    status.dataset.state = "warning";
  }
});

createNewMenu();
updateActionValuePlaceholder();
void loadSavedMenus().then(render);
