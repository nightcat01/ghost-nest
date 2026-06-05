import { requireElement } from "./assetShared.js";
import { fetchCharacterAssets, saveCharacterLines } from "./assetApi.js";
import { populateCharacterSelect } from "./assetCharacterSelect.js";

type DialogueCategoryTemplate = {
  id: string;
  label: string;
  description: string;
  sampleLines: string[];
};

const defaultDialogueTemplates: DialogueCategoryTemplate[] = [
  {
    id: "onMount",
    label: "처음 등장할 때",
    description: "런타임이 시작되거나 캐릭터가 처음 표시될 때 사용합니다.",
    sampleLines: ["안녕하세요. 준비가 끝났어요.", "필요한 일이 있으면 저를 불러주세요."],
  },
  {
    id: "onClick",
    label: "캐릭터를 클릭했을 때",
    description: "캐릭터 본체를 클릭했을 때 말합니다.",
    sampleLines: ["네, 여기 있어요.", "무엇을 도와드릴까요?"],
  },
  {
    id: "onTouchHead",
    label: "머리를 터치했을 때",
    description: "머리 터치 영역과 연결할 수 있습니다.",
    sampleLines: ["머리 쪽을 확인하셨군요.", "조심스럽게 부탁드릴게요."],
  },
  {
    id: "onTouchFace",
    label: "얼굴을 터치했을 때",
    description: "얼굴 터치 영역과 연결할 수 있습니다.",
    sampleLines: ["얼굴 쪽이에요.", "표정이 잘 보이나요?"],
  },
  {
    id: "onTouchBody",
    label: "몸을 터치했을 때",
    description: "몸 터치 영역과 연결할 수 있습니다.",
    sampleLines: ["그쪽은 몸 영역이에요.", "이 영역에 맞는 반응을 넣어주세요."],
  },
  {
    id: "onIdle",
    label: "기다리는 중",
    description: "일정 시간 아무 입력이 없을 때 사용합니다.",
    sampleLines: ["조용히 기다리고 있어요.", "천천히 골라도 괜찮아요."],
  },
  {
    id: "onRandomPrompt",
    label: "랜덤 발화",
    description: "캐릭터가 가끔 먼저 말을 걸 때 사용합니다.",
    sampleLines: ["잠깐 이야기해도 될까요?", "지금 확인해볼 만한 게 있어요."],
  },
  {
    id: "onLine",
    label: "한마디 버튼",
    description: "대사 버튼이나 짧은 말하기 명령에 사용합니다.",
    sampleLines: ["한마디 남겨둘게요.", "오늘도 좋은 흐름으로 가보죠."],
  },
  {
    id: "onHoverRuntimeTitle",
    label: "런타임 제목 hover",
    description: "런타임 제목 영역에 마우스를 올렸을 때 사용합니다.",
    sampleLines: ["이 영역은 런타임 제목이에요."],
  },
  {
    id: "onHoverEventLog",
    label: "이벤트 로그 hover",
    description: "이벤트 로그 영역 안내에 사용합니다.",
    sampleLines: ["여기에는 최근 동작 기록이 보여요."],
  },
  {
    id: "onHoverCommandMenu",
    label: "명령 메뉴 hover",
    description: "명령 메뉴를 설명할 때 사용합니다.",
    sampleLines: ["메뉴에서 사용할 기능을 고를 수 있어요."],
  },
  {
    id: "onHoverFortuneCommand",
    label: "확장 명령 hover",
    description: "운세나 외부 기능 메뉴 안내에 사용합니다.",
    sampleLines: ["이 버튼은 확장 기능과 연결할 수 있어요."],
  },
  {
    id: "onHoverLineCommand",
    label: "대사 버튼 hover",
    description: "한마디 버튼 설명에 사용합니다.",
    sampleLines: ["짧은 대사를 바로 확인하는 버튼이에요."],
  },
  {
    id: "onHoverHideCommand",
    label: "숨기기 버튼 hover",
    description: "캐릭터 숨김 버튼 설명에 사용합니다.",
    sampleLines: ["잠시 캐릭터를 숨길 수 있어요."],
  },
  {
    id: "onHide",
    label: "숨길 때",
    description: "캐릭터가 숨겨질 때 사용합니다.",
    sampleLines: ["잠시 숨어 있을게요."],
  },
  {
    id: "onShow",
    label: "다시 보일 때",
    description: "숨겨진 캐릭터가 다시 나타날 때 사용합니다.",
    sampleLines: ["다시 돌아왔어요."],
  },
];

const characterSelect = requireElement(document.querySelector<HTMLSelectElement>("#characterSelect"), "#characterSelect");
const categoryList = requireElement(document.querySelector<HTMLElement>("#dialogueCategoryList"), "#dialogueCategoryList");
const customCategoryInput = requireElement(document.querySelector<HTMLInputElement>("#customCategoryInput"), "#customCategoryInput");
const customLineInput = requireElement(document.querySelector<HTMLInputElement>("#customLineInput"), "#customLineInput");
const addCategoryButton = requireElement(document.querySelector<HTMLButtonElement>("#addCategoryButton"), "#addCategoryButton");
const saveDialogueButton = requireElement(document.querySelector<HTMLButtonElement>("#saveDialogueButton"), "#saveDialogueButton");
const output = requireElement(document.querySelector<HTMLElement>("#dialogueOutput"), "#dialogueOutput");
const status = requireElement(document.querySelector<HTMLElement>("#dialogueStatus"), "#dialogueStatus");

let currentLines: Record<string, string[]> = {};
let customCategoryIds: string[] = [];

/**
 * Returns the default sample lines for one category.
 */
function getTemplateSampleLines(categoryId: string) {
  return defaultDialogueTemplates.find((template) => template.id === categoryId)?.sampleLines ?? [`${categoryId} 대사를 입력하세요.`];
}

/**
 * Builds the category list from fixed templates and saved custom categories.
 */
function getCategoryTemplates() {
  const fixedIds = new Set(defaultDialogueTemplates.map((template) => template.id));
  const customTemplates = customCategoryIds
    .filter((id) => !fixedIds.has(id))
    .map((id) => ({
      id,
      label: id,
      description: "사용자가 추가한 프로젝트 전용 대사 카테고리입니다.",
      sampleLines: getTemplateSampleLines(id),
    }));

  return [...defaultDialogueTemplates, ...customTemplates];
}

/**
 * Reads the current textarea values into a normalized line set.
 */
function readLinesFromForm() {
  const nextLines: Record<string, string[]> = {};

  categoryList.querySelectorAll<HTMLTextAreaElement>("[data-dialogue-category]").forEach((textarea) => {
    const categoryId = textarea.dataset.dialogueCategory;
    const lines = textarea.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (categoryId && lines.length > 0) {
      nextLines[categoryId] = lines;
    }
  });

  return nextLines;
}

/**
 * Updates the JSON preview shown on the right side.
 */
function renderOutput() {
  output.textContent = JSON.stringify(readLinesFromForm(), null, 2);
}

/**
 * Creates one editable category card.
 */
function createCategoryCard(template: DialogueCategoryTemplate) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const title = document.createElement("strong");
  const key = document.createElement("code");
  const help = document.createElement("p");
  const textarea = document.createElement("textarea");
  const savedLines = currentLines[template.id] ?? [];
  const lines = savedLines.length > 0
    ? savedLines
    : template.sampleLines;

  card.className = "asset-dialogue-category-card";
  header.className = "asset-dialogue-category-header";
  title.textContent = template.label;
  key.textContent = template.id;
  help.textContent = template.description;
  textarea.dataset.dialogueCategory = template.id;
  textarea.rows = Math.max(3, Math.min(6, lines.length + 1));
  textarea.value = lines.join("\n");
  textarea.addEventListener("input", renderOutput);
  header.append(title, key);
  card.append(header, help, textarea);

  return card;
}

/**
 * Renders every default and custom category.
 */
function renderCategories() {
  categoryList.replaceChildren(...getCategoryTemplates().map(createCategoryCard));
  renderOutput();
}

/**
 * Loads saved lines and fills missing default categories with sample text.
 */
async function loadCharacterLines() {
  const characterId = characterSelect.value || "rine";

  status.textContent = `${characterId} 캐릭터 대사를 불러오는 중이에요.`;

  try {
    const result = await fetchCharacterAssets(characterId);
    const savedLines = result.lines ?? {};
    const fixedIds = new Set(defaultDialogueTemplates.map((template) => template.id));

    currentLines = { ...savedLines };
    customCategoryIds = Object.keys(savedLines).filter((id) => !fixedIds.has(id)).sort((left, right) => left.localeCompare(right));
    renderCategories();
    status.textContent = `${characterId} 캐릭터 대사를 불러왔어요. 비어 있는 기본 카테고리는 샘플 문장으로 표시됩니다.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "대사 설정을 불러오지 못했어요.";
  }
}

/**
 * Adds a custom dialogue category to the current form.
 */
function addCustomCategory() {
  const categoryId = customCategoryInput.value.trim();
  const firstLine = customLineInput.value.trim();

  if (!categoryId) {
    status.textContent = "추가할 카테고리 key를 입력하세요.";
    return;
  }

  if (!/^[a-zA-Z0-9_.:-]+$/.test(categoryId)) {
    status.textContent = "카테고리 key는 영문, 숫자, _, ., :, - 조합을 권장합니다.";
    return;
  }

  if (!customCategoryIds.includes(categoryId) && !defaultDialogueTemplates.some((template) => template.id === categoryId)) {
    customCategoryIds.push(categoryId);
    customCategoryIds.sort((left, right) => left.localeCompare(right));
  }

  currentLines = readLinesFromForm();
  currentLines[categoryId] = firstLine ? [firstLine] : getTemplateSampleLines(categoryId);
  customCategoryInput.value = "";
  customLineInput.value = "";
  renderCategories();
  status.textContent = `${categoryId} 대사 카테고리를 추가했어요.`;
}

/**
 * Saves the current dialogue line set to lines.ts and the build mirror.
 */
async function saveDialogueConfig() {
  const characterId = characterSelect.value || "rine";
  const lines = readLinesFromForm();

  if (Object.keys(lines).length === 0) {
    status.textContent = "저장할 대사를 하나 이상 입력하세요.";
    return;
  }

  saveDialogueButton.disabled = true;
  status.textContent = "대사를 저장하는 중이에요.";

  try {
    const saved = await saveCharacterLines(characterId, lines);

    currentLines = lines;
    status.textContent = `${saved?.path ?? "lines.ts"}에 대사를 저장했어요.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "대사 저장 요청에 실패했어요.";
  } finally {
    saveDialogueButton.disabled = false;
    renderOutput();
  }
}

/**
 * Wires the dialogue settings page.
 */
async function init() {
  characterSelect.addEventListener("change", () => {
    void loadCharacterLines();
  });
  addCategoryButton.addEventListener("click", addCustomCategory);
  saveDialogueButton.addEventListener("click", () => {
    void saveDialogueConfig();
  });

  try {
    const selectedCharacterId = await populateCharacterSelect(characterSelect);

    if (selectedCharacterId) {
      await loadCharacterLines();
      return;
    }

    status.textContent = "불러올 캐릭터가 없어요.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "캐릭터 목록을 불러오지 못했어요.";
  }
}

void init();
