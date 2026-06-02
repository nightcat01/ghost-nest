import { getCharacterTouchPart } from "../core/hitTest.js";
import type {
  CharacterDefinition,
  InteractiveAreaId,
  RuntimeControlOptions,
  RuntimeAction,
  RuntimeCommandId,
  RuntimeEventName,
  RuntimeEventPayload,
} from "../core/types.js";
import type { RuntimeElements } from "./domElements.js";

type RuntimeEventEmitter = {
  emit: <TEventName extends RuntimeEventName>(
    eventName: TEventName,
    payload?: RuntimeEventPayload<TEventName>,
  ) => void;
};

type BindRuntimeDomEventsOptions = {
  elements: RuntimeElements;
  eventBus: RuntimeEventEmitter;
  character: CharacterDefinition;
  controls: RuntimeControlOptions;
  cleanupCallbacks: Array<() => void>;
  touchInteraction: () => void;
  runAction: (action: RuntimeAction) => void | Promise<void>;
  shouldSkipDialogue?: () => boolean;
  skipDialogue?: () => void;
};

/**
 * DOM dataset 값이 런타임에서 지원하는 관찰 영역 ID인지 확인합니다.
 */
function isInteractiveAreaId(value: string | undefined): value is InteractiveAreaId {
  return typeof value === "string" && value.length > 0;
}

/**
 * DOM dataset 값이 런타임에서 지원하는 명령 버튼 ID인지 확인합니다.
 */
function isRuntimeCommandId(value: string | undefined): value is RuntimeCommandId {
  return typeof value === "string" && value.length > 0;
}

export function bindRuntimeDomEvents({
  elements,
  eventBus,
  character,
  controls,
  cleanupCallbacks,
  touchInteraction,
  runAction,
  shouldSkipDialogue,
  skipDialogue,
}: BindRuntimeDomEventsOptions) {
  if (elements.restoreBadge) {
    const handleRestoreClick = () => {
      eventBus.emit("command:hide");
    };

    elements.restoreBadge.addEventListener("click", handleRestoreClick);
    cleanupCallbacks.push(() => elements.restoreBadge?.removeEventListener("click", handleRestoreClick));
  }

  if (controls.characterRightClick) {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      eventBus.emit("character:right_click");
    };

    elements.stage.addEventListener("contextmenu", handleContextMenu);
    cleanupCallbacks.push(() => {
      elements.stage.removeEventListener("contextmenu", handleContextMenu);
    });
  }

  const handleSpriteClick = (event: MouseEvent) => {
    if (shouldSkipDialogue?.()) {
      event.preventDefault();
      skipDialogue?.();
      return;
    }

    if (event.detail === 0) {
      if (controls.characterClick) {
        eventBus.emit("character:click");
      }
      return;
    }

    if (event.detail >= 2) {
      if (!controls.characterTouch) {
        return;
      }

      const part = getCharacterTouchPart(
        event.clientX,
        event.clientY,
        elements.sprite.getBoundingClientRect(),
        character.assets?.hitAreas,
      );
      eventBus.emit("character:double_click", { part });
      return;
    }

    if (!controls.characterTouch) {
      return;
    }

    const part = getCharacterTouchPart(
      event.clientX,
      event.clientY,
      elements.sprite.getBoundingClientRect(),
      character.assets?.hitAreas,
    );
    eventBus.emit("character:touch", { part });
  };

  if (controls.characterClick || controls.characterTouch) {
    elements.sprite.addEventListener("click", handleSpriteClick);
    cleanupCallbacks.push(() => elements.sprite.removeEventListener("click", handleSpriteClick));
  }

  if (controls.commandButtons) {
    elements.menuButtons.forEach((button) => {
      const command = button.dataset.command;

      if (!isRuntimeCommandId(command)) {
        return;
      }

      const handleCommandHover = () => {
        if (!controls.commandHoverDescription) {
          return;
        }

        eventBus.emit("command:hover", { command });
      };

      const handleCommandClick = () => {
        eventBus.emit(`command:${command}` as RuntimeEventName);
      };

      button.addEventListener("pointerenter", handleCommandHover);
      button.addEventListener("focusin", handleCommandHover);
      button.addEventListener("click", handleCommandClick);
      cleanupCallbacks.push(() => {
        button.removeEventListener("pointerenter", handleCommandHover);
        button.removeEventListener("focusin", handleCommandHover);
        button.removeEventListener("click", handleCommandClick);
      });
    });
  }

  if (controls.areaHoverDescription) {
    elements.observeAreas.forEach((areaElement) => {
      const emitAreaHover = () => {
        const area = areaElement.dataset.observeArea;

        if (!isInteractiveAreaId(area)) {
          return;
        }

        eventBus.emit("area:hover", { area });
      };

      areaElement.addEventListener("mouseenter", emitAreaHover);
      areaElement.addEventListener("focusin", emitAreaHover);
      cleanupCallbacks.push(() => {
        areaElement.removeEventListener("mouseenter", emitAreaHover);
        areaElement.removeEventListener("focusin", emitAreaHover);
      });
    });
  }

  if (controls.plugins) {
    document.querySelectorAll<HTMLButtonElement>("[data-plugin]").forEach((button) => {
      const pluginId = button.dataset.plugin;
      if (!pluginId) return;

      const handlePluginClick = () => {
        touchInteraction();
        void runAction({ type: "call_plugin", pluginId });
      };

      button.addEventListener("click", handlePluginClick);
      cleanupCallbacks.push(() => {
        button.removeEventListener("click", handlePluginClick);
      });
    });
  }
}
