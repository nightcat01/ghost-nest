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
  stageWidth: "min(360px, calc(var(--runtime-area-width, 360px) - 32px))",
  width: "100%",
  maxWidth: "100%",
  actionMenuMaxHeight: "min(128px, max(72px, calc(var(--floating-content-max-height, 220px) - 84px)))",
  minHeight: "clamp(82px, calc(var(--runtime-area-height, 720px) * 0.14), 104px)",
  maxHeight: "min(240px, max(var(--speech-balloon-min-height, 88px), var(--floating-content-max-height, calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 330px) - 96px))))",
  dialogueWidth: "min(100%, calc(var(--runtime-area-width, 460px) - 40px))",
  dialogueMaxWidth: "100%",
  dialogueHeight: "clamp(74px, calc(var(--runtime-area-height, 720px) * 0.14), 118px)",
  dialogueMinHeight: "clamp(72px, calc(var(--runtime-area-height, 720px) * 0.12), 96px)",
  dialogueMaxHeight: "min(220px, max(var(--speech-dialogue-min-height, 96px), calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 330px) - 72px)))",
  mobileWidth: "100%",
  mobileMaxHeight: "min(210px, max(88px, var(--floating-content-max-height, calc(var(--runtime-area-height, 640px) - var(--character-sprite-mobile-height, 232px) - 76px))))",
  mobileActionMenuMaxHeight: "min(120px, max(68px, calc(var(--floating-content-max-height, 190px) - 76px)))",
} satisfies SpeechBalloonSizeOptions;
