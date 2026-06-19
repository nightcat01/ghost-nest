import { createDialogueEngine } from "../core/dialogueEngine.js";
import { validateDialogueScript } from "../core/dialogueScriptValidator.js";
import { createEventBus } from "../core/eventBus.js";
import { createRuntimeState } from "../core/runtimeState.js";
import { createLocalStorageAdapter, createMemoryStorageAdapter } from "../core/storageAdapter.js";
import { createExternalEventBridge } from "../core/eventBridge.js";
import { createRuntimeDiagnostics } from "../devtools/runtimeDiagnostics.js";
import { createActionRunner } from "./actionRunner.js";
import { createCharacterRenderer } from "./characterRenderer.js";
import { createDefaultRules } from "./defaultRules.js";
import { createDialoguePlayer } from "./dialoguePlayer.js";
import { createSceneRenderer } from "./sceneRenderer.js";
import { getRuntimeElements } from "./domElements.js";
import { initFloatingLayout } from "./floatingLayout.js";
import { initHitboxEditor } from "../devtools/hitboxEditor.js";
import { bindRuntimeDomEvents } from "./runtimeEventBindings.js";
import { startRuntimeTimers } from "./runtimeTimers.js";
import { bindRuntimeRuleEvents } from "./ruleRunner.js";
import {
  defaultControls,
  defaultFeatures,
  defaultMaxLogItems,
  defaultSpeechBalloonSize,
  defaultSpriteSize,
  defaultTiming,
  defaultTyping,
  defaultUserPreferences,
} from "./runtimeDefaults.js";
import type {
  CharacterDefinition,
  CharacterExpression,
  DialogueEngine,
  DialogueChoice,
  DialogueMessage,
  GhostRuntime,
  GhostRuntimeOptions,
  RuntimeCharacterChangeOptions,
  RuntimeEventName,
  RuntimeSceneOptions,
} from "../core/types.js";

/**
 * Creates the default restore button when the host page does not provide one.
 */
function createDefaultRestoreBadge() {
  const badge = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");

  badge.type = "button";
  badge.className = "restore-badge";
  badge.hidden = true;
  badge.setAttribute("aria-label", "나니카 다시 불러오기");
  badge.dataset.runtimeGenerated = "true";
  icon.className = "badge-icon";
  icon.textContent = "↩";
  label.className = "restore-badge-label";
  label.textContent = "다시 불러오기";
  badge.append(icon, label);
  document.body.append(badge);

  return badge;
}

/**
 * Builds the scene options visible to the runtime from host options and character assets.
 */
function createRuntimeSceneOptions(character: CharacterDefinition, sceneOptions: RuntimeSceneOptions | undefined) {
  const hasCharacterDefaultScene = Boolean(character.assets)
    && Object.prototype.hasOwnProperty.call(character.assets, "defaultScene");
  const characterScene = character.assets
    && (hasCharacterDefaultScene || character.assets.scenes || character.assets.sceneSets)
    ? {
      ...(hasCharacterDefaultScene ? { defaultScene: character.assets.defaultScene } : {}),
      ...(character.assets.scenes ? { scenes: character.assets.scenes } : {}),
      ...(character.assets.sceneSets ? { sceneSets: character.assets.sceneSets } : {}),
    }
    : undefined;

  return characterScene || sceneOptions
    ? {
      ...(sceneOptions?.canvas !== undefined ? { canvas: sceneOptions.canvas } : {}),
      ...(sceneOptions?.layers !== undefined ? { layers: sceneOptions.layers } : {}),
      ...(sceneOptions?.defaultScene !== undefined ? { defaultScene: sceneOptions.defaultScene } : {}),
      ...(characterScene?.defaultScene !== undefined ? { defaultScene: characterScene.defaultScene } : {}),
      ...((sceneOptions?.scenes || characterScene?.scenes)
        ? { scenes: { ...(sceneOptions?.scenes ?? {}), ...(characterScene?.scenes ?? {}) } }
        : {}),
      ...((sceneOptions?.sceneSets || characterScene?.sceneSets)
        ? { sceneSets: { ...(sceneOptions?.sceneSets ?? {}), ...(characterScene?.sceneSets ?? {}) } }
        : {}),
    }
    : undefined;
}

/**
 * Creates the active dialogue engine for one character.
 */
function createCharacterDialogueEngine(character: CharacterDefinition, dialogueEngine?: DialogueEngine) {
  return dialogueEngine ?? createDialogueEngine({
    profile: character.profile,
    lines: character.lines,
  });
}

/**
 * 캐릭터 데이터, 플러그인, DOM selector를 받아 웹 캐릭터 런타임을 생성합니다.
 */
function omitUndefinedProperties<T extends Record<string, unknown>>(value: T | undefined): Partial<T> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

export function createGhostRuntime(options: GhostRuntimeOptions): GhostRuntime {
  const timing = {
    ...defaultTiming,
    ...options.timing,
  };
  const controls = {
    ...defaultControls,
    ...defaultFeatures,
    ...omitUndefinedProperties(options.features),
    ...omitUndefinedProperties(options.controls),
  };
  const userPreferences = {
    ...defaultUserPreferences,
    ...options.userPreferences,
  };
  const spriteSize = {
    ...defaultSpriteSize,
    ...options.spriteSize,
  };
  const typing = {
    ...defaultTyping,
    ...options.typing,
  };
  const speechLayout = {
    mode: options.speechLayout?.mode ?? "floating",
    placement: options.speechLayout?.placement ?? "below-character",
    overlayAnchor: options.speechLayout?.overlayAnchor ?? "center",
  };
  const speechBalloonSize = {
    ...defaultSpeechBalloonSize,
    ...options.speechBalloonSize,
  };
  const maxLogItems = options.maxLogItems ?? defaultMaxLogItems;
  const elements = getRuntimeElements(options.selectors, options.root);
  const generatedRestoreBadge = elements.restoreBadge ? null : createDefaultRestoreBadge();

  if (generatedRestoreBadge) {
    elements.restoreBadge = generatedRestoreBadge;
  }

  const hadRuntimeScopeClass = elements.stage.classList.contains("ghostnest-runtime");
  elements.stage.classList.add("ghostnest-runtime");
  elements.stage.dataset.ready = "false";
  elements.stage.dataset.stageMode = options.stageMode ?? "content";
  elements.stage.dataset.sceneViewportAnchor = options.sceneLayout?.viewportAnchor ?? "center";
  elements.stage.dataset.characterHoverEffect = controls.characterHoverEffect ? "on" : "off";
  if (options.hideUntilReady) {
    elements.stage.dataset.hideUntilReady = "true";
  } else {
    delete elements.stage.dataset.hideUntilReady;
  }
  const eventBus = createEventBus();
  const pluginRegistry = new Map(options.plugins?.map((plugin) => [plugin.id, plugin]) ?? []);
  const rules = [
    ...(options.includeDefaultRules === false ? [] : createDefaultRules(timing)),
    ...(options.rules ?? []),
  ];
  let currentCharacter = options.character;
  let currentDialogue = createCharacterDialogueEngine(currentCharacter, options.dialogueEngine);
  const dialogue: DialogueEngine = {
    line: (category) => currentDialogue.line(category),
    custom: (text) => currentDialogue.custom(text),
  };
  
  const storageAdapter = controls.persistence
    ? options.storageAdapter ?? createLocalStorageAdapter(`ghostNest:${currentCharacter.profile.id}`)
    : createMemoryStorageAdapter();
  
  const state = createRuntimeState();
  state.expression = options.initialExpression ?? currentCharacter.profile.defaultExpression ?? state.expression;
  const cleanupCallbacks: Array<() => void> = [];
  const actionTimers = new Map<string, number>();
  const ruleCooldowns = new Map<string, number>();
  const runtimeScene = createRuntimeSceneOptions(currentCharacter, options.scene);
  const sceneRenderer = createSceneRenderer({
    elements,
    scene: runtimeScene,
    initialScene: options.initialScene,
  });
  const characterRenderer = createCharacterRenderer({ elements, character: currentCharacter });
  const diagnostics = createRuntimeDiagnostics({
    selectors: controls.devtools && controls.diagnostics ? options.devtools?.diagnostics?.selectors : undefined,
    state,
    timing,
    actionTimers,
    maxLogItems,
    getLayoutMetrics() {
      const areaRect = (elements.root instanceof Element
        ? elements.root
        : elements.stage.offsetParent ?? document.documentElement).getBoundingClientRect();
      const speechRect = elements.speechBalloon?.getBoundingClientRect();

      return {
        area: areaRect,
        speech: speechRect ?? null,
      };
    },
  });
  const dialoguePlayer = createDialoguePlayer({
    typingInterval: controls.typing && typing.enabled ? typing.interval : 0,
    onText(text) {
      elements.speechText.textContent += text;
    },
    onClear() {
      elements.speechText.textContent = "";
    },
    onSurface(id) {
      elements.stage.dispatchEvent(new CustomEvent("ghostnest:surface-change", { detail: { id } }));
    },
    onChoice(choices) {
      renderDialogueChoices(choices);
    },
    onMouth(isActive) {
      characterRenderer.setMouthAnimationActive(isActive);
    },
    onEnd() {
      characterRenderer.setMouthAnimationActive(false);
      state.mode = "idle";
      characterRenderer.setMode(state.mode);
      diagnostics.renderStatusPanel();
    },
    onStop() {
      characterRenderer.setMouthAnimationActive(false);
      state.mode = "idle";
      characterRenderer.setMode(state.mode);
      diagnostics.renderStatusPanel();
    },
  });

  /**
   * 말풍선과 대사창 크기 CSS 변수를 런타임 stage에 반영합니다.
   */
  function applySpeechBalloonSize(size?: Partial<typeof speechBalloonSize>) {
    const resolvedSize = {
      ...speechBalloonSize,
      ...size,
    };

    elements.stage.style.setProperty("--speech-stage-width", resolvedSize.stageWidth);
    elements.stage.style.setProperty("--speech-balloon-width", resolvedSize.width);
    elements.stage.style.setProperty("--speech-balloon-max-width", resolvedSize.maxWidth);
    elements.stage.style.setProperty("--speech-balloon-action-menu-max-height", resolvedSize.actionMenuMaxHeight);
    elements.stage.style.setProperty("--speech-balloon-min-height", resolvedSize.minHeight);
    elements.stage.style.setProperty("--speech-balloon-max-height", resolvedSize.maxHeight);
    elements.stage.style.setProperty("--speech-dialogue-width", resolvedSize.dialogueWidth);
    elements.stage.style.setProperty("--speech-dialogue-max-width", resolvedSize.dialogueMaxWidth);
    elements.stage.style.setProperty("--speech-dialogue-height", resolvedSize.dialogueHeight);
    elements.stage.style.setProperty("--speech-dialogue-min-height", resolvedSize.dialogueMinHeight);
    elements.stage.style.setProperty("--speech-dialogue-max-height", resolvedSize.dialogueMaxHeight);
    elements.stage.style.setProperty("--speech-balloon-mobile-width", resolvedSize.mobileWidth);
    elements.stage.style.setProperty("--speech-balloon-mobile-max-height", resolvedSize.mobileMaxHeight);
    elements.stage.style.setProperty("--speech-balloon-mobile-action-menu-max-height", resolvedSize.mobileActionMenuMaxHeight);
  }

  elements.stage.style.setProperty("--character-sprite-width", spriteSize.desktopWidth);
  elements.stage.style.setProperty("--character-sprite-height", spriteSize.desktopHeight);
  elements.stage.style.setProperty("--character-sprite-mobile-width", spriteSize.mobileWidth);
  elements.stage.style.setProperty("--character-sprite-mobile-height", spriteSize.mobileHeight);
  applySpeechBalloonSize();
  elements.stage.dataset.speechLayout = speechLayout.mode;
  elements.stage.dataset.speechPlacement = speechLayout.placement;
  elements.stage.dataset.speechAnchor = speechLayout.overlayAnchor;
  if (controls.floatingLayout) {
    cleanupCallbacks.push(initFloatingLayout({ elements }));
  }

  /**
   * 현재 대화 메시지를 말풍선 DOM에 반영합니다.
   */
  function clearDialogueChoices() {
    elements.balloonActionMenu?.replaceChildren();

    if (elements.balloonActionMenu) {
      elements.balloonActionMenu.hidden = true;
      delete elements.balloonActionMenu.dataset.managementMenuDisplay;
    }
  }

  function resetSpeechScroll({ resetMenu = true } = {}) {
    if (elements.speechBalloon) {
      elements.speechBalloon.scrollTop = 0;
    }

    elements.speechText.scrollTop = 0;

    if (resetMenu && elements.balloonActionMenu) {
      elements.balloonActionMenu.scrollTop = 0;
    }
  }

  function renderDialogueChoices(choices: DialogueChoice[]) {
    const menuElement = elements.balloonActionMenu;

    if (!menuElement) {
      return;
    }

    menuElement.replaceChildren();
    menuElement.dataset.managementMenuDisplay = "choice";

    choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.dataset.dialogueChoice = String(index);
      button.addEventListener("click", () => {
        clearDialogueChoices();
        void runActions(choice.actions);
      });
      menuElement.append(button);
    });

    menuElement.hidden = false;
    resetSpeechScroll();
  }

  function renderSpeech(message: DialogueMessage) {
    elements.speakerName.textContent = message.speaker;

    dialoguePlayer.stop();
    clearDialogueChoices();
    elements.speechText.textContent = "";
    resetSpeechScroll();

    const script = message.script ?? [
      { type: "text" as const, value: message.text },
      { type: "end" as const },
    ];
    const validation = validateDialogueScript(script, {
      knownSurfaceIds: Object.keys(currentCharacter.assets?.surfaces ?? {}),
    });

    if (!validation.valid) {
      console.warn("[GhostNest] Invalid DialogueScript. Falling back to plain text.", validation.errors);
      void dialoguePlayer.play([
        { type: "text", value: message.text },
        { type: "end" },
      ]);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn("[GhostNest] DialogueScript warnings.", validation.warnings);
    }

    state.mode = "talking";
    elements.stage.dataset.state = state.mode;
    void dialoguePlayer.play(validation.script);
  }

  /**
   * 런타임 상태를 sprite dataset에 반영해 CSS 표정/포즈를 전환합니다.
   */
  function renderCharacterState() {
    characterRenderer.renderState(state);
  }

  /**
   * 마지막 터치 부위를 지우고 지정한 기본 표정으로 되돌립니다.
   */
  function resetCharacterPose(expression: CharacterExpression = "neutral") {
    state.expression = expression;
    state.lastTouchedPart = null;
    renderCharacterState();
  }

  /**
   * 사용자 상호작용 시각을 갱신해 idle/random prompt 타이머를 조절합니다.
   */
  function touchInteraction() {
    state.lastInteractionAt = Date.now();
  }

  const { runAction, runActions, registerAction } = createActionRunner({
    elements,
    state,
    dialogue,
    pluginRegistry,
    storageAdapter,
    actionTimers,
    managementMenu: options.managementMenu,
    navigation: options.navigation,
    speechLayout,
    preferenceStorage: options.preferenceStorage,
    defaultRuntimeUiPreferences: {
      balloonFontSize: "small",
      ...(options.balloonTheme ? { balloonTheme: options.balloonTheme } : {}),
      ...(options.characterPlacement ? { characterPlacement: options.characterPlacement } : {}),
    },
    defaultSpeechBalloonSize: speechBalloonSize,
    controls,
    userPreferences,
    eventBus,
    renderSpeech,
    renderCharacterState,
    applySurface: characterRenderer.applySurface,
    setScene: sceneRenderer.setScene,
    addSceneOverlay: sceneRenderer.addSceneOverlay,
    removeSceneOverlay: sceneRenderer.removeSceneOverlay,
    setLayerAnimationActive: characterRenderer.setLayerAnimationActive,
    applySpeechBalloonSize,
    addLog: diagnostics.addLog,
    touchInteraction,
  });

  bindRuntimeRuleEvents({
    eventBus,
    rules,
    controls,
    context: options.context ?? {},
    state,
    ruleCooldowns,
    runActions,
    setLastEventLabel: diagnostics.setLastEventLabel,
  });

  eventBus.on("command:hide", async () => {
    touchInteraction();
    state.isHidden = !state.isHidden;
    elements.stage.classList.toggle("is-hidden", state.isHidden);
    
    if (elements.restoreBadge) {
      elements.restoreBadge.hidden = !state.isHidden;
    }

    if (state.isHidden) {
      renderSpeech(await dialogue.line("onHide"));
      diagnostics.addLog("character:hide");
      return;
    }

    renderSpeech(await dialogue.line("onShow"));
    diagnostics.addLog("character:show");
  });

  bindRuntimeDomEvents({
    elements,
    eventBus,
    getCharacter: () => currentCharacter,
    controls,
    cleanupCallbacks,
    touchInteraction,
    runAction,
    shouldSkipDialogue: dialoguePlayer.getIsPlaying,
    skipDialogue: dialoguePlayer.skip,
  });

  const handleSurfaceChange = (event: Event) => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;

    if (detail?.id) {
      characterRenderer.applySurface(detail.id);
    }
  };

  elements.stage.addEventListener("ghostnest:surface-change", handleSurfaceChange);
  cleanupCallbacks.push(() => {
    elements.stage.removeEventListener("ghostnest:surface-change", handleSurfaceChange);
  });

  cleanupCallbacks.push(startRuntimeTimers({
    eventBus,
    state,
    timing,
    controls,
    renderStatusPanel: diagnostics.renderStatusPanel,
    touchInteraction,
  }));

  cleanupCallbacks.push(() => {
    dialoguePlayer.stop();
    sceneRenderer.destroy();
    characterRenderer.destroy();
    if (!hadRuntimeScopeClass) {
      elements.stage.classList.remove("ghostnest-runtime");
    }

    if (generatedRestoreBadge) {
      generatedRestoreBadge.remove();
    }

    actionTimers.forEach((timerId) => window.clearTimeout(timerId));
    actionTimers.clear();
  });

  if (controls.devtools && controls.hitboxEditor && options.devtools?.hitboxEditor) {
    const hitboxEditor = initHitboxEditor({
      elements,
      character: currentCharacter,
      selectors: options.devtools.hitboxEditor.selectors,
      storageAdapter,
    });
    cleanupCallbacks.push(hitboxEditor.destroy);
  }
  if (options.initialSurface) {
    const initialSurface = currentCharacter.assets?.surfaces?.[options.initialSurface];

    if (initialSurface?.expression) {
      state.expression = initialSurface.expression;
      elements.sprite.dataset.expression = initialSurface.expression;
    }

    characterRenderer.applySurface(options.initialSurface);
  } else {
    renderCharacterState();
  }
  diagnostics.renderStatusPanel();
  elements.stage.dataset.ready = "true";
  elements.stage.dispatchEvent(new CustomEvent("ghostnest:ready", {
    bubbles: true,
    detail: {
      characterId: currentCharacter.profile.id,
    },
  }));
  eventBus.emit("runtime:ready");

  let isDestroyed = false;

  /**
   * 현재 런타임 인스턴스를 유지한 채 캐릭터와 캐릭터 귀속 초기값을 교체합니다.
   */
  async function applyRuntimeCharacter(
    nextCharacter: CharacterDefinition,
    changeOptions: RuntimeCharacterChangeOptions = {},
  ) {
    currentCharacter = nextCharacter;
    currentDialogue = createCharacterDialogueEngine(nextCharacter, changeOptions.dialogueEngine);
    dialoguePlayer.stop();
    clearDialogueChoices();
    state.isHidden = false;
    state.mode = "idle";
    state.lastTouchedPart = null;
    state.expression = changeOptions.initialExpression
      ?? nextCharacter.profile.defaultExpression
      ?? "neutral";
    elements.stage.classList.remove("is-hidden");
    elements.stage.dataset.state = state.mode;

    if (elements.restoreBadge) {
      elements.restoreBadge.hidden = true;
    }

    const nextScene = createRuntimeSceneOptions(nextCharacter, changeOptions.scene ?? options.scene);
    sceneRenderer.setSceneOptions(nextScene, changeOptions.initialScene);
    characterRenderer.updateCharacter(nextCharacter, state, {
      initialExpression: state.expression,
      ...(changeOptions.initialSurface ? { initialSurface: changeOptions.initialSurface } : {}),
    });

    if (changeOptions.resetSpeech !== false) {
      renderSpeech(await dialogue.line("onMount"));
    }

    diagnostics.addLog(`character:set:${nextCharacter.profile.id}`);
    diagnostics.renderStatusPanel();
    elements.stage.dispatchEvent(new CustomEvent("ghostnest:character-change", {
      bubbles: true,
      detail: {
        characterId: nextCharacter.profile.id,
      },
    }));
  }
  
  const runtime: GhostRuntime = {
    emit(eventName, payload) {
      if (isDestroyed) {
        return;
      }

      eventBus.emit(eventName, payload);
    },
    async setCharacter(character, changeOptions) {
      if (isDestroyed) {
        return;
      }

      await applyRuntimeCharacter(character, changeOptions);
    },
    registerAction,
    destroy() {
      if (isDestroyed) {
        return;
      }

      isDestroyed = true;
      cleanupCallbacks.forEach((cleanup) => cleanup());
    },
  };

  const eventBridge = createExternalEventBridge(runtime);
  cleanupCallbacks.push(() => eventBridge.destroy());

  return runtime;
}
