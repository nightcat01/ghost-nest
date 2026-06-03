import type { ManagementMenuOptions, SpeechBalloonSizeOptions, SpeechLayoutOptions } from "../core/types.js";

export const managementMenuStorageKey = "managementMenu.options";
export const runtimeUiStorageKey = "runtimeUi.options";

export type RuntimeUiPreferences = {
  balloonTheme?: string;
  balloonFontSize?: string;
  speechLayout?: SpeechLayoutOptions;
  speechBalloonSize?: Partial<SpeechBalloonSizeOptions>;
  characterPosition?: {
    x: number;
    y: number;
  };
};

const speechBalloonSizeKeys = [
  "stageWidth",
  "width",
  "maxWidth",
  "actionMenuMaxHeight",
  "minHeight",
  "maxHeight",
  "dialogueWidth",
  "dialogueMaxWidth",
  "dialogueHeight",
  "dialogueMinHeight",
  "dialogueMaxHeight",
  "mobileWidth",
  "mobileMaxHeight",
  "mobileActionMenuMaxHeight",
] as const satisfies ReadonlyArray<keyof SpeechBalloonSizeOptions>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cloneManagementMenuOptions(options: ManagementMenuOptions | undefined): ManagementMenuOptions {
  return {
    ...options,
    displays: { ...options?.displays },
  };
}

export function readStoredManagementMenuOptions(value: unknown): ManagementMenuOptions {
  if (!isRecord(value)) {
    return {};
  }

  const options: ManagementMenuOptions = {};

  if (typeof value.defaultDisplay === "string") {
    options.defaultDisplay = value.defaultDisplay;
  }

  if (isRecord(value.displays)) {
    options.displays = Object.fromEntries(
      Object.entries(value.displays).filter(([, display]) => typeof display === "string"),
    ) as Record<string, string>;
  }

  return options;
}

export function readStoredRuntimeUiPreferences(value: unknown): RuntimeUiPreferences {
  if (!isRecord(value)) {
    return {};
  }

  const preferences: RuntimeUiPreferences = {};

  if (typeof value.balloonTheme === "string") {
    preferences.balloonTheme = value.balloonTheme;
  }

  if (typeof value.balloonFontSize === "string") {
    preferences.balloonFontSize = value.balloonFontSize;
  }

  if (isRecord(value.speechLayout)) {
    const speechLayout: SpeechLayoutOptions = {};

    if (value.speechLayout.mode === "floating" || value.speechLayout.mode === "dialogue-box") {
      speechLayout.mode = value.speechLayout.mode;
    }

    if (
      value.speechLayout.placement === "below-character" ||
      value.speechLayout.placement === "overlay-bottom"
    ) {
      speechLayout.placement = value.speechLayout.placement;
    }

    if (
      value.speechLayout.overlayAnchor === "left" ||
      value.speechLayout.overlayAnchor === "right" ||
      value.speechLayout.overlayAnchor === "center"
    ) {
      speechLayout.overlayAnchor = value.speechLayout.overlayAnchor;
    }

    if (speechLayout.mode || speechLayout.placement || speechLayout.overlayAnchor) {
      preferences.speechLayout = speechLayout;
    }
  }

  if (isRecord(value.speechBalloonSize)) {
    const storedSize = value.speechBalloonSize;
    const speechBalloonSize: Partial<SpeechBalloonSizeOptions> = {};

    speechBalloonSizeKeys.forEach((key) => {
      const storedValue = storedSize[key];

      if (typeof storedValue === "string") {
        speechBalloonSize[key] = storedValue;
      }
    });

    if (Object.keys(speechBalloonSize).length > 0) {
      preferences.speechBalloonSize = speechBalloonSize;
    }
  }

  if (isRecord(value.characterPosition)) {
    const { x, y } = value.characterPosition;

    if (typeof x === "number" && typeof y === "number") {
      preferences.characterPosition = { x, y };
    }
  }

  return preferences;
}
