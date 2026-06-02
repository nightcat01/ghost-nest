import type {
  RuntimeControlOptions,
  RuntimeEventName,
  RuntimeEventPayload,
  RuntimeState,
  RuntimeTimingOptions,
} from "../core/types.js";

type RuntimeEventEmitter = {
  emit: <TEventName extends RuntimeEventName>(
    eventName: TEventName,
    payload?: RuntimeEventPayload<TEventName>,
  ) => void;
};

type StartRuntimeTimersOptions = {
  eventBus: RuntimeEventEmitter;
  state: RuntimeState;
  timing: RuntimeTimingOptions;
  controls: RuntimeControlOptions;
  renderStatusPanel: () => void;
  touchInteraction: () => void;
};

export function startRuntimeTimers({
  eventBus,
  state,
  timing,
  controls,
  renderStatusPanel,
  touchInteraction,
}: StartRuntimeTimersOptions) {
  const idleTimer = window.setInterval(() => {
    if (!controls.idleReaction || state.isHidden) {
      return;
    }

    const idleTime = Date.now() - state.lastInteractionAt;

    if (idleTime >= timing.idleDelay) {
      touchInteraction();
      eventBus.emit("character:idle");
    }
  }, 1000);

  const statusTimer = window.setInterval(() => {
    renderStatusPanel();
  }, 1000);

  const randomPromptTimer = window.setInterval(() => {
    if (!controls.randomPrompt || state.isHidden) {
      return;
    }

    const now = Date.now();
    const idleTime = now - state.lastInteractionAt;
    const promptCooldown = now - state.lastPromptedAt;

    if (
      idleTime >= timing.randomPromptDelay &&
      promptCooldown >= timing.randomPromptCooldown &&
      Math.random() < timing.randomPromptChance
    ) {
      eventBus.emit("character:randomPrompt");
    }
  }, 3000);

  return () => {
    window.clearInterval(idleTimer);
    window.clearInterval(statusTimer);
    window.clearInterval(randomPromptTimer);
  };
}
