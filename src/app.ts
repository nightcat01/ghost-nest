import type { GhostRuntime, RuntimeEventName, RuntimeRule } from "./core/types.js";
import { nanikaPreset } from "./ghost/preset.js";
import {
  createGhostRuntimeFromPreset,
  createRuntimeRulesFromMappings,
  type NanikaMapping,
} from "./plugins/nanikaMapping/index.js";
import { runtimeSpeechPresets } from "./runtime/runtimeLayoutPresets.js";

type GhostNestWindow = Window & {
  __ghostNestRuntime__?: GhostRuntime;
};

const ghostNestWindow = window as GhostNestWindow;

type NanikaMappingsResponse = {
  ok?: boolean;
  mappings?: NanikaMapping[];
};

/**
 * Adds page-local rules that let the smoke-test deck exercise runtime UI actions.
 */
function createRuntimeTestRules(): RuntimeRule[] {
  return [
    {
      id: "test.layout.dialogue_overlay",
      event: "test:layout:dialogue_overlay",
      actions: [
        {
          type: "change_speech_layout",
          ...runtimeSpeechPresets.dialogueOverlay.layout,
        },
        {
          type: "set_speech_balloon_size",
          size: runtimeSpeechPresets.dialogueOverlay.size,
        },
        { type: "change_balloon", theme: "fortune_prompt" },
        { type: "speak_text", text: "하단 대사창 모드예요. 긴 문장이 들어와도 정해진 영역 안에서만 움직여요." },
        { type: "log", label: "test:layout.dialogue_overlay" },
      ],
    },
    {
      id: "test.layout.floating_compact",
      event: "test:layout:floating_compact",
      actions: [
        {
          type: "change_speech_layout",
          ...runtimeSpeechPresets.floatingCompact.layout,
        },
        {
          type: "set_speech_balloon_size",
          size: runtimeSpeechPresets.floatingCompact.size,
        },
        { type: "change_balloon", theme: "default" },
        { type: "speak_text", text: "말풍선 모드로 돌아왔어요. 캐릭터 옆에서 작게 표시됩니다." },
        { type: "log", label: "test:layout.floating_compact" },
      ],
    },
    {
      id: "test.layout.reset_ui",
      event: "test:layout:reset_ui",
      actions: [
        { type: "reset_runtime_ui" },
        { type: "speak_text", text: "런타임 UI 설정을 기본값으로 되돌렸어요." },
        { type: "log", label: "test:layout.reset_ui" },
      ],
    },
    {
      id: "test.scene.rine_demo",
      event: "test:scene:rine_demo",
      actions: [
        { type: "scene", id: "rine-demo-scene" },
        { type: "speak_text", text: "Rine demo scene을 적용했어요. 배경, 캐릭터 깊이, 소품 레이어가 함께 움직입니다." },
        { type: "log", label: "test:scene.rine_demo" },
      ],
    },
    {
      id: "test.scene.overlay",
      event: "test:scene:overlay",
      actions: [
        { type: "scene_overlay", id: "rine-demo-scene", slot: "demo-overlay", duration: 1500 },
        { type: "speak_text", text: "무대 오버레이를 잠깐 겹쳤어요. 기본 무대와 별도로 켜고 끌 수 있습니다." },
        { type: "log", label: "test:scene.overlay" },
      ],
    },
  ];
}

/**
 * Loads developer-saved mappings so the runtime page follows the mapping editor.
 */
async function loadSavedRuntimeRules() {
  try {
    const response = await fetch("/api/devtools/nanika-mappings");

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as NanikaMappingsResponse;

    if (!result.ok) {
      return null;
    }

    return createRuntimeRulesFromMappings(result.mappings ?? []);
  } catch {
    return null;
  }
}

/**
 * Creates a fresh runtime instance after cleaning up the previous one.
 */
async function bootRuntime() {
  ghostNestWindow.__ghostNestRuntime__?.destroy();
  const testRules = createRuntimeTestRules();
  const savedRules = await loadSavedRuntimeRules();
  ghostNestWindow.__ghostNestRuntime__ = createGhostRuntimeFromPreset(nanikaPreset, {
    ...(savedRules
      ? { replaceRules: [...savedRules, ...testRules] }
      : { rules: testRules }),
  });

  return ghostNestWindow.__ghostNestRuntime__;
}

/**
 * Emits a runtime event from the test panel.
 */
function emitRuntimeEvent(eventName: RuntimeEventName) {
  const runtime = ghostNestWindow.__ghostNestRuntime__;

  if (!runtime) {
    return;
  }

  if (eventName === "character:double_click" || eventName === "character:touch") {
    runtime.emit(eventName, { part: "face" });
    return;
  }

  if (eventName === "command:hover") {
    runtime.emit(eventName, { command: "fortune" });
    return;
  }

  runtime.emit(eventName);
}

/**
 * Applies a saved surface id through the same stage event used by dialogue scripts.
 */
function applyRuntimeSurface(surfaceId: string) {
  document.querySelector<HTMLElement>("#characterStage")?.dispatchEvent(
    new CustomEvent("ghostnest:surface-change", { detail: { id: surfaceId } }),
  );
}

/**
 * Runs test-only page controls that are not direct user events.
 */
function runRuntimeTestAction(action: string) {
  if (action === "dialogue-overlay") {
    emitRuntimeEvent("test:layout:dialogue_overlay");
    return;
  }

  if (action === "floating-compact") {
    emitRuntimeEvent("test:layout:floating_compact");
    return;
  }

  if (action === "panel-menu") {
    emitRuntimeEvent("character:right_click");
    return;
  }

  if (action === "reset-ui") {
    emitRuntimeEvent("test:layout:reset_ui");
    return;
  }

  if (action === "rine-demo-scene") {
    emitRuntimeEvent("test:scene:rine_demo");
    return;
  }

  if (action === "scene-overlay") {
    emitRuntimeEvent("test:scene:overlay");
  }
}

/**
 * Wires developer-only runtime smoke-test controls on the demo page.
 */
function bindRuntimeTestPanel() {
  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-event]").forEach((button) => {
    button.addEventListener("click", () => {
      emitRuntimeEvent(button.dataset.runtimeTestEvent as RuntimeEventName);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-surface]").forEach((button) => {
    button.addEventListener("click", () => {
      const surfaceId = button.dataset.runtimeTestSurface;

      if (surfaceId) {
        applyRuntimeSurface(surfaceId);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-runtime-test-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.runtimeTestAction;

      if (action) {
        runRuntimeTestAction(action);
      }
    });
  });

  document.querySelector<HTMLButtonElement>("#runtimeRebootButton")?.addEventListener("click", () => {
    void bootRuntime();
  });
}

void bootRuntime();
bindRuntimeTestPanel();
