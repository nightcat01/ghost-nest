import type { CharacterDefinition, ManagementMenuItem, RuntimeAction, RuntimeRule } from "../core/types.js";
import { createCharacterMenuItems } from "./menuPresets/characterMenuItems.js";
import { createDeveloperMenuItems } from "./menuPresets/developerMenuItems.js";
import { createDialogueMenuItems } from "./menuPresets/dialogueMenuItems.js";
import { createPluginMenuItems } from "./menuPresets/pluginMenuItems.js";
import { createUiMenuItems } from "./menuPresets/uiMenuItems.js";

export type DemoManagementMenuOptions = {
  includeDeveloperTools?: boolean;
  includeUserMenus?: boolean;
  includePluginMenus?: boolean;
  includeCharacterMenus?: boolean;
};

function isManagementMenuAction(action: RuntimeAction): action is Extract<RuntimeAction, { type: "open_management_menu" }> {
  return action.type === "open_management_menu";
}

function isActionGroup(action: RuntimeAction): action is Extract<RuntimeAction, { type: "run_sequence" | "run_parallel" | "run_random" }> {
  return action.type === "run_sequence" || action.type === "run_parallel" || action.type === "run_random";
}

function createDeveloperToolsMenuItem(): ManagementMenuItem {
  return {
    id: "developer-tools",
    label: "개발자 도구",
    description: "개발 중 확인용 도구를 모아둔 메뉴예요.",
    children: createDeveloperMenuItems(),
  };
}

/**
 * Creates the demo management menu tree.
 * The menu shows common action patterns such as plugins, nested choices, UI settings, and devtools.
 */
export function createDemoManagementMenuItems(
  character?: CharacterDefinition,
  options: DemoManagementMenuOptions = {},
): ManagementMenuItem[] {
  const includeUserMenus = options.includeUserMenus ?? true;
  const includePluginMenus = options.includePluginMenus ?? true;
  const includeCharacterMenus = options.includeCharacterMenus ?? true;
  const menuItems = [
    ...(includeUserMenus ? createDialogueMenuItems() : []),
    ...(includePluginMenus ? createPluginMenuItems() : []),
    ...(includeUserMenus ? createUiMenuItems() : []),
    ...(includeCharacterMenus ? createCharacterMenuItems(character) : []),
  ];

  if (options.includeDeveloperTools) {
    menuItems.splice(Math.max(0, menuItems.length - 1), 0, createDeveloperToolsMenuItem());
  }

  return menuItems;
}

/**
 * Creates user-facing menu items without developer-only tools.
 */
export function createDemoUserMenuItems(character?: CharacterDefinition): ManagementMenuItem[] {
  return createDemoManagementMenuItems(character, {
    includeDeveloperTools: false,
    includeUserMenus: true,
    includePluginMenus: true,
    includeCharacterMenus: true,
  });
}

/**
 * Creates developer-facing menu items for integration and diagnostics.
 */
export function createDemoDeveloperMenuItems(): ManagementMenuItem[] {
  return [createDeveloperToolsMenuItem()];
}

/**
 * Resolves lightweight management menu placeholders saved by mapping tools.
 * Hosts can store only a menu id in mappings and hydrate the real preset before runtime execution.
 */
export function resolveDemoManagementMenuItems(
  menuId: string | undefined,
  fallbackItems: ManagementMenuItem[] = createDemoManagementMenuItems(),
): ManagementMenuItem[] {
  if (menuId === "demo.user") {
    return createDemoUserMenuItems();
  }

  if (menuId === "demo.developer") {
    return createDemoDeveloperMenuItems();
  }

  return fallbackItems;
}

/**
 * Fills demo management menu actions that were saved as empty mapping placeholders.
 */
export function hydrateDemoManagementMenuActions(
  actions: RuntimeAction[],
  fallbackItems: ManagementMenuItem[] = createDemoManagementMenuItems(),
): RuntimeAction[] {
  return actions.map((action) => {
    if (isManagementMenuAction(action)) {
      return {
        ...action,
        items: action.items.length > 0
          ? action.items
          : resolveDemoManagementMenuItems(action.menuId, fallbackItems),
      };
    }

    if (isActionGroup(action) && Array.isArray(action.actions)) {
      return {
        ...action,
        actions: hydrateDemoManagementMenuActions(action.actions, fallbackItems),
      };
    }

    return action;
  });
}

/**
 * Applies management menu hydration to runtime rules loaded from external mapping files.
 */
export function hydrateDemoManagementMenuRules(
  rules: RuntimeRule[],
  fallbackItems: ManagementMenuItem[] = createDemoManagementMenuItems(),
): RuntimeRule[] {
  return rules.map((rule) => ({
    ...rule,
    actions: hydrateDemoManagementMenuActions(rule.actions, fallbackItems),
  }));
}
