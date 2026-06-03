import { nanikaPreset } from "./ghost/preset.js";
import {
  createGhostRuntimeFromPreset,
  createNanikaRuntimeProfileOptions,
  type NanikaFeatureSet,
  type NanikaMapping,
  type NanikaRuntimeProfile,
} from "./plugins/nanikaMapping/index.js";
import { runtimeSpeechPresets } from "./runtime/runtimeLayoutPresets.js";
import type {
  CharacterSpriteSizeOptions,
  GhostRuntime,
  RuntimeEventName,
  SpeechBalloonSizeOptions,
  SpeechLayoutOptions,
} from "./core/types.js";

const runtimeRootSelector = "#fortuneNanikaRuntime";
const fortuneSpeechPreset = runtimeSpeechPresets.fortuneEmbed;
const runtimeStatus = document.querySelector<HTMLElement>("#fortuneRuntimeStatus");
let runtimeBootCount = 0;

type FortuneRuntimeProfile = NanikaRuntimeProfile & {
  bootEvent: RuntimeEventName;
};

const fortuneRuntimeControls = {
  devtools: false,
  diagnostics: false,
  hitboxEditor: false,
  debugHitAreas: false,
  managementMenu: false,
  commandButtons: false,
  commandHoverDescription: false,
  areaHoverDescription: false,
  randomPrompt: false,
  persistence: false,
};

const fortuneRuntimeSizing = {
  speechLayout: fortuneSpeechPreset.layout satisfies SpeechLayoutOptions,
  speechBalloonSize: fortuneSpeechPreset.size satisfies Partial<SpeechBalloonSizeOptions>,
  spriteSize: {
    desktopWidth: "250px",
    desktopHeight: "340px",
    mobileWidth: "210px",
    mobileHeight: "286px",
  } satisfies Partial<CharacterSpriteSizeOptions>,
};

const fortuneRuntimeProfiles: Record<string, FortuneRuntimeProfile> = {
  home: {
    id: "fortune.home.rine",
    name: "Fortune home / Rine",
    bootEvent: "fortune:home:open",
    match: { pageId: "home", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: fortuneRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "disabled",
    },
    balloonTheme: "fortune_prompt",
    includeDefaultRules: false,
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
    id: "fortune.zodiac.rine",
    name: "Fortune zodiac / Rine",
    bootEvent: "fortune:zodiac:open",
    match: { pageId: "zodiac", urlPattern: "*" },
    initial: { scene: "desk-room" },
    controls: fortuneRuntimeControls,
    preferenceStorage: {
      runtimeUi: "preset",
      managementMenu: "disabled",
    },
    balloonTheme: "fortune_prompt",
    includeDefaultRules: false,
    featureSetIds: ["fortune.zodiac"],
    speechLayout: fortuneRuntimeSizing.speechLayout,
    speechBalloonSize: {
      ...fortuneSpeechPreset.size,
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

const fortuneEmbedMappings = [
  {
    id: "fortune-home-open",
    event: "fortune:home:open",
    actions: [
      { type: "change_balloon", theme: "fortune_prompt" },
      { type: "speak_text", text: "스텔라: 오늘은 어떤 운세를 보고 싶으세요? 메뉴를 고르면 제가 길을 열어드릴게요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "fortune-zodiac-open",
    event: "fortune:zodiac:open",
    actions: [
      { type: "change_balloon", theme: "fortune_prompt" },
      { type: "speak_text", text: "보고 싶은 별자리를 선택하거나 생일을 입력해 주세요." },
      { type: "scene", id: "desk-room" },
    ],
  },
  {
    id: "fortune-zodiac-selected",
    event: "zodiac:selected",
    actions: [
      { type: "speak_text", text: "좋아요. 선택한 별자리에 맞춰 오늘의 흐름을 읽어볼게요." },
      { type: "surface", id: "8", startIdleLayers: true },
    ],
  },
  {
    id: "fortune-menu-selected",
    event: "fortune:menu:selected",
    actions: [
      { type: "speak_text", text: "해당 메뉴로 이어갈 수 있어요. 실제 서비스에서는 여기서 페이지 기능과 연결하면 됩니다." },
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

function createFortuneRuntime(pageId = defaultFortuneRuntimePageId) {
  fortuneWindow.__fortuneNanikaRuntime__?.destroy();
  runtimeBootCount += 1;
  const profile = fortuneRuntimeProfiles[pageId] ?? fortuneRuntimeProfiles[defaultFortuneRuntimePageId]!;
  const profileResult = createNanikaRuntimeProfileOptions({
    profile,
    context: {
      pageId,
      url: window.location.pathname,
    },
    featureSets: fortuneEmbedFeatureSets,
    mappings: fortuneEmbedMappings,
    characterId: nanikaPreset.character.profile.id,
  });

  fortuneWindow.__fortuneNanikaRuntime__ = createGhostRuntimeFromPreset(nanikaPreset, {
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
    ...(profileResult.overrides ?? {}),
  });

  fortuneWindow.__fortuneNanikaRuntime__.emit(profile.bootEvent);
  if (runtimeStatus) {
    runtimeStatus.textContent = `ready #${runtimeBootCount}`;
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
      createFortuneRuntime(pageId);
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
  createFortuneRuntime();
});

createFortuneRuntime();
