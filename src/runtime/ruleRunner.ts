import type {
  RuntimeAction,
  RuntimeCondition,
  RuntimeControlOptions,
  RuntimeEventHandler,
  RuntimeEventName,
  RuntimeEventPayload,
  RuntimeRule,
  RuntimeState,
} from "../core/types.js";

type RuntimeEventBus = {
  on: <TEventName extends RuntimeEventName>(
    eventName: TEventName,
    handler: RuntimeEventHandler<TEventName>,
  ) => () => void;
};

type RuleRunnerOptions = {
  eventBus: RuntimeEventBus;
  rules: RuntimeRule[];
  controls: RuntimeControlOptions;
  state: RuntimeState;
  ruleCooldowns: Map<string, number>;
  runActions: (actions: RuntimeAction[]) => void | Promise<void>;
  setLastEventLabel: (eventName: RuntimeEventName) => void;
};

function matchesRuleWhen(rule: RuntimeRule, payload: RuntimeEventPayload<RuntimeEventName>) {
  if (!rule.when) {
    return true;
  }

  return Object.entries(rule.when).every(([key, value]) => {
    return (payload as Record<string, unknown>)[key] === value;
  });
}

function createConditionChecker({
  controls,
  state,
  ruleCooldowns,
}: Pick<RuleRunnerOptions, "controls" | "state" | "ruleCooldowns">) {
  return function passesConditions(conditions: RuntimeCondition[] = []) {
    const now = Date.now();
    const passedCooldowns: Array<{ key: string; time: number }> = [];

    for (const condition of conditions) {
      switch (condition.type) {
        case "feature_enabled":
          if (!controls[condition.feature]) {
            return false;
          }
          break;
        case "not_hidden":
          if (state.isHidden) {
            return false;
          }
          break;
        case "mode_is":
          if (state.mode !== condition.state) {
            return false;
          }
          break;
        case "cooldown":
          if (now - (ruleCooldowns.get(condition.key) ?? 0) < condition.duration) {
            return false;
          }

          passedCooldowns.push({ key: condition.key, time: now });
          break;
      }
    }

    passedCooldowns.forEach(({ key, time }) => ruleCooldowns.set(key, time));
    return true;
  };
}

export function bindRuntimeRuleEvents(options: RuleRunnerOptions) {
  const { eventBus, rules, runActions, setLastEventLabel } = options;
  const passesConditions = createConditionChecker(options);
  const ruleEventNames = Array.from(new Set(rules.map((rule) => rule.event)));

  function runRules<TEventName extends RuntimeEventName>(
    eventName: TEventName,
    payload: RuntimeEventPayload<TEventName>,
  ) {
    setLastEventLabel(eventName);
    rules
      .filter((rule) => rule.event === eventName)
      .filter((rule) => matchesRuleWhen(rule, payload))
      .filter((rule) => passesConditions(rule.conditions))
      .forEach((rule) => {
        void runActions(rule.actions);
      });
  }

  ruleEventNames.forEach((eventName) => {
    eventBus.on(eventName, (payload) => runRules(eventName, payload));
  });
}
