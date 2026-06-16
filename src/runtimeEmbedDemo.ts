import { nanikaPreset } from "./ghost/preset.js";
import { bundledCharacters } from "./characters/index.js";
import { createCharacterWithAssetBaseUrl, type CharacterAssetBaseUrlOptions } from "./core/assetUrls.js";
import {
  createGhostRuntimeFromPreset,
  createNanikaRuntimeProfileOptionsById,
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

const runtimeRootSelector = "#nanikaRuntimeEmbed";
const embedSpeechPreset = runtimeSpeechPresets.hostEmbed;
const runtimeStatus = document.querySelector<HTMLElement>("#embedRuntimeStatus");
let runtimeBootCount = 0;
let embedCharacters: CharacterDefinition[] = [nanikaPreset.character, ...bundledCharacters];
let embedCharactersReady: Promise<CharacterDefinition[]> | null = null;
let hasLoadedEmbedCharacterCatalog = false;
let embedAssetBaseUrlOptionsReady: Promise<CharacterAssetBaseUrlOptions | null> | null = null;
let currentEmbedPageId = "home";
let currentEmbedCharacterId = nanikaPreset.character.profile.id;

type EmbedRuntimeProfile = NanikaRuntimeProfile & {
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
      hasLoadedEmbedCharacterCatalog = true;
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

const embedRuntimeControls = {
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

const embedRuntimeSizing = {
  speechLayout: {
    ...embedSpeechPreset.layout,
    overlayAnchor: "center",
  } satisfies SpeechLayoutOptions,
  speechBalloonSize: {
    ...embedSpeechPreset.size,
    stageWidth: "min(360px, calc(var(--runtime-area-width, 360px) - 32px))",
    dialogueWidth: "min(100%, calc(var(--runtime-area-width, 460px) - 40px))",
    dialogueMaxWidth: "430px",
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

const embedRuntimeProfiles: Record<string, EmbedRuntimeProfile> = {
  home: {
    id: "embed.home.rine",
    name: "Embed home / Rine",
    bootEvent: "demo:home:open",
    match: { pageId: "home", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: embedRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "preset",
    },
    balloonTheme: "prompt_overlay",
    featureSetIds: ["demo.home"],
    ...embedRuntimeSizing,
    characterProfiles: [
      {
        characterId: "rine",
        initial: { surface: "0" },
      },
    ],
  },
  subpage: {
    id: "embed.context.rine",
    name: "Embed context / Rine",
    bootEvent: "demo:subpage:open",
    match: { pageId: "subpage", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: embedRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "preset",
    },
    balloonTheme: "prompt_overlay",
    featureSetIds: ["demo.subpage"],
    speechLayout: embedRuntimeSizing.speechLayout,
    characterPlacement: embedRuntimeSizing.characterPlacement,
    speechBalloonSize: {
      ...embedRuntimeSizing.speechBalloonSize,
      dialogueMaxHeight: "min(20vh, 132px)",
    },
    spriteSize: embedRuntimeSizing.spriteSize,
    characterProfiles: [
      {
        characterId: "rine",
        initial: { surface: "8" },
      },
    ],
  },
};
const defaultEmbedRuntimePageId = "home";

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

function createEmbedRuntimeProfile(pageId: string, character: CharacterDefinition): EmbedRuntimeProfile {
  const template = embedRuntimeProfiles[pageId] ?? embedRuntimeProfiles[defaultEmbedRuntimePageId]!;
  const preferredSurfaceId = pageId === "subpage" ? "8" : "0";
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
  const loadCatalogItem: ManagementMenuItem = {
    id: "load-embed-characters",
    label: "저장 캐릭터 불러오기",
    description: "필요할 때만 캐릭터 목록을 불러와 초기 로딩을 가볍게 유지합니다.",
    actions: [
      { type: "load_embed_characters" },
    ],
  };

  if (!hasLoadedEmbedCharacterCatalog && candidates.length === 0) {
    return {
      id: "change-character",
      label: "캐릭터 변경",
      description: "저장된 캐릭터 목록은 선택할 때 불러옵니다.",
      children: [loadCatalogItem],
    };
  }

  return {
    id: "change-character",
    label: "캐릭터 변경",
    description: "이 임베드 데모에서 사용할 캐릭터를 선택합니다.",
    children: [
      ...(!hasLoadedEmbedCharacterCatalog ? [loadCatalogItem] : []),
      ...candidates.map((character) => ({
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
      ...(hasLoadedEmbedCharacterCatalog && candidates.length === 0
        ? [{
          id: "change-character-empty",
          label: "다른 캐릭터 없음",
          description: "현재 전환할 수 있는 다른 캐릭터가 없습니다.",
          actions: [
            { type: "speak_text", text: "지금은 전환할 수 있는 다른 캐릭터가 없어요." },
            { type: "log", label: "embed.character_change.empty" },
          ],
        }]
        : []),
    ],
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

const hostEmbedMappings = [
  {
    id: "demo-home-open",
    event: "demo:home:open",
    actions: [
      { type: "change_balloon", theme: "prompt_overlay" },
      { type: "speak_text", text: "이 박스 안에서만 나니카가 움직이는 임베드 데모예요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "demo-subpage-open",
    event: "demo:subpage:open",
    actions: [
      { type: "change_balloon", theme: "prompt_overlay" },
      { type: "speak_text", text: "페이지 context가 바뀌어도 런타임은 같은 임베드 영역 안에 유지돼요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "demo-subpage-selected",
    event: "choice:selected",
    actions: [
      { type: "speak_text", text: "선택 이벤트를 런타임 액션으로 매핑해 반응을 확인합니다." },
      { type: "surface", id: "8", startIdleLayers: true },
    ],
  },
  {
    id: "sample_result-menu-selected",
    event: "demo:menu:selected",
    actions: [
      { type: "speak_text", text: "호스트 버튼 이벤트가 나니카 대사로 연결됐어요." },
    ],
  },
] satisfies NanikaMapping[];

const hostEmbedFeatureSets = [
  {
    id: "demo.home",
    name: "Host home basics",
    mappingIds: ["demo-home-open", "sample_result-menu-selected", "demo-subpage-selected"],
  },
  {
    id: "demo.subpage",
    name: "Host subpage basics",
    mappingIds: ["demo-subpage-open", "sample_result-menu-selected", "demo-subpage-selected"],
  },
] satisfies NanikaFeatureSet[];

type RuntimeEmbedWindow = Window & {
  __nanikaRuntimeEmbed__?: GhostRuntime;
};

const embedWindow = window as RuntimeEmbedWindow;

async function createEmbedRuntime(pageId = currentEmbedPageId, characterId = currentEmbedCharacterId) {
  embedWindow.__nanikaRuntimeEmbed__?.destroy();
  runtimeBootCount += 1;
  currentEmbedPageId = pageId;
  const character = await createEmbedRuntimeCharacter(getEmbedCharacter(characterId));
  currentEmbedCharacterId = character.profile.id;
  const profile = createEmbedRuntimeProfile(pageId, character);
  const profileResult = createNanikaRuntimeProfileOptionsById({
    profileId: profile.id,
    profiles: [profile],
    context: {
      pageId,
      url: window.location.pathname,
    },
    featureSets: hostEmbedFeatureSets,
    mappings: hostEmbedMappings,
    characterId: character.profile.id,
  });
  const profileOverrides = profileResult.matched ? profileResult.overrides ?? {} : {};
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

  embedWindow.__nanikaRuntimeEmbed__ = createGhostRuntimeFromPreset(embedPreset, {
    root: runtimeRootSelector,
    selectors: {
      stage: ".embed-nanika-stage",
      sprite: ".embed-nanika-sprite",
      spriteImage: ".embed-nanika-sprite-image",
      speechBalloon: ".embed-nanika-speech",
      speakerName: ".embed-nanika-speaker",
      speechText: ".embed-nanika-text",
      balloonActionMenu: ".embed-nanika-actions",
      panelActionMenu: ".embed-nanika-panel",
      menuButtons: "[data-embed-command]",
      observeAreas: "[data-embed-observe]",
    },
    ...embedOverrides,
    stageMode: "fill",
  });
  embedWindow.__nanikaRuntimeEmbed__.registerAction("switch_embed_character", (action) => {
    const nextCharacterId = isSwitchEmbedCharacterAction(action) && typeof action.characterId === "string"
      ? action.characterId
      : currentEmbedCharacterId;

    void switchEmbedRuntimeCharacter(nextCharacterId);
  });
  embedWindow.__nanikaRuntimeEmbed__.registerAction("load_embed_characters", async () => {
    if (runtimeStatus) {
      runtimeStatus.textContent = "캐릭터 목록을 불러오는 중";
    }

    await loadAvailableEmbedCharacters();
    await createEmbedRuntime(currentEmbedPageId, currentEmbedCharacterId);
  });

  document.querySelector<HTMLElement>("#nanikaRuntimeEmbed .embed-nanika-stage")?.addEventListener(
    "ghostnest:character-change-request",
    async (event) => {
      const detail = (event as CustomEvent<{ characterId?: string }>).detail;
      await loadAvailableEmbedCharacters();
      const nextCharacterId = detail?.characterId && detail.characterId !== currentEmbedCharacterId
        ? detail.characterId
        : embedCharacters.find((candidate) => candidate.profile.id !== currentEmbedCharacterId)?.profile.id;

      if (nextCharacterId) {
        void switchEmbedRuntimeCharacter(nextCharacterId);
      }
    },
  );

  embedWindow.__nanikaRuntimeEmbed__.emit(profile.bootEvent);
  if (runtimeStatus) {
    runtimeStatus.textContent = `${character.profile.name} ready #${runtimeBootCount}`;
  }
}

async function switchEmbedRuntimeCharacter(characterId: string) {
  const runtime = embedWindow.__nanikaRuntimeEmbed__;

  if (!runtime) {
    await createEmbedRuntime(currentEmbedPageId, characterId);
    return;
  }

  const character = await createEmbedRuntimeCharacter(getEmbedCharacter(characterId));
  currentEmbedCharacterId = character.profile.id;
  const profile = createEmbedRuntimeProfile(currentEmbedPageId, character);
  const profileResult = createNanikaRuntimeProfileOptionsById({
    profileId: profile.id,
    profiles: [profile],
    context: {
      pageId: currentEmbedPageId,
      url: window.location.pathname,
    },
    featureSets: hostEmbedFeatureSets,
    mappings: hostEmbedMappings,
    characterId: character.profile.id,
  });
  const initialOptions = profileResult.matched ? profileResult.overrides ?? {} : {};

  await runtime.setCharacter(character, {
    ...(initialOptions.initialExpression ? { initialExpression: initialOptions.initialExpression } : {}),
    ...(initialOptions.initialSurface ? { initialSurface: initialOptions.initialSurface } : {}),
    ...(initialOptions.initialScene ? { initialScene: initialOptions.initialScene } : {}),
  });
  runtime.emit(profile.bootEvent);

  if (runtimeStatus) {
    runtimeStatus.textContent = `${character.profile.name} ready #${runtimeBootCount}`;
  }
}

function emitEmbedEvent(eventName: RuntimeEventName, payload?: Record<string, unknown>) {
  embedWindow.__nanikaRuntimeEmbed__?.emit(eventName, payload);
}

document.querySelectorAll<HTMLElement>("[data-embed-event]").forEach((element) => {
  element.addEventListener("click", () => {
    const pageId = element.dataset.embedPage;
    const eventName = element.dataset.embedEvent;

    if (pageId) {
      void createEmbedRuntime(pageId, currentEmbedCharacterId);
      return;
    }

    if (!eventName) {
      return;
    }

    emitEmbedEvent(eventName, {
      value: element.dataset.embedValue,
    });

    if (runtimeStatus) {
      runtimeStatus.textContent = eventName;
    }
  });
});

document.querySelector<HTMLButtonElement>("#embedRuntimeRestart")?.addEventListener("click", () => {
  void createEmbedRuntime();
});

void createEmbedRuntime();
