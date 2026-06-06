import type { ManagementMenuItem } from "../../core/types.js";
import { enabledExtensions } from "../../ghost/nanika.config.js";
import { createCharacterSettingsMenuItem } from "../../plugins/characterSettings/index.js";
import { createComfyAssetGeneratorMenuItem } from "../../plugins/comfyAssetGenerator/index.js";
import { createMenuSettingsMenuItem } from "../../plugins/menuSettings/index.js";
import { createNanikaMappingMenuItem } from "../../plugins/nanikaMapping/index.js";

/**
 * Creates demo-only developer tools that should not be mixed into the normal user menu by default.
 */
export function createDeveloperMenuItems(): ManagementMenuItem[] {
  const menuItems: ManagementMenuItem[] = [
    {
      id: "system-info",
      label: "시스템 정보",
      description: "시스템 도구 메뉴를 열어요. 패널형 메뉴 예시로 쓰기 좋아요.",
      actions: [
        {
          type: "open_management_menu",
          menuId: "system-tools",
          title: "시스템 도구",
          items: [
            {
              id: "system-info-run",
              label: "시스템 정보 보기",
              description: "현재 브라우저와 런타임 정보를 확인해요.",
              actions: [
                { type: "call_plugin", pluginId: "system_info" },
                { type: "log", label: "management.system_info" },
              ],
            },
            {
              id: "weather-panel-run",
              label: "날씨 확인",
              description: "패널 안에서 날씨 기능을 실행해요.",
              actions: [
                { type: "call_plugin", pluginId: "weather" },
                { type: "log", label: "management.panel.weather" },
              ],
            },
            {
              id: "panel-close",
              label: "닫기",
              actions: [{ type: "close_management_menu" }],
            },
          ],
        },
        { type: "log", label: "management.open_system_panel" },
      ],
    },
    {
      id: "hitbox-editor",
      label: "히트박스 설정",
      description: "캐릭터 터치 영역을 조정하는 개발자 도구를 열어요.",
      actions: [
        { type: "close_management_menu" },
        { type: "open_ui", target: "hitbox_editor" },
        { type: "log", label: "management.open_hitbox_editor" },
      ],
    },
  ];

  if (enabledExtensions["character-settings"]?.enabled) {
    menuItems.push(createCharacterSettingsMenuItem());
  }

  if (enabledExtensions["comfy-asset-generator"]?.enabled) {
    menuItems.push(createComfyAssetGeneratorMenuItem());
  }

  if (enabledExtensions["menu-settings"]?.enabled) {
    menuItems.push(createMenuSettingsMenuItem());
  }

  if (enabledExtensions["nanika-mapping"]?.enabled) {
    menuItems.push(createNanikaMappingMenuItem());
  }

  return menuItems;
}
