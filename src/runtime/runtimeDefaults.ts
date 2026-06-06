import type {
  CharacterSpriteSizeOptions,
  RuntimeControlOptions,
  RuntimeFeatureOptions,
  RuntimeUserPreferenceOptions,
  SpeechBalloonSizeOptions,
  RuntimeTimingOptions,
  SpeechTypingOptions,
} from "../core/types.js";

export const defaultTiming: RuntimeTimingOptions = {
  idleDelay: 18000,
  randomPromptDelay: 14000,
  randomPromptCooldown: 22000,
  randomPromptChance: 0.18,
  areaHoverCooldown: 5000,
};

export const defaultMaxLogItems = 8;

export const defaultControls = {
  speech: true,
  typing: true,
  characterClick: true,
  characterTouch: true,
  characterRightClick: true,
  characterHoverEffect: true,
  commandButtons: true,
  commandHoverDescription: true,
  areaHoverDescription: true,
  idleReaction: true,
  randomPrompt: true,
  managementMenu: true,
  plugins: true,
  persistence: true,
  floatingLayout: true,
  devtools: true,
  diagnostics: true,
  hitboxEditor: true,
  debugHitAreas: false,
} satisfies RuntimeControlOptions;

export const defaultFeatures = {
  commandHoverDescription: true,
  debugHitAreas: false,
} satisfies RuntimeFeatureOptions;

export const defaultUserPreferences = {
  speechTheme: true,
  speechLayout: true,
  speechFontSize: true,
  speechSize: true,
  characterPosition: true,
} satisfies RuntimeUserPreferenceOptions;

export const defaultSpriteSize = {
  desktopWidth: "220px",
  desktopHeight: "330px",
  mobileWidth: "154px",
  mobileHeight: "232px",
} satisfies CharacterSpriteSizeOptions;

export const defaultTyping = {
  enabled: true,
  interval: 28,
} satisfies SpeechTypingOptions;

export const defaultSpeechBalloonSize = {
  stageWidth: "min(420px, calc(var(--runtime-area-width, 420px) - 48px))",
  width: "100%",
  maxWidth: "100%",
  actionMenuMaxHeight: "min(168px, max(76px, calc(var(--floating-content-max-height, 240px) - 88px)))",
  minHeight: "clamp(88px, calc(var(--runtime-area-height, 720px) * 0.16), 118px)",
  maxHeight: "min(340px, max(var(--speech-balloon-min-height, 104px), var(--floating-content-max-height, calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 330px) - 96px))))",
  dialogueWidth: "min(100%, calc(var(--runtime-area-width, 560px) - 48px))",
  dialogueMaxWidth: "100%",
  dialogueHeight: "clamp(86px, calc(var(--runtime-area-height, 720px) * 0.18), 148px)",
  dialogueMinHeight: "clamp(82px, calc(var(--runtime-area-height, 720px) * 0.14), 118px)",
  dialogueMaxHeight: "min(280px, max(var(--speech-dialogue-min-height, 118px), calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 330px) - 72px)))",
  mobileWidth: "100%",
  mobileMaxHeight: "min(260px, max(92px, var(--floating-content-max-height, calc(var(--runtime-area-height, 640px) - var(--character-sprite-mobile-height, 232px) - 76px))))",
  mobileActionMenuMaxHeight: "min(150px, max(72px, calc(var(--floating-content-max-height, 220px) - 84px)))",
} satisfies SpeechBalloonSizeOptions;
