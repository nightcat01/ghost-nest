import type {
  BuiltinRuntimeAction,
  DialogueEngine,
  ManagementMenuItem,
  ManagementMenuOptions,
  DialogueMessage,
  RuntimeControlOptions,
  RuntimeNavigationOptions,
  RuntimeAction,
  RuntimeActionHandler,
  RuntimeEventName,
  RuntimeEventPayload,
  RuntimePlugin,
  RuntimePreferenceStorageOptions,
  SpeechBalloonSizeOptions,
  SpeechLayoutOptions,
  RuntimeState,
  RuntimeUserPreferenceOptions,
  StorageAdapter,
} from "../core/types.js";
import type { RuntimeElements } from "./domElements.js";
import { closeManagementMenu, renderManagementMenu, resolveManagementMenuDisplay } from "./managementMenu.js";
import {
  cloneManagementMenuOptions,
  managementMenuStorageKey,
  readStoredManagementMenuOptions,
  readStoredRuntimeUiPreferences,
  runtimeUiStorageKey,
  type RuntimeUiPreferences,
} from "./runtimePreferences.js";

type RuntimeEventEmitter = {
  emit: <TEventName extends RuntimeEventName>(
    eventName: TEventName,
    payload?: RuntimeEventPayload<TEventName>,
  ) => void;
};

type ActionRunnerContext = {
  elements: RuntimeElements;
  state: RuntimeState;
  dialogue: DialogueEngine;
  pluginRegistry: Map<string, RuntimePlugin>;
  storageAdapter: StorageAdapter;
  actionTimers: Map<string, number>;
  managementMenu?: ManagementMenuOptions | undefined;
  navigation?: RuntimeNavigationOptions | undefined;
  speechLayout?: SpeechLayoutOptions | undefined;
  preferenceStorage?: RuntimePreferenceStorageOptions | undefined;
  defaultRuntimeUiPreferences?: RuntimeUiPreferences | undefined;
  defaultSpeechBalloonSize: SpeechBalloonSizeOptions;
  controls: RuntimeControlOptions;
  userPreferences: RuntimeUserPreferenceOptions;
  eventBus: RuntimeEventEmitter;
  renderSpeech: (message: DialogueMessage) => void;
  renderPreviewSpeech: (message: DialogueMessage) => void;
  renderCharacterState: () => void;
  applySurface: (surfaceId: string, options?: { startIdleLayers?: boolean }) => void;
  setScene: (sceneId: string) => void;
  addSceneOverlay: (sceneId: string, options?: { slot?: string; duration?: number }) => void;
  removeSceneOverlay: (slotOrSceneId: string) => void;
  setLayerAnimationActive: (layerId: string, isActive: boolean) => void;
  applySpeechBalloonSize: (size?: Partial<SpeechBalloonSizeOptions>) => void;
  addLog: (label: string) => void;
  touchInteraction: () => void;
};

const maxNestedActionDepth = 4;
const maxActionBatchSize = 24;

function getRuntimeUi(target: string) {
  return document.querySelector<HTMLElement>(`[data-runtime-ui="${target}"]`);
}

function getManagementMenuTargets(elements: RuntimeElements) {
  return {
    balloon: elements.balloonActionMenu,
    panel: elements.panelActionMenu,
  };
}

/**
 * Applies an optional host base path to relative site navigation routes.
 */
function resolveNavigationRoute(route: string, basePath: string | undefined) {
  if (!basePath || route.startsWith("/") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(route)) {
    return route;
  }

  const normalizedBasePath = basePath.replace(/\/$/, "");
  const normalizedRoute = route.replace(/^\.\//, "").replace(/^\//, "");

  return `${normalizedBasePath}/${normalizedRoute}`;
}

export function createActionRunner(context: ActionRunnerContext) {
  const {
    elements,
    state,
    dialogue,
    pluginRegistry,
    storageAdapter,
    actionTimers,
    managementMenu,
    navigation,
    speechLayout,
    preferenceStorage,
    defaultRuntimeUiPreferences,
    defaultSpeechBalloonSize,
    controls,
    userPreferences,
    eventBus,
    renderSpeech,
    renderPreviewSpeech,
    renderCharacterState,
    applySurface,
    setScene,
    addSceneOverlay,
    removeSceneOverlay,
    setLayerAnimationActive,
    applySpeechBalloonSize,
    addLog,
    touchInteraction,
  } = context;

  const actionHandlers = new Map<string, RuntimeActionHandler>();
  const defaultManagementMenuOptions = cloneManagementMenuOptions(managementMenu);
  const managementMenuOptions = cloneManagementMenuOptions(defaultManagementMenuOptions);
  const defaultSpeechLayout: Required<SpeechLayoutOptions> = {
    mode: speechLayout?.mode ?? "floating",
    placement: speechLayout?.placement ?? "below-character",
    overlayAnchor: speechLayout?.overlayAnchor ?? "center",
  };
  const runtimeUiPreferences: RuntimeUiPreferences = {
    ...defaultRuntimeUiPreferences,
  };
  const resolvedPreferenceStorage: Required<RuntimePreferenceStorageOptions> = {
    runtimeUi: preferenceStorage?.runtimeUi ?? "stored",
    managementMenu: preferenceStorage?.managementMenu ?? "stored",
  };
  const canReadStoredManagementMenu = resolvedPreferenceStorage.managementMenu === "stored";
  const canPersistManagementMenu = resolvedPreferenceStorage.managementMenu === "stored";
  const canReadStoredRuntimeUi = resolvedPreferenceStorage.runtimeUi === "stored";
  const canUseDefaultRuntimeUi = resolvedPreferenceStorage.runtimeUi !== "disabled";
  const canPersistRuntimeUi = resolvedPreferenceStorage.runtimeUi === "stored";

  const managementMenuOptionsReady = loadManagementMenuOptions();
  const runtimeUiPreferencesReady = loadRuntimeUiPreferences();
  let pendingMenuPreviewItemId: string | null = null;
  let lastPreviewedMenuItemId: string | null = null;
  let menuPreviewTimerId: number | null = null;

  async function loadManagementMenuOptions() {
    if (!canReadStoredManagementMenu) {
      return;
    }

    try {
      const storedOptions = readStoredManagementMenuOptions(
        await storageAdapter.get(managementMenuStorageKey),
      );

      if (storedOptions.defaultDisplay) {
        managementMenuOptions.defaultDisplay = storedOptions.defaultDisplay;
      }

      if (storedOptions.displays) {
        managementMenuOptions.displays = {
          ...managementMenuOptions.displays,
          ...storedOptions.displays,
        };
      }
    } catch (error) {
      console.warn("[GhostNest] Failed to load management menu options.", error);
    }
  }

  async function saveManagementMenuOptions() {
    if (!canPersistManagementMenu) {
      return;
    }

    try {
      await storageAdapter.set(managementMenuStorageKey, {
        defaultDisplay: managementMenuOptions.defaultDisplay,
        displays: managementMenuOptions.displays,
      });
    } catch (error) {
      console.warn("[GhostNest] Failed to save management menu options.", error);
    }
  }

  function applyBalloonTheme(theme: string | undefined) {
    if (!theme || theme === "default") {
      delete elements.stage.dataset.balloonTheme;
      return;
    }

    elements.stage.dataset.balloonTheme = theme;
  }

  function applyBalloonFontSize(size: string | undefined) {
    if (!size || size === "default") {
      delete elements.stage.dataset.balloonFontSize;
      if (elements.panelActionMenu) {
        delete elements.panelActionMenu.dataset.balloonFontSize;
      }
      return;
    }

    elements.stage.dataset.balloonFontSize = size;
    if (elements.panelActionMenu) {
      elements.panelActionMenu.dataset.balloonFontSize = size;
    }
  }

  /**
   * Applies the speech presentation layout to the stage dataset.
   */
  function applySpeechLayout(layout: SpeechLayoutOptions | undefined) {
    elements.stage.dataset.speechLayout = layout?.mode ?? defaultSpeechLayout.mode;
    elements.stage.dataset.speechPlacement = layout?.placement ?? defaultSpeechLayout.placement;
    elements.stage.dataset.speechAnchor = layout?.overlayAnchor ?? defaultSpeechLayout.overlayAnchor;
  }

  function applyCharacterPosition(position: RuntimeUiPreferences["characterPosition"]) {
    if (!userPreferences.characterPosition || !position) {
      return;
    }

    elements.stage.style.setProperty("--character-stage-x", `${position.x}px`);
    elements.stage.style.setProperty("--character-stage-y", `${position.y}px`);
    elements.stage.dataset.positionMode = "custom";
  }

  function applyRuntimeUiPreferences() {
    applyBalloonTheme(runtimeUiPreferences.balloonTheme);
    applyBalloonFontSize(runtimeUiPreferences.balloonFontSize);
    applySpeechLayout(runtimeUiPreferences.speechLayout);
    applySpeechBalloonSize(runtimeUiPreferences.speechBalloonSize);
    applyCharacterPosition(runtimeUiPreferences.characterPosition);
  }

  async function loadRuntimeUiPreferences() {
    if (!canReadStoredRuntimeUi) {
      if (!canUseDefaultRuntimeUi) {
        delete runtimeUiPreferences.balloonTheme;
        delete runtimeUiPreferences.balloonFontSize;
        delete runtimeUiPreferences.speechLayout;
        delete runtimeUiPreferences.speechBalloonSize;
        delete runtimeUiPreferences.characterPosition;
      }

      applyRuntimeUiPreferences();
      return;
    }

    try {
      const storedPreferences = readStoredRuntimeUiPreferences(
        await storageAdapter.get(runtimeUiStorageKey),
      );

      if (storedPreferences.balloonTheme) {
        runtimeUiPreferences.balloonTheme = storedPreferences.balloonTheme;
      } else if (defaultRuntimeUiPreferences?.balloonTheme) {
        runtimeUiPreferences.balloonTheme = defaultRuntimeUiPreferences.balloonTheme;
      } else {
        delete runtimeUiPreferences.balloonTheme;
      }

      if (storedPreferences.balloonFontSize) {
        runtimeUiPreferences.balloonFontSize = storedPreferences.balloonFontSize;
      } else if (defaultRuntimeUiPreferences?.balloonFontSize) {
        runtimeUiPreferences.balloonFontSize = defaultRuntimeUiPreferences.balloonFontSize;
      } else {
        delete runtimeUiPreferences.balloonFontSize;
      }

      if (storedPreferences.speechLayout) {
        runtimeUiPreferences.speechLayout = storedPreferences.speechLayout;
      } else if (defaultRuntimeUiPreferences?.speechLayout) {
        runtimeUiPreferences.speechLayout = defaultRuntimeUiPreferences.speechLayout;
      } else {
        delete runtimeUiPreferences.speechLayout;
      }

      if (storedPreferences.speechBalloonSize) {
        runtimeUiPreferences.speechBalloonSize = storedPreferences.speechBalloonSize;
      } else if (defaultRuntimeUiPreferences?.speechBalloonSize) {
        runtimeUiPreferences.speechBalloonSize = defaultRuntimeUiPreferences.speechBalloonSize;
      } else {
        delete runtimeUiPreferences.speechBalloonSize;
      }

      if (storedPreferences.characterPosition) {
        runtimeUiPreferences.characterPosition = storedPreferences.characterPosition;
      } else if (defaultRuntimeUiPreferences?.characterPosition) {
        runtimeUiPreferences.characterPosition = defaultRuntimeUiPreferences.characterPosition;
      } else {
        delete runtimeUiPreferences.characterPosition;
      }

      applyRuntimeUiPreferences();
    } catch (error) {
      console.warn("[GhostNest] Failed to load runtime UI options.", error);
    }
  }

  async function saveRuntimeUiPreferences() {
    if (!canPersistRuntimeUi) {
      return;
    }

    try {
      await storageAdapter.set(runtimeUiStorageKey, runtimeUiPreferences);
    } catch (error) {
      console.warn("[GhostNest] Failed to save runtime UI options.", error);
    }
  }

  function resetManagementMenuOptions() {
    if (defaultManagementMenuOptions.defaultDisplay) {
      managementMenuOptions.defaultDisplay = defaultManagementMenuOptions.defaultDisplay;
    } else {
      delete managementMenuOptions.defaultDisplay;
    }

    managementMenuOptions.displays = { ...defaultManagementMenuOptions.displays };
  }

  function resetRuntimeUiPreferences() {
    delete runtimeUiPreferences.balloonTheme;
    delete runtimeUiPreferences.balloonFontSize;
    delete runtimeUiPreferences.speechLayout;
    delete runtimeUiPreferences.speechBalloonSize;
    delete runtimeUiPreferences.characterPosition;
    if (canUseDefaultRuntimeUi) {
      Object.assign(runtimeUiPreferences, defaultRuntimeUiPreferences);
    }
    applyRuntimeUiPreferences();
    elements.stage.style.removeProperty("--character-stage-x");
    elements.stage.style.removeProperty("--character-stage-y");
    delete elements.stage.dataset.positionMode;
  }

  function registerAction(type: string, handler: RuntimeActionHandler) {
    actionHandlers.set(type, handler);
  }

  function previewManagementMenuItem(item: ManagementMenuItem) {
    if (!item.description) {
      return;
    }

    if (item.id === pendingMenuPreviewItemId || item.id === lastPreviewedMenuItemId) {
      return;
    }

    if (menuPreviewTimerId !== null) {
      window.clearTimeout(menuPreviewTimerId);
    }

    pendingMenuPreviewItemId = item.id;
    menuPreviewTimerId = window.setTimeout(async () => {
      menuPreviewTimerId = null;

      if (pendingMenuPreviewItemId !== item.id || !item.description) {
        return;
      }

      pendingMenuPreviewItemId = null;
      lastPreviewedMenuItemId = item.id;
      renderPreviewSpeech(await dialogue.custom(item.description));
    }, 160);
  }

  // Register built-in actions
  registerAction("speak", async (action, _) => {
    if (!controls.speech) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "speak" }>;
    renderSpeech(await dialogue.line(a.category));
  });

  registerAction("speak_text", async (action, _) => {
    if (!controls.speech) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "speak_text" }>;
    renderSpeech(await dialogue.custom(a.text));
  });

  registerAction("speak_script", async (action, _) => {
    if (!controls.speech) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "speak_script" }>;
    const message = await dialogue.custom(a.text);
    renderSpeech({ ...message, script: a.script });
  });

  registerAction("change_expression", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "change_expression" }>;
    state.expression = a.expression;
    if (a.clearTouchedPart) {
      state.lastTouchedPart = null;
    }
    renderCharacterState();
  });

  registerAction("surface", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "surface" }>;

    applySurface(a.id, a.startIdleLayers === undefined ? undefined : { startIdleLayers: a.startIdleLayers });
  });

  registerAction("scene", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "scene" }>;

    setScene(a.id);
  });

  registerAction("scene_overlay", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "scene_overlay" }>;

    if (a.active === false) {
      removeSceneOverlay(a.slot || a.id);
      return;
    }

    addSceneOverlay(a.id, {
      ...(a.slot ? { slot: a.slot } : {}),
      ...(a.duration ? { duration: a.duration } : {}),
    });
  });

  registerAction("set_touched_part", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "set_touched_part" }>;
    state.lastTouchedPart = a.part;
    renderCharacterState();
  });

  registerAction("toggle_hidden", () => {
    state.isHidden = !state.isHidden;
    elements.stage.classList.toggle("is-hidden", state.isHidden);

    if (elements.restoreBadge) {
      elements.restoreBadge.hidden = !state.isHidden;
    }
  });

  registerAction("call_plugin", async (action, _) => {
    if (!controls.plugins) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "call_plugin" }>;
    const plugin = pluginRegistry.get(a.pluginId);

    if (!plugin) {
      renderSpeech(await dialogue.custom(`아직 '${a.pluginId}' 기능은 연결되어 있지 않아요.`));
      return;
    }

    const originalExpression = state.expression;
    state.expression = "thinking";
    renderCharacterState();

    try {
      const result = await plugin.execute();

      if (result.expression) {
        state.expression = result.expression;
      } else {
        state.expression = originalExpression;
      }

      state.lastTouchedPart = null;
      renderCharacterState();
      
      const message = await dialogue.custom(`${result.title}. ${result.message}`);
      renderSpeech(result.script ? { ...message, script: result.script } : message);
      
    } catch (err) {
      state.expression = "surprised";
      renderCharacterState();
      renderSpeech(await dialogue.custom(`'${a.pluginId}' 기능 실행 중 문제가 발생했어요.`));
    }
  });

  registerAction("log", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "log" }>;
    addLog(a.label);
  });

  registerAction("touch_interaction", () => {
    touchInteraction();
  });

  registerAction("mark_prompted", () => {
    state.lastPromptedAt = Date.now();
  });

  registerAction("run_sequence", async (action, context) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "run_sequence" }>;
    await context.runActions(a.actions);
  });

  registerAction("run_parallel", async (action, context) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "run_parallel" }>;
    await Promise.all(a.actions.map((nestedAction) => context.runActions([nestedAction])));
  });

  registerAction("run_random", async (action, context) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "run_random" }>;
    const nextAction = a.actions[Math.floor(Math.random() * a.actions.length)];

    if (!nextAction) {
      return;
    }

    await context.runActions([nextAction]);
  });

  registerAction("play_animation", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "play_animation" }>;
    elements.sprite.dataset.animation = a.animation;

    if (a.duration) {
      window.setTimeout(() => {
        if (elements.sprite.dataset.animation === a.animation) {
          delete elements.sprite.dataset.animation;
        }
      }, a.duration);
    }
  });

  registerAction("play_layer_animation", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "play_layer_animation" }>;
    const isActive = a.active ?? true;
    const timerKey = `layer_animation:${a.layerId}`;
    const existingTimer = actionTimers.get(timerKey);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
      actionTimers.delete(timerKey);
    }

    setLayerAnimationActive(a.layerId, isActive);

    if (isActive && a.duration) {
      const timerId = window.setTimeout(() => {
        setLayerAnimationActive(a.layerId, false);
        actionTimers.delete(timerKey);
      }, a.duration);
      actionTimers.set(timerKey, timerId);
    }
  });

  registerAction("open_ui", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "open_ui" }>;
    const targetElement = getRuntimeUi(a.target);
    targetElement?.removeAttribute("hidden");
    elements.stage.dispatchEvent(new CustomEvent("ghostnest:open-ui", { detail: a }));
  });

  registerAction("close_ui", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "close_ui" }>;
    const targetElement = getRuntimeUi(a.target);
    targetElement?.setAttribute("hidden", "");
    elements.stage.dispatchEvent(new CustomEvent("ghostnest:close-ui", { detail: a }));
  });

  registerAction("navigate", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "navigate" }>;
    const route = resolveNavigationRoute(a.route, navigation?.basePath);

    if (navigation?.navigate) {
      void navigation.navigate(route);
      return;
    }

    window.location.assign(route);
  });

  registerAction("set_state", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "set_state" }>;
    state.mode = a.state;
    elements.stage.dataset.state = a.state;
  });

  registerAction("emit_event", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "emit_event" }>;
    eventBus.emit(a.event, a.payload as never);
  });

  registerAction("play_sound", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "play_sound" }>;
    const audio = new Audio(a.sound);
    audio.volume = a.volume ?? 1;
    void audio.play();
  });

  registerAction("save_data", async (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "save_data" }>;
    state.data[a.key] = a.value;
    await storageAdapter.set(a.key, a.value);
  });

  registerAction("load_data", async (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "load_data" }>;
    const value = await storageAdapter.get(a.key);
    state.data[a.saveTo ?? a.key] = value;

    if (a.speak) {
      renderSpeech(await dialogue.custom(value === null ? "저장된 값이 아직 없어요." : String(value)));
    }
  });

  registerAction("show_notification", async (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "show_notification" }>;
    elements.stage.dispatchEvent(new CustomEvent("ghostnest:notification", { detail: a }));

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(a.title, { body: a.message });
      return;
    }

    renderSpeech(await dialogue.custom(`${a.title}. ${a.message}`));
  });

  registerAction("start_timer", (action, context) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "start_timer" }>;
    const existingTimer = actionTimers.get(a.timer);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      actionTimers.delete(a.timer);
      void context.runActions(a.actions);
    }, a.duration);

    actionTimers.set(a.timer, timerId);
  });

  registerAction("stop_timer", (action, _) => {
    const a = action as Extract<BuiltinRuntimeAction, { type: "stop_timer" }>;
    const timerId = actionTimers.get(a.timer);

    if (timerId) {
      window.clearTimeout(timerId);
      actionTimers.delete(a.timer);
    }
  });

  registerAction("move_character", async (action, _) => {
    if (!userPreferences.characterPosition) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "move_character" }>;
    await runtimeUiPreferencesReady;

    runtimeUiPreferences.characterPosition = { x: a.x, y: a.y };
    applyCharacterPosition(runtimeUiPreferences.characterPosition);
    await saveRuntimeUiPreferences();
  });

  registerAction("change_balloon", async (action, _) => {
    if (!userPreferences.speechTheme) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "change_balloon" }>;
    await runtimeUiPreferencesReady;

    runtimeUiPreferences.balloonTheme = a.theme;
    applyBalloonTheme(runtimeUiPreferences.balloonTheme);
    await saveRuntimeUiPreferences();
  });

  registerAction("change_balloon_font_size", async (action, _) => {
    if (!userPreferences.speechFontSize) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "change_balloon_font_size" }>;
    await runtimeUiPreferencesReady;

    runtimeUiPreferences.balloonFontSize = a.size;
    applyBalloonFontSize(runtimeUiPreferences.balloonFontSize);
    await saveRuntimeUiPreferences();
  });

  registerAction("change_speech_layout", async (action, _) => {
    if (!userPreferences.speechLayout) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "change_speech_layout" }>;
    await runtimeUiPreferencesReady;

    runtimeUiPreferences.speechLayout = {
      mode: a.mode ?? runtimeUiPreferences.speechLayout?.mode ?? defaultSpeechLayout.mode,
      placement: a.placement ?? runtimeUiPreferences.speechLayout?.placement ?? defaultSpeechLayout.placement,
      overlayAnchor: a.overlayAnchor ?? runtimeUiPreferences.speechLayout?.overlayAnchor ?? defaultSpeechLayout.overlayAnchor,
    };
    applySpeechLayout(runtimeUiPreferences.speechLayout);
    await saveRuntimeUiPreferences();
  });

  registerAction("set_speech_balloon_size", async (action, _) => {
    if (!userPreferences.speechSize) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "set_speech_balloon_size" }>;
    await runtimeUiPreferencesReady;

    if (a.reset) {
      delete runtimeUiPreferences.speechBalloonSize;
      applySpeechBalloonSize(defaultSpeechBalloonSize);
      await saveRuntimeUiPreferences();
      return;
    }

    runtimeUiPreferences.speechBalloonSize = {
      ...runtimeUiPreferences.speechBalloonSize,
      ...a.size,
    };
    applySpeechBalloonSize(runtimeUiPreferences.speechBalloonSize);
    await saveRuntimeUiPreferences();
  });

  registerAction("open_management_menu", async (action, context) => {
    if (!controls.managementMenu) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "open_management_menu" }>;
    await managementMenuOptionsReady;

    renderManagementMenu({
      action: a,
      targets: getManagementMenuTargets(elements),
      runActions: context.runActions,
      previewItem: previewManagementMenuItem,
      display: resolveManagementMenuDisplay(a, managementMenuOptions),
    });
  });

  registerAction("set_management_menu_display", async (action, _) => {
    if (!controls.managementMenu) {
      return;
    }

    const a = action as Extract<BuiltinRuntimeAction, { type: "set_management_menu_display" }>;
    await managementMenuOptionsReady;

    if (a.menuId) {
      managementMenuOptions.displays = {
        ...managementMenuOptions.displays,
        [a.menuId]: a.display,
      };
      await saveManagementMenuOptions();
      return;
    }

    managementMenuOptions.defaultDisplay = a.display;
    await saveManagementMenuOptions();
  });

  registerAction("reset_runtime_ui", async () => {
    await Promise.all([managementMenuOptionsReady, runtimeUiPreferencesReady]);
    resetManagementMenuOptions();
    resetRuntimeUiPreferences();
    await Promise.all([
      canPersistManagementMenu ? storageAdapter.remove(managementMenuStorageKey) : Promise.resolve(),
      canPersistRuntimeUi ? storageAdapter.remove(runtimeUiStorageKey) : Promise.resolve(),
    ]);
  });

  registerAction("close_management_menu", () => {
    if (menuPreviewTimerId !== null) {
      window.clearTimeout(menuPreviewTimerId);
      menuPreviewTimerId = null;
    }
    pendingMenuPreviewItemId = null;
    lastPreviewedMenuItemId = null;
    closeManagementMenu(getManagementMenuTargets(elements));
  });

  async function runAction(action: RuntimeAction, depth = 0) {
    const handler = actionHandlers.get(action.type);
    
    if (handler) {
      await handler(action, {
        runActions: (actions) => runActions(actions, depth + 1),
      });
    } else {
      console.warn(`[GhostNest] 알 수 없는 액션 타입입니다: ${action.type}`, action);
    }
  }

  async function runActions(actions: RuntimeAction[], depth = 0) {
    if (depth > maxNestedActionDepth) {
      console.warn(`[GhostNest] 액션 묶음 중첩이 너무 깊습니다. 최대 ${maxNestedActionDepth}단계까지만 실행합니다.`, actions);
      return;
    }

    if (actions.length > maxActionBatchSize) {
      console.warn(`[GhostNest] 한 번에 실행할 액션이 너무 많습니다. 최대 ${maxActionBatchSize}개까지만 실행합니다.`, actions);
      actions = actions.slice(0, maxActionBatchSize);
    }

    for (const action of actions) {
      await runAction(action, depth);
    }
  }

  return {
    runAction,
    runActions,
    registerAction,
  };
}
