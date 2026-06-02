type CharacterNavItem = {
  id: string;
  href: string;
  label: string;
  group: "basic" | "editor" | "support";
  step?: string;
};

const navItems: CharacterNavItem[] = [
  { id: "home", href: "./dev-character.html", label: "제작 홈", group: "basic", step: "0" },
  { id: "create", href: "./dev-character-create.html", label: "캐릭터", group: "basic", step: "1" },
  { id: "expression", href: "./dev-character-expression.html", label: "표정", group: "basic", step: "2" },
  { id: "set", href: "./dev-character-set.html", label: "캐릭터 상태", group: "basic", step: "3" },
  { id: "crop", href: "./dev-assets-crop.html", label: "영역 선택", group: "editor" },
  { id: "layer", href: "./dev-assets-layer.html", label: "파츠 편집", group: "editor", step: "4" },
  { id: "scene", href: "./dev-character-scene.html", label: "무대 편집", group: "editor", step: "5" },
  { id: "composition", href: "./dev-character-composition.html", label: "상태 조합", group: "support" },
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
 * Renders the shared character settings navigation.
 */
function renderCharacterNav(nav: HTMLElement) {
  const currentPageId = getCurrentPageId(nav);
  const groups = [
    { id: "basic", label: "기본 등록" },
    { id: "editor", label: "이미지 편집 도구" },
    { id: "support", label: "보조 도구" },
  ] satisfies Array<{ id: CharacterNavItem["group"]; label: string }>;
  const fragments = groups.flatMap((group) => {
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

  nav.replaceChildren(...fragments);
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

document.querySelectorAll<HTMLElement>("[data-character-nav]").forEach(renderCharacterNav);
