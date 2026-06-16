import type { ManagementMenuDisplay, ManagementMenuOptions, RuntimeAction } from "../core/types.js";

type OpenManagementMenuAction = Extract<RuntimeAction, { type: "open_management_menu" }>;
type RunActions = (actions: RuntimeAction[]) => void | Promise<void>;

export type ManagementMenuTargets = {
  balloon: HTMLElement | null;
  panel: HTMLElement | null;
};

type RenderManagementMenuOptions = {
  action: OpenManagementMenuAction;
  targets: ManagementMenuTargets;
  runActions: RunActions;
  currentItems?: OpenManagementMenuAction["items"];
  parentItems?: OpenManagementMenuAction["items"] | undefined;
  menuTitle?: string | undefined;
  display: ManagementMenuDisplay;
  closeOnSelect?: boolean;
  draggable?: boolean;
};

const defaultDisplay: ManagementMenuDisplay = "balloon";
const panelDragMargin = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMenuElement(targets: ManagementMenuTargets, display: ManagementMenuDisplay) {
  return display === "panel" ? targets.panel : targets.balloon;
}

function getOtherMenuElement(targets: ManagementMenuTargets, display: ManagementMenuDisplay) {
  return display === "panel" ? targets.balloon : targets.panel;
}

function closeMenuElement(menuElement: HTMLElement | null) {
  if (!menuElement) {
    return;
  }

  menuElement.hidden = true;
  menuElement.replaceChildren();
}

function makePanelMenuDraggable(menuElement: HTMLElement, handleElement: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  handleElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;

    const menuRect = menuElement.getBoundingClientRect();
    const parentRect = (menuElement.offsetParent ?? document.documentElement).getBoundingClientRect();

    initialX = menuRect.left - parentRect.left;
    initialY = menuRect.top - parentRect.top;

    menuElement.style.width = `${menuRect.width}px`;
    menuElement.style.height = `${menuRect.height}px`;
    menuElement.style.right = "auto";
    menuElement.style.bottom = "auto";
    menuElement.style.left = `${initialX}px`;
    menuElement.style.top = `${initialY}px`;
    menuElement.dataset.dragging = "true";

    handleElement.setPointerCapture?.(event.pointerId);
  });

  handleElement.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();

    const parentRect = (menuElement.offsetParent ?? document.documentElement).getBoundingClientRect();
    const minX = panelDragMargin;
    const minY = panelDragMargin;
    const maxX = Math.max(minX, parentRect.width - menuElement.offsetWidth - panelDragMargin);
    const maxY = Math.max(minY, parentRect.height - menuElement.offsetHeight - panelDragMargin);
    const nextX = clamp(initialX + event.clientX - startX, minX, maxX);
    const nextY = clamp(initialY + event.clientY - startY, minY, maxY);

    menuElement.style.left = `${nextX}px`;
    menuElement.style.top = `${nextY}px`;
  });

  const stopDragging = (event: PointerEvent) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    delete menuElement.dataset.dragging;
    menuElement.style.removeProperty("height");
    handleElement.releasePointerCapture?.(event.pointerId);
  };

  handleElement.addEventListener("pointerup", stopDragging);
  handleElement.addEventListener("pointercancel", stopDragging);
}

function renderMenuContent({
  action,
  targets,
  runActions,
  currentItems = action.items,
  parentItems,
  menuTitle = action.title,
  display,
  closeOnSelect = true,
  draggable = true,
  menuElement,
}: RenderManagementMenuOptions & {
  display: ManagementMenuDisplay;
  menuElement: HTMLElement;
}) {
  const contentElement = display === "panel"
    ? document.createElement("div")
    : menuElement;

  if (menuTitle) {
    const titleElement = document.createElement("strong");
    titleElement.className = "management-menu-title";
    titleElement.textContent = menuTitle;
    if (display === "panel" && draggable) {
      makePanelMenuDraggable(menuElement, titleElement);
    }
    menuElement.append(titleElement);
  }

  if (display === "panel") {
    contentElement.className = "management-menu-body";
    menuElement.append(contentElement);
  }

  if (parentItems) {
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.textContent = "← 뒤로";
    backButton.dataset.managementAction = "back";
    backButton.addEventListener("click", () => {
      renderManagementMenu({
        action,
        targets,
        runActions,
        currentItems: parentItems,
        menuTitle: action.title,
        display,
        closeOnSelect,
        draggable,
      });
    });
    contentElement.append(backButton);
  }

  currentItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.dataset.managementAction = item.id;
    button.addEventListener("click", () => {
      if (item.children) {
        renderManagementMenu({
          action,
          targets,
          runActions,
          currentItems: item.children,
          parentItems: currentItems,
          menuTitle: item.label,
          display,
          closeOnSelect,
          draggable,
        });
        return;
      }

      const actions = closeOnSelect
        ? [...(item.actions ?? []), { type: "close_management_menu" } satisfies RuntimeAction]
        : [...(item.actions ?? [])];
      void runActions(actions);
    });
    contentElement.append(button);
  });
}

/**
 * Renders a management menu into the selected UI target.
 * The runtime owns action execution, while this renderer owns DOM shape and menu navigation.
 */
export function renderManagementMenu({
  action,
  targets,
  runActions,
  currentItems = action.items,
  parentItems,
  menuTitle = action.title,
  display,
  closeOnSelect,
  draggable,
}: RenderManagementMenuOptions) {
  const menuElement = getMenuElement(targets, display);
  const resolvedCloseOnSelect = closeOnSelect ?? action.closeOnSelect ?? true;
  const resolvedDraggable = draggable ?? action.draggable ?? true;

  if (!menuElement) {
    return;
  }

  closeMenuElement(getOtherMenuElement(targets, display));
  menuElement.replaceChildren();
  menuElement.dataset.managementMenuDisplay = display;
  menuElement.dataset.managementMenuCloseOnSelect = String(resolvedCloseOnSelect);
  menuElement.dataset.managementMenuDraggable = String(resolvedDraggable);
  renderMenuContent({
    action,
    targets,
    runActions,
    currentItems,
    parentItems,
    menuTitle,
    display,
    closeOnSelect: resolvedCloseOnSelect,
    draggable: resolvedDraggable,
    menuElement,
  });
  menuElement.hidden = false;
}

/**
 * Clears all management menu targets.
 */
export function closeManagementMenu(targets: ManagementMenuTargets) {
  closeMenuElement(targets.balloon);
  closeMenuElement(targets.panel);
}

/**
 * Resolves whether a menu should open in the balloon, panel, or a custom display slot.
 */
export function resolveManagementMenuDisplay(
  action: OpenManagementMenuAction,
  options: ManagementMenuOptions | undefined,
) {
  if (action.display) {
    return action.display;
  }

  if (action.menuId && options?.displays?.[action.menuId]) {
    return options.displays[action.menuId] ?? defaultDisplay;
  }

  return options?.defaultDisplay ?? defaultDisplay;
}
