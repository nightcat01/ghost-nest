import { nanikaPreset } from "./ghost/preset.js";
import { bundledCharacters } from "./characters/index.js";
import { createCharacterWithAssetBaseUrl, type CharacterAssetBaseUrlOptions } from "./core/assetUrls.js";
import {
  createGhostRuntimeFromPreset,
  createNanikaRuntimeProfileOptions,
  type NanikaRuntimePresetOverrides,
  type NanikaFeatureSet,
  type NanikaMapping,
  type NanikaRuntimeProfile,
} from "./plugins/nanikaMapping/index.js";
import { createDemoManagementMenuItems } from "./demo/demoManagementMenu.js";
import { createDemoRules } from "./demo/demoRules.js";
import { runtimeSpeechPresets } from "./runtime/runtimeLayoutPresets.js";
import type {
  CharacterSpriteSizeOptions,
  CharacterDefinition,
  CharacterExpression,
  GhostRuntime,
  ManagementMenuItem,
  RuntimeAction,
  RuntimeEventName,
  SpeechBalloonSizeOptions,
  SpeechLayoutOptions,
} from "./core/types.js";

const runtimeRootSelector = "#fortuneNanikaRuntime";
const fortuneSpeechPreset = runtimeSpeechPresets.fortuneEmbed;
const runtimeStatus = document.querySelector<HTMLElement>("#fortuneRuntimeStatus");
let runtimeBootCount = 0;
let embedCharacters: CharacterDefinition[] = [nanikaPreset.character, ...bundledCharacters];
let embedCharactersReady: Promise<CharacterDefinition[]> | null = null;
let embedAssetBaseUrlOptionsReady: Promise<CharacterAssetBaseUrlOptions | null> | null = null;
let currentEmbedPageId = "home";
let currentEmbedCharacterId = nanikaPreset.character.profile.id;

type FortuneRuntimeProfile = NanikaRuntimeProfile & {
  bootEvent: RuntimeEventName;
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

function isSwitchEmbedCharacterAction(action: RuntimeAction): action is RuntimeAction & { characterId?: string } {
  return action.type === "switch_embed_character";
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

async function loadAvailableEmbedCharacters() {
  if (embedCharactersReady) {
    return embedCharactersReady;
  }

  embedCharactersReady = (async () => {
    try {
      const response = await fetch("/api/devtools/characters");

      if (!response.ok) {
        return embedCharacters;
      }

      const result = await response.json() as CharacterListResponse;
      const characterIds = result.characters ?? [];
      const loadedCharacters = await Promise.all(characterIds.map(loadCharacterDefinition));

      embedCharacters = uniqueCharactersById([
        ...loadedCharacters.filter(isCharacterDefinition),
        ...embedCharacters,
      ]);
    } catch {
      return embedCharacters;
    }

    return embedCharacters;
  })();

  return embedCharactersReady;
}

function normalizeAssetRoot(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
}

async function loadEmbedAssetBaseUrlOptions() {
  if (embedAssetBaseUrlOptionsReady) {
    return embedAssetBaseUrlOptionsReady;
  }

  embedAssetBaseUrlOptionsReady = (async () => {
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

  return embedAssetBaseUrlOptionsReady;
}

async function createEmbedRuntimeCharacter(character: CharacterDefinition) {
  const assetBaseUrlOptions = await loadEmbedAssetBaseUrlOptions();

  if (!assetBaseUrlOptions?.charactersRootUrl && !assetBaseUrlOptions?.commonAssetBaseUrl) {
    return character;
  }

  return createCharacterWithAssetBaseUrl(character, assetBaseUrlOptions);
}

const fortuneRuntimeControls = {
  devtools: false,
  diagnostics: false,
  hitboxEditor: false,
  debugHitAreas: false,
  managementMenu: true,
  commandButtons: false,
  commandHoverDescription: false,
  areaHoverDescription: false,
  randomPrompt: false,
  persistence: false,
};

const fortuneRuntimeSizing = {
  speechLayout: fortuneSpeechPreset.layout satisfies SpeechLayoutOptions,
  speechBalloonSize: {
    ...fortuneSpeechPreset.size,
    stageWidth: "min(100%, calc(var(--runtime-area-width, 640px) - 32px))",
    dialogueWidth: "min(100%, calc(var(--runtime-area-width, 640px) - 48px))",
    dialogueMaxWidth: "100%",
  } satisfies Partial<SpeechBalloonSizeOptions>,
  characterPlacement: {
    placement: "bottom-center" as const,
  },
  spriteSize: {
    desktopWidth: "min(360px, calc(var(--runtime-area-width, 640px) - 180px))",
    desktopHeight: "min(520px, calc(var(--runtime-area-height, 520px) - 96px))",
    mobileWidth: "min(300px, calc(var(--runtime-area-width, 360px) - 72px))",
    mobileHeight: "min(420px, calc(var(--runtime-area-height, 460px) - 112px))",
  } satisfies Partial<CharacterSpriteSizeOptions>,
};

const fortuneRuntimeProfiles: Record<string, FortuneRuntimeProfile> = {
  home: {
    id: "embed.home.rine",
    name: "Embed home / Rine",
    bootEvent: "fortune:home:open",
    match: { pageId: "home", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: fortuneRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "preset",
    },
    balloonTheme: "fortune_prompt",
    featureSetIds: ["fortune.home"],
    ...fortuneRuntimeSizing,
    characterProfiles: [
      {
        characterId: "rine",
        initial: { surface: "0" },
      },
    ],
  },
  zodiac: {
    id: "embed.context.rine",
    name: "Embed context / Rine",
    bootEvent: "fortune:zodiac:open",
    match: { pageId: "zodiac", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: fortuneRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "preset",
    },
    balloonTheme: "fortune_prompt",
    featureSetIds: ["fortune.zodiac"],
    speechLayout: fortuneRuntimeSizing.speechLayout,
    characterPlacement: fortuneRuntimeSizing.characterPlacement,
    speechBalloonSize: {
      ...fortuneRuntimeSizing.speechBalloonSize,
      dialogueMaxHeight: "min(20vh, 132px)",
    },
    spriteSize: fortuneRuntimeSizing.spriteSize,
    characterProfiles: [
      {
        characterId: "rine",
        initial: { surface: "8" },
      },
    ],
  },
};
const defaultFortuneRuntimePageId = "home";

function getEmbedCharacter(characterId: string) {
  return embedCharacters.find((character) => character.profile.id === characterId) ?? nanikaPreset.character;
}

function resolveInitialSurface(character: CharacterDefinition, preferredSurfaceId: string | undefined) {
  const surfaceIds = Object.keys(character.assets?.surfaces ?? {});

  if (preferredSurfaceId && surfaceIds.includes(preferredSurfaceId)) {
    return preferredSurfaceId;
  }

  return surfaceIds[0];
}

function createEmbedRuntimeProfile(pageId: string, character: CharacterDefinition): FortuneRuntimeProfile {
  const template = fortuneRuntimeProfiles[pageId] ?? fortuneRuntimeProfiles[defaultFortuneRuntimePageId]!;
  const preferredSurfaceId = pageId === "zodiac" ? "8" : "0";
  const surface = resolveInitialSurface(character, preferredSurfaceId);
  const expression: CharacterExpression | undefined = surface ? undefined : "neutral";

  return {
    ...template,
    id: `${template.id}.${character.profile.id}`,
    name: `${template.name ?? "Embed profile"} / ${character.profile.name}`,
    characterProfiles: [
      {
        characterId: character.profile.id,
        initial: {
          ...(surface ? { surface } : {}),
          ...(expression ? { expression } : {}),
        },
      },
    ],
  };
}

function createEmbedCharacterSwitchMenuItem(currentCharacter: CharacterDefinition): ManagementMenuItem {
  const candidates = embedCharacters.filter((character) => character.profile.id !== currentCharacter.profile.id);

  if (candidates.length === 0) {
    return {
      id: "change-character",
      label: "캐릭터 변경",
      description: "현재 전환할 수 있는 다른 캐릭터가 없습니다.",
      actions: [
        { type: "speak_text", text: "지금은 전환할 수 있는 다른 캐릭터가 없어요." },
        { type: "log", label: "embed.character_change.empty" },
      ],
    };
  }

  return {
    id: "change-character",
    label: "캐릭터 변경",
    description: "이 임베드 데모에서 사용할 캐릭터를 선택합니다.",
    children: candidates.map((character) => ({
      id: `change-character-${character.profile.id}`,
      label: character.profile.name,
      description: `${character.profile.name} 캐릭터로 런타임을 다시 시작합니다.`,
      actions: [
        {
          type: "switch_embed_character",
          characterId: character.profile.id,
        },
      ],
    })),
  };
}

function withEmbedCharacterSwitcher(items: ManagementMenuItem[], currentCharacter: CharacterDefinition): ManagementMenuItem[] {
  return items.map((item) => {
    if (item.id === "change-character") {
      return createEmbedCharacterSwitchMenuItem(currentCharacter);
    }

    return {
      ...item,
      ...(item.children ? { children: withEmbedCharacterSwitcher(item.children, currentCharacter) } : {}),
    };
  });
}

const fortuneEmbedMappings = [
  {
    id: "fortune-home-open",
    event: "fortune:home:open",
    actions: [
      { type: "change_balloon", theme: "fortune_prompt" },
      { type: "speak_text", text: "이 박스 안에서만 나니카가 움직이는 임베드 데모예요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "fortune-zodiac-open",
    event: "fortune:zodiac:open",
    actions: [
      { type: "change_balloon", theme: "fortune_prompt" },
      { type: "speak_text", text: "페이지 context가 바뀌어도 런타임은 같은 임베드 영역 안에 유지돼요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "fortune-zodiac-selected",
    event: "zodiac:selected",
    actions: [
      { type: "speak_text", text: "선택 이벤트를 런타임 액션으로 매핑해 반응을 확인합니다." },
      { type: "surface", id: "8", startIdleLayers: true },
    ],
  },
  {
    id: "fortune-menu-selected",
    event: "fortune:menu:selected",
    actions: [
      { type: "speak_text", text: "호스트 버튼 이벤트가 나니카 대사로 연결됐어요." },
    ],
  },
] satisfies NanikaMapping[];

const fortuneEmbedFeatureSets = [
  {
    id: "fortune.home",
    name: "Fortune home basics",
    mappingIds: ["fortune-home-open", "fortune-menu-selected", "fortune-zodiac-selected"],
  },
  {
    id: "fortune.zodiac",
    name: "Fortune zodiac basics",
    mappingIds: ["fortune-zodiac-open", "fortune-menu-selected", "fortune-zodiac-selected"],
  },
] satisfies NanikaFeatureSet[];

type FortuneEmbedWindow = Window & {
  __fortuneNanikaRuntime__?: GhostRuntime;
};

const fortuneWindow = window as FortuneEmbedWindow;

async function createFortuneRuntime(pageId = currentEmbedPageId, characterId = currentEmbedCharacterId) {
  fortuneWindow.__fortuneNanikaRuntime__?.destroy();
  await loadAvailableEmbedCharacters();
  runtimeBootCount += 1;
  currentEmbedPageId = pageId;
  const character = await createEmbedRuntimeCharacter(getEmbedCharacter(characterId));
  currentEmbedCharacterId = character.profile.id;
  const profile = createEmbedRuntimeProfile(pageId, character);
  const profileResult = createNanikaRuntimeProfileOptions({
    profile,
    context: {
      pageId,
      url: window.location.pathname,
    },
    featureSets: fortuneEmbedFeatureSets,
    mappings: fortuneEmbedMappings,
    characterId: character.profile.id,
  });
  const profileOverrides = profileResult.overrides ?? {};
  const embedMenuItems = withEmbedCharacterSwitcher(createDemoManagementMenuItems(character, {
    includeDeveloperTools: false,
  }), character);
  const embedOverrides: NanikaRuntimePresetOverrides = {
    ...profileOverrides,
    replaceRules: [
      ...(profileOverrides.replaceRules ?? []),
      ...createDemoRules(embedMenuItems),
    ],
  };
  const embedPreset = {
    ...nanikaPreset,
    character,
  };

  fortuneWindow.__fortuneNanikaRuntime__ = createGhostRuntimeFromPreset(embedPreset, {
    root: runtimeRootSelector,
    selectors: {
      stage: ".fortune-nanika-stage",
      sprite: ".fortune-nanika-sprite",
      spriteImage: ".fortune-nanika-sprite-image",
      speechBalloon: ".fortune-nanika-speech",
      speakerName: ".fortune-nanika-speaker",
      speechText: ".fortune-nanika-text",
      balloonActionMenu: ".fortune-nanika-actions",
      panelActionMenu: ".fortune-nanika-panel",
      menuButtons: "[data-fortune-command]",
      observeAreas: "[data-fortune-observe]",
    },
    ...embedOverrides,
  });
  fortuneWindow.__fortuneNanikaRuntime__.registerAction("switch_embed_character", (action) => {
    const nextCharacterId = isSwitchEmbedCharacterAction(action) && typeof action.characterId === "string"
      ? action.characterId
      : currentEmbedCharacterId;

    void createFortuneRuntime(currentEmbedPageId, nextCharacterId);
  });

  document.querySelector<HTMLElement>("#fortuneNanikaRuntime .fortune-nanika-stage")?.addEventListener(
    "ghostnest:character-change-request",
    (event) => {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      const nextCharacterId = detail?.characterId && detail.characterId !== currentEmbedCharacterId
        ? detail.characterId
        : embedCharacters.find((candidate) => candidate.profile.id !== currentEmbedCharacterId)?.profile.id;

      if (nextCharacterId) {
        void createFortuneRuntime(currentEmbedPageId, nextCharacterId);
      }
    },
  );

  fortuneWindow.__fortuneNanikaRuntime__.emit(profile.bootEvent);
  if (runtimeStatus) {
    runtimeStatus.textContent = `${character.profile.name} ready #${runtimeBootCount}`;
  }
}

function emitFortuneEvent(eventName: RuntimeEventName, payload?: Record<string, unknown>) {
  fortuneWindow.__fortuneNanikaRuntime__?.emit(eventName, payload);
}

document.querySelectorAll<HTMLElement>("[data-fortune-event]").forEach((element) => {
  element.addEventListener("click", () => {
    const pageId = element.dataset.fortunePage;
    const eventName = element.dataset.fortuneEvent;

    if (pageId) {
      void createFortuneRuntime(pageId, currentEmbedCharacterId);
      return;
    }

    if (!eventName) {
      return;
    }

    emitFortuneEvent(eventName, {
      value: element.dataset.fortuneValue,
    });

    if (runtimeStatus) {
      runtimeStatus.textContent = eventName;
    }
  });
});

document.querySelector<HTMLButtonElement>("#fortuneRuntimeRestart")?.addEventListener("click", () => {
  void createFortuneRuntime();
});

void createFortuneRuntime();
