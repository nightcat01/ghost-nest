import type { ManagementMenuItem } from "../../core/types.js";

export type CharacterSettingsExtensionConfig = {
  enabled: boolean;
};

export const characterSettingsExtension = {
  id: "character-settings",
  name: "Character Settings",
  description: "Developer extension pages for editing character dialogue, scenes, crops, surfaces, and layers.",
  route: "./dev-character.html",
  capabilities: [
    "character-dialogue-editor",
    "character-crop-editor",
    "surface-layer-composition",
    "scene-composition",
    "saved-character-assets",
  ],
} as const;

export const characterSettingsExtensionConfig = {
  enabled: true,
} satisfies CharacterSettingsExtensionConfig;

/**
 * Creates the developer menu entry that opens character authoring settings.
 */
export function createCharacterSettingsMenuItem(): ManagementMenuItem {
  return {
    id: characterSettingsExtension.id,
    label: characterSettingsExtension.name,
    description: characterSettingsExtension.description,
    actions: [
      { type: "close_management_menu" },
      { type: "navigate", route: characterSettingsExtension.route },
      { type: "log", label: "management.open_character_settings" },
    ],
  };
}
