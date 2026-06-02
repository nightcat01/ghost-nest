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
      minHeight: "88px",
      maxHeight: "min(30vh, 220px)",
      actionMenuMaxHeight: "128px",
      mobileMaxHeight: "min(28vh, 190px)",
      mobileActionMenuMaxHeight: "120px",
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
      dialogueHeight: "clamp(86px, 16vh, 132px)",
      dialogueMinHeight: "86px",
      dialogueMaxHeight: "clamp(86px, 16vh, 132px)",
      mobileMaxHeight: "clamp(82px, 18vh, 128px)",
      actionMenuMaxHeight: "96px",
      mobileActionMenuMaxHeight: "96px",
    },
  },
} satisfies Record<string, RuntimeSpeechPreset>;
