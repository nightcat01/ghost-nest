import type { ManagementMenuItem } from "../../core/types.js";

export type MenuSettingsExtensionConfig = {
  enabled: boolean;
};

export const menuSettingsExtension = {
  id: "menu-settings",
  name: "Menu Settings",
  description: "Developer extension page for inspecting and composing Nanika management menu presets.",
  route: "./dev-menu-settings.html",
  capabilities: [
    "management-menu-preview",
    "user-developer-menu-split",
    "menu-json-export",
  ],
} as const;

export const menuSettingsExtensionConfig = {
  enabled: true,
} satisfies MenuSettingsExtensionConfig;

/**
 * Creates the developer menu entry that opens Nanika menu settings.
 */
export function createMenuSettingsMenuItem(): ManagementMenuItem {
  return {
    id: menuSettingsExtension.id,
    label: menuSettingsExtension.name,
    description: menuSettingsExtension.description,
    actions: [
      { type: "close_management_menu" },
      { type: "navigate", route: menuSettingsExtension.route },
      { type: "log", label: "management.open_menu_settings" },
    ],
  };
}
