import { nanikaPreset } from "./ghost/preset.js";
import { createGhostRuntimeFromPreset } from "./plugins/nanikaMapping/index.js";
import { runtimeSpeechPresets } from "./runtime/runtimeLayoutPresets.js";
import type {
  CharacterSpriteSizeOptions,
  GhostRuntime,
  RuntimeEventName,
  RuntimeRule,
  SpeechBalloonSizeOptions,
  SpeechLayoutOptions,
} from "./core/types.js";

const runtimeRootSelector = "#fortuneNanikaRuntime";
const fortuneSpeechPreset = runtimeSpeechPresets.dialogueOverlay;
const runtimeStatus = document.querySelector<HTMLElement>("#fortuneRuntimeStatus");
let runtimeBootCount = 0;

type FortuneRuntimePageState = {
  event: RuntimeEventName;
  initialScene: string;
  initialSurface?: string;
  speechLayout: SpeechLayoutOptions;
  speechBalloonSize: Partial<SpeechBalloonSizeOptions>;
  spriteSize: Partial<CharacterSpriteSizeOptions>;
};

const fortuneRuntimePageStates: Record<string, FortuneRuntimePageState> = {
  home: {
    event: "fortune:home:open",
    initialScene: "desk-room",
    speechLayout: fortuneSpeechPreset.layout,
    speechBalloonSize: fortuneSpeechPreset.size,
    spriteSize: {
      desktopWidth: "250px",
      desktopHeight: "340px",
      mobileWidth: "210px",
      mobileHeight: "286px",
    },
  },
  zodiac: {
    event: "fortune:zodiac:open",
    initialScene: "desk-room",
    initialSurface: "8",
    speechLayout: fortuneSpeechPreset.layout,
    speechBalloonSize: {
      ...fortuneSpeechPreset.size,
      dialogueMaxHeight: "min(20vh, 132px)",
    },
    spriteSize: {
      desktopWidth: "250px",
      desktopHeight: "340px",
      mobileWidth: "210px",
      mobileHeight: "286px",
    },
  },
} satisfies Record<string, FortuneRuntimePageState>;
const defaultFortuneRuntimePageState = fortuneRuntimePageStates.home!;

const fortuneEmbedRules = [
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
] satisfies RuntimeRule[];

type FortuneEmbedWindow = Window & {
  __fortuneNanikaRuntime__?: GhostRuntime;
};

const fortuneWindow = window as FortuneEmbedWindow;

function createFortuneRuntime(pageState: FortuneRuntimePageState = defaultFortuneRuntimePageState) {
  fortuneWindow.__fortuneNanikaRuntime__?.destroy();
  runtimeBootCount += 1;
  const initialSurfaceOption = pageState.initialSurface
    ? { initialSurface: pageState.initialSurface }
    : {};

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
    controls: {
      devtools: false,
      diagnostics: false,
      hitboxEditor: false,
      debugHitAreas: false,
      managementMenu: false,
      commandButtons: false,
      commandHoverDescription: false,
      areaHoverDescription: false,
      persistence: false,
    },
    balloonTheme: "fortune_prompt",
    speechLayout: pageState.speechLayout,
    initialScene: pageState.initialScene,
    ...initialSurfaceOption,
    speechBalloonSize: pageState.speechBalloonSize,
    spriteSize: pageState.spriteSize,
    rules: fortuneEmbedRules,
  });

  fortuneWindow.__fortuneNanikaRuntime__.emit(pageState.event);
  if (runtimeStatus) {
    runtimeStatus.textContent = `ready #${runtimeBootCount}`;
  }
}

function emitFortuneEvent(eventName: RuntimeEventName, payload?: Record<string, unknown>) {
  fortuneWindow.__fortuneNanikaRuntime__?.emit(eventName, payload);
}

document.querySelectorAll<HTMLElement>("[data-fortune-event]").forEach((element) => {
  element.addEventListener("click", () => {
    const pageState = element.dataset.fortunePage ? fortuneRuntimePageStates[element.dataset.fortunePage] : null;
    const eventName = element.dataset.fortuneEvent;

    if (pageState) {
      createFortuneRuntime(pageState);
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
