type CharacterNavItem = {
  id: string;
  href: string;
  label: string;
  group: "home" | "character" | "material" | "support";
  step?: string;
};

type FlowStep = {
  id: "character" | "expression" | "dialogue" | "state" | "parts" | "stage";
  title: string;
  description: string;
};

const navItems: CharacterNavItem[] = [
  { id: "home", href: "./dev-character.html", label: "제작 홈", group: "home" },
  { id: "create", href: "./dev-character-create.html", label: "캐릭터 만들기", group: "character", step: "1" },
  { id: "expression", href: "./dev-character-expression.html", label: "표정 만들기", group: "character", step: "2" },
  { id: "dialogue", href: "./dev-character-dialogue.html", label: "대사 만들기", group: "character", step: "3" },
  { id: "set", href: "./dev-character-set.html", label: "상태 연결", group: "character", step: "4" },
  { id: "layer", href: "./dev-assets-layer.html", label: "파츠 움직임", group: "material", step: "5" },
  { id: "scene", href: "./dev-character-scene.html", label: "무대 조합", group: "material", step: "6" },
  { id: "crop", href: "./dev-assets-crop.html", label: "영역 선택", group: "support" },
];

const flowSteps: FlowStep[] = [
  {
    id: "character",
    title: "캐릭터",
    description: "작업할 캐릭터를 만듭니다.",
  },
  {
    id: "expression",
    title: "표정",
    description: "표정 이미지를 등록합니다.",
  },
  {
    id: "dialogue",
    title: "대사",
    description: "말풍선 대사를 준비합니다.",
  },
  {
    id: "state",
    title: "연결",
    description: "상태에 재료를 붙입니다.",
  },
  {
    id: "parts",
    title: "파츠",
    description: "움직이는 파츠를 붙입니다.",
  },
  {
    id: "stage",
    title: "무대",
    description: "배경과 소품을 배치합니다.",
  },
];

/**
 * Finds the current page id from the nav dataset or browser path.
 */
function getCurrentPageId(nav: HTMLElement) {
  const currentPage = nav.dataset.currentPage;

  if (currentPage) {
    return currentPage;
  }

  const currentFileName = window.location.pathname.split("/").pop() ?? "";
  const currentItem = navItems.find((item) => item.href.endsWith(currentFileName));

  return currentItem?.id ?? "home";
}

/**
 * Returns the current production flow group for a page.
 */
function getCurrentGroup(currentPageId: string) {
  return navItems.find((item) => item.id === currentPageId)?.group ?? "home";
}

/**
 * Returns the current visual flow step for highlighting.
 */
function getCurrentFlowStep(currentPageId: string): FlowStep["id"] | null {
  if (currentPageId === "create") {
    return "character";
  }

  if (currentPageId === "expression") {
    return "expression";
  }

  if (currentPageId === "dialogue") {
    return "dialogue";
  }

  if (currentPageId === "set" || currentPageId === "composition") {
    return "state";
  }

  if (currentPageId === "layer" || currentPageId === "crop") {
    return "parts";
  }

  if (currentPageId === "scene") {
    return "stage";
  }

  return null;
}

/**
 * Creates one shared navigation link.
 */
function createNavLink(item: CharacterNavItem, currentPageId: string) {
  const link = document.createElement("a");
  const label = document.createElement("span");

  link.href = item.href;
  link.dataset.navGroup = item.group;
  label.textContent = item.label;

  if (item.step) {
    const step = document.createElement("strong");

    step.textContent = item.step;
    link.append(step);
  }

  link.append(label);

  if (item.id === currentPageId) {
    link.setAttribute("aria-current", "page");
  }

  return link;
}

/**
 * Renders the left-to-right production flow above page-specific links.
 */
function createFlowCompass(currentStep: FlowStep["id"] | null) {
  const compass = document.createElement("ol");

  compass.className = "asset-production-flow";
  compass.setAttribute("aria-label", "제작 흐름");
  compass.replaceChildren(...flowSteps.map((step, index) => {
    const item = document.createElement("li");
    const number = document.createElement("strong");
    const text = document.createElement("span");
    const description = document.createElement("small");

    item.dataset.active = String(step.id === currentStep);
    number.textContent = String(index + 1);
    text.textContent = step.title;
    description.textContent = step.description;
    item.append(number, text, description);

    return item;
  }));

  return compass;
}

/**
 * Renders the shared character settings navigation.
 */
function renderCharacterNav(nav: HTMLElement) {
  const currentPageId = getCurrentPageId(nav);
  const currentGroup = getCurrentGroup(currentPageId);
  const currentStep = getCurrentFlowStep(currentPageId);
  const linkGroups = [
    { id: "home", label: "시작" },
    { id: "character", label: "캐릭터 흐름" },
    { id: "material", label: "재료 편집" },
    { id: "support", label: "보조 도구" },
  ] satisfies Array<{ id: CharacterNavItem["group"]; label: string }>;
  const groups = linkGroups.flatMap((group) => {
    const groupItems = navItems.filter((item) => item.group === group.id);

    if (groupItems.length === 0) {
      return [];
    }

    const groupElement = document.createElement("div");
    const groupLabel = document.createElement("span");

    groupElement.className = "asset-tool-nav-group";
    groupElement.dataset.navGroup = group.id;
    groupLabel.className = "asset-tool-nav-group-label";
    groupLabel.textContent = group.label;
    groupElement.append(groupLabel, ...groupItems.map((item) => createNavLink(item, currentPageId)));

    return [groupElement];
  });

  nav.replaceChildren(createFlowCompass(currentStep), ...groups);
}

document.querySelectorAll<HTMLElement>("[data-character-nav]").forEach(renderCharacterNav);
