import type { SpeechBalloonSizeOptions, SpeechLayoutOptions } from "../core/types.js";

export type RuntimeSpeechPreset = {
  layout: SpeechLayoutOptions;
  size: Partial<SpeechBalloonSizeOptions>;
};

export const runtimeSpeechPresets = {
  floatingCompact: {
    layout: {
      mode: "floating",
      placement: "below-character",
    },
    size: {
      stageWidth: "min(360px, calc(var(--runtime-area-width, 360px) - 24px))",
      width: "100%",
      maxWidth: "100%",
      minHeight: "clamp(82px, calc(var(--runtime-area-height, 640px) * 0.15), 104px)",
      maxHeight: "min(240px, max(var(--speech-balloon-min-height, 88px), var(--floating-content-max-height, 220px)))",
      actionMenuMaxHeight: "min(128px, max(72px, calc(var(--floating-content-max-height, 220px) - 84px)))",
      mobileMaxHeight: "min(210px, max(88px, var(--floating-content-max-height, 190px)))",
      mobileActionMenuMaxHeight: "min(120px, max(68px, calc(var(--floating-content-max-height, 190px) - 76px)))",
    },
  },
  dialogueOverlay: {
    layout: {
      mode: "dialogue-box",
      placement: "overlay-bottom",
    },
    size: {
      stageWidth: "min(100%, var(--runtime-area-width, 430px))",
      dialogueWidth: "min(100%, calc(var(--runtime-area-width, 430px) - 28px))",
      dialogueMaxWidth: "430px",
      dialogueHeight: "clamp(86px, calc(var(--runtime-area-height, 560px) * 0.16), 132px)",
      dialogueMinHeight: "86px",
      dialogueMaxHeight: "clamp(86px, calc(var(--runtime-area-height, 560px) * 0.16), 132px)",
      mobileMaxHeight: "clamp(82px, calc(var(--runtime-area-height, 520px) * 0.18), 128px)",
      actionMenuMaxHeight: "min(96px, max(64px, calc(var(--speech-dialogue-max-height, 132px) - 32px)))",
      mobileActionMenuMaxHeight: "min(96px, max(64px, calc(var(--speech-balloon-mobile-max-height, 128px) - 32px)))",
    },
  },
  dialogueBelow: {
    layout: {
      mode: "dialogue-box",
      placement: "below-character",
    },
    size: {
      stageWidth: "min(100%, var(--runtime-area-width, 560px))",
      dialogueWidth: "min(100%, calc(var(--runtime-area-width, 560px) - 48px))",
      dialogueMaxWidth: "100%",
      dialogueHeight: "clamp(86px, calc(var(--runtime-area-height, 560px) * 0.16), 132px)",
      dialogueMinHeight: "86px",
      dialogueMaxHeight: "clamp(86px, calc(var(--runtime-area-height, 560px) * 0.16), 132px)",
      mobileMaxHeight: "clamp(82px, calc(var(--runtime-area-height, 520px) * 0.18), 128px)",
      actionMenuMaxHeight: "min(96px, max(64px, calc(var(--speech-dialogue-max-height, 132px) - 32px)))",
      mobileActionMenuMaxHeight: "min(96px, max(64px, calc(var(--speech-balloon-mobile-max-height, 128px) - 32px)))",
    },
  },
  fortuneEmbed: {
    layout: {
      mode: "dialogue-box",
      placement: "overlay-bottom",
      overlayAnchor: "right",
    },
    size: {
      stageWidth: "min(100%, var(--runtime-area-width, 430px))",
      dialogueWidth: "min(72%, 320px)",
      dialogueMaxWidth: "320px",
      dialogueHeight: "clamp(74px, calc(var(--runtime-area-height, 520px) * 0.13), 112px)",
      dialogueMinHeight: "74px",
      dialogueMaxHeight: "clamp(74px, calc(var(--runtime-area-height, 520px) * 0.13), 112px)",
      mobileMaxHeight: "clamp(72px, calc(var(--runtime-area-height, 480px) * 0.15), 108px)",
      actionMenuMaxHeight: "min(88px, max(60px, calc(var(--speech-dialogue-max-height, 112px) - 28px)))",
      mobileActionMenuMaxHeight: "min(88px, max(60px, calc(var(--speech-balloon-mobile-max-height, 108px) - 28px)))",
    },
  },
} satisfies Record<string, RuntimeSpeechPreset>;
