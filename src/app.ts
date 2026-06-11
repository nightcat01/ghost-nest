import type { CharacterDefinition, GhostRuntime, ManagementMenuItem, RuntimeEventName, RuntimeRule } from "./core/types.js";
import type { RuntimeAction } from "./core/types.js";
import type { CharacterAssetBaseUrlOptions } from "./core/assetUrls.js";
import { nanikaPreset } from "./ghost/preset.js";
import { createDemoManagementMenuItems, hydrateDemoManagementMenuRules } from "./demo/demoManagementMenu.js";
import { createDemoRules } from "./demo/demoRules.js";
import { bundledCharacters } from "./characters/index.js";
import { createCharacterWithAssetBaseUrl } from "./core/assetUrls.js";
import {
  createGhostRuntimeFromPreset,
  createRuntimeRulesFromMappings,
  type NanikaRuntimePreset,
  type NanikaMapping,
} from "./plugins/nanikaMapping/index.js";
import { runtimeSpeechPresets } from "./runtime/runtimeLayoutPresets.js";

type GhostNestWindow = Window & {
  __ghostNestRuntime__?: GhostRuntime;
};

const ghostNestWindow = window as GhostNestWindow;

let demoCharacters: CharacterDefinition[] = [...bundledCharacters];
let demoCharactersReady: Promise<CharacterDefinition[]> | null = null;
let demoAssetBaseUrlOptionsReady: Promise<CharacterAssetBaseUrlOptions | null> | null = null;
let currentDemoCharacterId = nanikaPreset.character.profile.id;

type NanikaMappingsResponse = {
  ok?: boolean;
  mappings?: NanikaMapping[];
};

type CharacterListResponse = {
  ok?: boolean;
  characters?: string[];
};

type CharacterWorkspaceResponse = {
  ok?: boolean;
  workspace?: {
    browserSourcePrefix?: string;
    browserCommonPrefix?: string;
  };
};

function isSwitchDemoCharacterAction(action: RuntimeAction): action is RuntimeAction & { characterId?: string } {
  return action.type === "switch_demo_character";
}

function isCharacterDefinition(value: unknown): value is CharacterDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CharacterDefinition>;

  return Boolean(
    candidate.profile
    && typeof candidate.profile.id === "string"
    && typeof candidate.profile.name === "string"
    && candidate.lines
    && typeof candidate.lines === "object",
  );
}

async function loadCharacterDefinition(characterId: string): Promise<CharacterDefinition | null> {
  try {
    const module = await import(`./characters/${characterId}/index.js`) as Record<string, unknown>;
    const namedExport = module[characterId];
    const defaultExport = module.default;

    if (isCharacterDefinition(defaultExport)) {
      return defaultExport;
    }

    if (isCharacterDefinition(namedExport)) {
      return namedExport;
    }
  } catch {
    return null;
  }

  return null;
}

function uniqueCharactersById(characters: CharacterDefinition[]) {
  const seen = new Set<string>();

  return characters.filter((character) => {
    const { id } = character.profile;

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

async function loadAvailableDemoCharacters() {
  if (demoCharactersReady) {
    return demoCharactersReady;
  }

  demoCharactersReady = (async () => {
    try {
      const response = await fetch("/api/devtools/characters");

      if (!response.ok) {
        return demoCharacters;
      }

      const result = await response.json() as CharacterListResponse;
      const characterIds = result.characters ?? [];
      const loadedCharacters = await Promise.all(characterIds.map(loadCharacterDefinition));

      demoCharacters = uniqueCharactersById([
        ...loadedCharacters.filter(isCharacterDefinition),
        ...demoCharacters,
      ]);
    } catch {
      return demoCharacters;
    }

    return demoCharacters;
  })();

  return demoCharactersReady;
}

function normalizeAssetRoot(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
}

async function loadDemoAssetBaseUrlOptions() {
  if (demoAssetBaseUrlOptionsReady) {
    return demoAssetBaseUrlOptionsReady;
  }

  demoAssetBaseUrlOptionsReady = (async () => {
    try {
      const response = await fetch("/api/devtools/character-workspace");

      if (!response.ok) {
        return null;
      }

      const result = await response.json() as CharacterWorkspaceResponse;

      if (!result.ok || !result.workspace) {
        return null;
      }

      const charactersRootUrl = normalizeAssetRoot(result.workspace.browserSourcePrefix);
      const commonAssetBaseUrl = normalizeAssetRoot(result.workspace.browserCommonPrefix);

      return {
        ...(charactersRootUrl ? { charactersRootUrl } : {}),
        ...(commonAssetBaseUrl ? { commonAssetBaseUrl } : {}),
      };
    } catch {
      return null;
    }
  })();

  return demoAssetBaseUrlOptionsReady;
}

async function createRuntimeCharacter(character: CharacterDefinition) {
  const assetBaseUrlOptions = await loadDemoAssetBaseUrlOptions();

  if (!assetBaseUrlOptions?.charactersRootUrl && !assetBaseUrlOptions?.commonAssetBaseUrl) {
    return character;
  }

  return createCharacterWithAssetBaseUrl(character, assetBaseUrlOptions);
}

/**
 * Keeps the demo menu reachable when saved mappings are incomplete or store only a menu shell.
 */
function normalizeSavedRuntimeRules(rules: RuntimeRule[], menuItems: ManagementMenuItem[]): RuntimeRule[] {
  const hydratedRules = hydrateDemoManagementMenuRules(rules, menuItems);
  const hasRightClickMenu = hydratedRules.some((rule) => (
    rule.event === "character:right_click"
    && rule.actions.some((action) => action.type === "open_management_menu")
  ));

  if (hasRightClickMenu) {
    return hydratedRules;
  }

  const defaultMenuRule = createDemoRules(menuItems).find((rule) => rule.event === "character:right_click");

  return defaultMenuRule ? [...hydratedRules, defaultMenuRule] : hydratedRules;
}

/**
 * Finds a demo character by id, falling back to the preset character.
 */
function getDemoCharacter(characterId: string) {
  return demoCharacters.find((character) => character.profile.id === characterId) ?? nanikaPreset.character;
}

/**
 * Creates the second-step character switch menu for the runtime demo page.
 */
function createCharacterSwitchMenuItem(currentCharacter: CharacterDefinition): ManagementMenuItem {
  const candidates = demoCharacters.filter((character) => character.profile.id !== currentCharacter.profile.id);

  if (candidates.length === 0) {
    return {
      id: "change-character",
      label: "캐릭터 변경",
      description: "현재 전환할 수 있는 다른 데모 캐릭터가 없어요.",
      actions: [
        { type: "speak_text", text: "지금은 전환할 수 있는 다른 캐릭터가 없어요." },
        { type: "log", label: "management.character_change.empty" },
      ],
    };
  }

  return {
    id: "change-character",
    label: "캐릭터 변경",
    description: "현재 캐릭터를 제외한 데모 캐릭터 목록을 보여줍니다.",
    children: candidates.map((character) => ({
      id: `change-character-${character.profile.id}`,
      label: character.profile.name,
      description: `${character.profile.id} 캐릭터로 런타임을 다시 시작합니다.`,
      actions: [
        {
          type: "switch_demo_character",
          characterId: character.profile.id,
        },
      ],
    })),
  };
}

/**
 * Replaces the generic character-change request item with the demo page switcher.
 */
function withDemoCharacterSwitcher(items: ManagementMenuItem[], currentCharacter: CharacterDefinition): ManagementMenuItem[] {
  return items.map((item) => {
    if (item.id === "change-character") {
      return createCharacterSwitchMenuItem(currentCharacter);
    }

    return {
      ...item,
      ...(item.children ? { children: withDemoCharacterSwitcher(item.children, currentCharacter) } : {}),
    };
  });
}

/**
 * Creates a runtime preset for the selected demo character.
 */
function createDemoRuntimePreset(character: CharacterDefinition, menuItems: ManagementMenuItem[]): NanikaRuntimePreset {
  return {
    ...nanikaPreset,
    character,
    rules: createDemoRules(menuItems),
  };
}

/**
 * Adds page-local rules that let the smoke-test deck exercise runtime UI actions.
 */
function createRuntimeTestRules(): RuntimeRule[] {
  return [
    {
      id: "test.layout.dialogue_overlay",
      event: "test:layout:dialogue_overlay",
      actions: [
        {
          type: "change_speech_layout",
          ...runtimeSpeechPresets.dialogueOverlay.layout,
        },
        {
          type: "set_speech_balloon_size",
          size: runtimeSpeechPresets.dialogueOverlay.size,
        },
        { type: "change_balloon", theme: "prompt_overlay" },
        { type: "speak_text", text: "하단 대사창 모드예요. 긴 문장이 들어와도 정해진 영역 안에서만 움직여요." },
        { type: "log", label: "test:layout.dialogue_overlay" },
      ],
    },
    {
      id: "test.layout.dialogue_below",
      event: "test:layout:dialogue_below",
      actions: [
        {
          type: "change_speech_layout",
          ...runtimeSpeechPresets.dialogueBelow.layout,
        },
        {
          type: "set_speech_balloon_size",
          size: runtimeSpeechPresets.dialogueBelow.size,
        },
        { type: "change_balloon", theme: "prompt_overlay" },
        { type: "speak_text", text: "하단 대사창 모드예요. 캐릭터 아래쪽에 대사창을 분리해서 보여줄게요." },
        { type: "log", label: "test:layout.dialogue_below" },
      ],
    },
    {
      id: "test.layout.floating_compact",
      event: "test:layout:floating_compact",
      actions: [
        {
          type: "change_speech_layout",
          ...runtimeSpeechPresets.floatingCompact.layout,
        },
        {
          type: "set_speech_balloon_size",
          size: runtimeSpeechPresets.floatingCompact.size,
        },
        { type: "change_balloon", theme: "default" },
        { type: "speak_text", text: "말풍선 모드로 돌아왔어요. 캐릭터 옆에서 작게 표시됩니다." },
        { type: "log", label: "test:layout.floating_compact" },
      ],
    },
    {
      id: "test.layout.reset_ui",
      event: "test:layout:reset_ui",
      actions: [
        { type: "reset_runtime_ui" },
        { type: "speak_text", text: "런타임 UI 설정을 기본값으로 되돌렸어요." },
        { type: "log", label: "test:layout.reset_ui" },
      ],
    },
    {
      id: "test.scene.rine_demo",
      event: "test:scene:rine_demo",
      actions: [
        { type: "scene", id: "rine-demo-scene" },
        { type: "speak_text", text: "Rine demo scene을 적용했어요. 배경, 캐릭터 깊이, 소품 레이어가 함께 움직입니다." },
        { type: "log", label: "test:scene.rine_demo" },
      ],
    },
    {
      id: "test.scene.overlay",
      event: "test:scene:overlay",
      actions: [
        { type: "scene_overlay", id: "rine-demo-scene", slot: "demo-overlay", duration: 1500 },
        { type: "speak_text", text: "무대 오버레이를 잠깐 겹쳤어요. 기본 무대와 별도로 켜고 끌 수 있습니다." },
        { type: "log", label: "test:scene.overlay" },
      ],
    },
  ];
}

/**
 * Loads developer-saved mappings so the runtime page follows the mapping editor.
 */
async function loadSavedRuntimeRules(menuItems: ManagementMenuItem[]) {
  try {
    const response = await fetch("/api/devtools/nanika-mappings");

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as NanikaMappingsResponse;

    if (!result.ok) {
      return null;
    }

    return normalizeSavedRuntimeRules(createRuntimeRulesFromMappings(result.mappings ?? []), menuItems);
  } catch {
    return null;
  }
}

/**
 * Creates a fresh runtime instance after cleaning up the previous one.
 */
async function bootRuntime(characterId = currentDemoCharacterId) {
  ghostNestWindow.__ghostNestRuntime__?.destroy();
  await loadAvailableDemoCharacters();
  currentDemoCharacterId = characterId;
  const character = await createRuntimeCharacter(getDemoCharacter(characterId));
  const menuItems = withDemoCharacterSwitcher(createDemoManagementMenuItems(character, {
    includeDeveloperTools: true,
  }), character);
  const preset = createDemoRuntimePreset(character, menuItems);
  const testRules = createRuntimeTestRules();
  const savedRules = await loadSavedRuntimeRules(menuItems);
  const runtime = createGhostRuntimeFromPreset(preset, {
    characterPlacement: {
      placement: "bottom-right",
    },
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "preset",
    },
    ...(savedRules
      ? {
        replaceRules: [...savedRules, ...testRules],
        includeDefaultRules: false,
      }
      : { rules: testRules }),
  });
  runtime.registerAction("switch_demo_character", (action) => {
    const characterId = isSwitchDemoCharacterAction(action) && typeof action.characterId === "string"
      ? action.characterId
      : currentDemoCharacterId;

    void bootRuntime(characterId);
  });
  ghostNestWindow.__ghostNestRuntime__ = runtime;

  return ghostNestWindow.__ghostNestRuntime__;
}

/**
 * Emits a runtime event from the test panel.
 */
function emitRuntimeEvent(eventName: RuntimeEventName) {
  const runtime = ghostNestWindow.__ghostNestRuntime__;

  if (!runtime) {
    return;
  }

  if (eventName === "character:double_click" || eventName === "character:touch") {
    runtime.emit(eventName, { part: "face" });
    return;
  }

  if (eventName === "command:hover") {
    runtime.emit(eventName, { command: "sample_result" });
    return;
  }

  runtime.emit(eventName);
}

/**
 * Applies a saved surface id through the same stage event used by dialogue scripts.
 */
function applyRuntimeSurface(surfaceId: string) {
  document.querySelector<HTMLElement>("#characterStage")?.dispatchEvent(
    new CustomEvent("ghostnest:surface-change", { detail: { id: surfaceId } }),
  );
}

/**
 * Runs test-only page controls that are not direct user events.
 */
function runRuntimeTestAction(action: string) {
  if (action === "dialogue-overlay") {
    emitRuntimeEvent("test:layout:dialogue_overlay");
    return;
  }

  if (action === "dialogue-below") {
    emitRuntimeEvent("test:layout:dialogue_below");
    return;
  }

  if (action === "floating-compact") {
    emitRuntimeEvent("test:layout:floating_compact");
    return;
  }

  if (action === "panel-menu") {
    emitRuntimeEvent("character:right_click");
    return;
  }

  if (action === "reset-ui") {
    emitRuntimeEvent("test:layout:reset_ui");
    return;
  }

  if (action === "rine-demo-scene") {
    emitRuntimeEvent("test:scene:rine_demo");
    return;
  }

  if (action === "scene-overlay") {
    emitRuntimeEvent("test:scene:overlay");
  }
}

/**
 * Wires developer-only runtime smoke-test controls on the demo page.
 */
function bindRuntimeTestPanel() {
  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-event]").forEach((button) => {
    button.addEventListener("click", () => {
      emitRuntimeEvent(button.dataset.runtimeTestEvent as RuntimeEventName);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-surface]").forEach((button) => {
    button.addEventListener("click", () => {
      const surfaceId = button.dataset.runtimeTestSurface;

      if (surfaceId) {
        applyRuntimeSurface(surfaceId);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.runtimeTestAction;

      if (action) {
        runRuntimeTestAction(action);
      }
    });
  });

  document.querySelector<HTMLButtonElement>("#runtimeRebootButton")?.addEventListener("click", () => {
    void bootRuntime();
  });
}

void bootRuntime();
bindRuntimeTestPanel();
