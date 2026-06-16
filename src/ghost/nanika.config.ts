import type {
  CharacterSpriteSizeOptions,
  GhostRuntimeOptions,
  ManagementMenuOptions,
  RuntimeDevtoolsOptions,
  RuntimeControlOptions,
  RuntimeSceneOptions,
  RuntimePlugin,
  RuntimeSelectors,
  SpeechBalloonSizeOptions,
  SpeechTypingOptions,
} from "../core/types.js";
import { createDemoPlugins } from "../demo/demoPlugins.js";
import { characterSettingsExtensionConfig } from "../plugins/characterSettings/index.js";
import { comfyAssetGeneratorExtensionConfig } from "../plugins/comfyAssetGenerator/index.js";
import { menuSettingsExtensionConfig } from "../plugins/menuSettings/index.js";
import { nanikaMappingExtensionConfig } from "../plugins/nanikaMapping/index.js";

export const enabledExtensions = {
  "character-settings": characterSettingsExtensionConfig,
  "comfy-asset-generator": comfyAssetGeneratorExtensionConfig,
  "menu-settings": menuSettingsExtensionConfig,
  "nanika-mapping": nanikaMappingExtensionConfig,
} as const;

/**
 * Registers feature providers that GhostNest can call through mapped actions.
 * Replace these plugins with API, DB, AI, or app-specific adapters in a real service.
 */
const externalFeatures = [
  ...createDemoPlugins(),
] satisfies RuntimePlugin[];

/**
 * Connects the runtime to DOM nodes owned by the host page.
 * Change these selectors when embedding GhostNest into a different layout.
 */
const runtimeSelectors = {
  stage: "#characterStage",
  sprite: "#characterSprite",
  spriteImage: "#characterSpriteImage",
  speechBalloon: "#speechBalloon",
  speakerName: "#speakerName",
  speechText: "#speechText",
  balloonActionMenu: "#balloonActionMenu",
  panelActionMenu: "#panelActionMenu",
  menuButtons: "[data-command], [data-plugin]",
  restoreBadge: "#restoreBadge",
  observeAreas: "[data-observe-area]",
} satisfies RuntimeSelectors;

/**
 * Wires optional developer tools without mixing them into user-facing actions.
 * These can be removed or replaced when shipping a production-only build.
 */
const devtoolOptions = {
  diagnostics: {
    selectors: {
      eventLog: "#eventLog",
      statusMode: "#statusMode",
      statusExpression: "#statusExpression",
      statusVisibility: "#statusVisibility",
      statusLastEvent: "#statusLastEvent",
      statusIdleCountdown: "#statusIdleCountdown",
      statusRandomPrompt: "#statusRandomPrompt",
      statusActionTimers: "#statusActionTimers",
      statusRuntimeArea: "#statusRuntimeArea",
      statusSpeechBox: "#statusSpeechBox",
    },
  },
  hitboxEditor: {
    selectors: {
      editor: "#hitboxEditor",
      addButton: "#hitboxEditorAdd",
      closeButton: "#hitboxEditorClose",
      body: "#hitboxEditorBody",
      copyButton: "#hitboxEditorCopy",
    },
  },
} satisfies RuntimeDevtoolsOptions;

/**
 * Defines where management menus open by default and per menu id.
 * Developers can keep global menus in the balloon while moving heavier tools to panels.
 */
const managementMenuOptions = {
  defaultDisplay: "balloon",
  displays: {
    "system-tools": "panel",
  },
} satisfies ManagementMenuOptions;

/**
 * Controls which runtime capabilities are allowed in this Nanika preset.
 */
const controlOptions = {
  commandHoverDescription: true,
  areaHoverDescription: true,
  idleReaction: true,
  randomPrompt: true,
  managementMenu: true,
  plugins: true,
  devtools: true,
  diagnostics: true,
  hitboxEditor: true,
  debugHitAreas: true,
} satisfies Partial<RuntimeControlOptions>;

/**
 * Controls the dialogue typing effect shared by plain text and DialogueScript output.
 */
const typingOptions = {
  enabled: true,
  interval: 26,
} satisfies Partial<SpeechTypingOptions>;

/**
 * Limits the speech balloon area so long text or large layouts do not push the character scene around.
 */
const speechBalloonSizeOptions = {
  stageWidth: "min(360px, calc(var(--runtime-area-width, 360px) - 32px))",
  maxWidth: "100%",
  dialogueWidth: "min(100%, calc(var(--runtime-area-width, 460px) - 40px))",
  dialogueMaxWidth: "430px",
  dialogueHeight: "min(30vh, 260px)",
  dialogueMaxHeight: "min(220px, max(var(--speech-dialogue-min-height, 96px), calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 390px) - 72px)))",
  actionMenuMaxHeight: "156px",
  mobileMaxHeight: "min(30vh, calc(var(--runtime-area-height, 640px) - var(--character-sprite-mobile-height, 255px) - 76px))",
  mobileActionMenuMaxHeight: "136px",
} satisfies Partial<SpeechBalloonSizeOptions>;

/**
 * Keeps room/background/prop composition outside the character surface definition.
 */
const sceneOptions = {
  defaultScene: "desk-room",
  sceneSets: {
    "desk-room": [
      {
        id: "desk-room-default",
        layers: [
          {
            id: "room-backdrop",
            role: "background",
            className: "scene-layer-room-backdrop",
            depth: 0,
          },
          {
            id: "character-slot",
            role: "character",
            depth: 20,
          },
          {
            id: "desk-prop",
            role: "prop",
            className: "scene-layer-desk-prop",
            depth: 30,
            placement: {
              x: 20,
              y: 74,
              width: 80,
              height: 25,
              unit: "percent",
            },
          },
        ],
      },
    ],
  },
} satisfies RuntimeSceneOptions;

/**
 * Sets the rendered character size for desktop and mobile breakpoints.
 */
const spriteSizeOptions = {
  desktopWidth: "260px",
  desktopHeight: "390px",
  mobileWidth: "170px",
  mobileHeight: "255px",
} satisfies Partial<CharacterSpriteSizeOptions>;

/**
 * Developer-facing Nanika configuration.
 * Character data and action rules are imported separately so the three public surfaces stay clear.
 */
export const nanikaConfig = {
  plugins: externalFeatures,
  selectors: runtimeSelectors,
  devtools: devtoolOptions,
  managementMenu: managementMenuOptions,
  scene: sceneOptions,
  controls: controlOptions,
  typing: typingOptions,
  speechBalloonSize: speechBalloonSizeOptions,
  spriteSize: spriteSizeOptions,
} satisfies Omit<GhostRuntimeOptions, "character" | "rules">;
