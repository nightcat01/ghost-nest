import { runtimeActionCatalog } from "./actionCatalog.js";
import { createCapabilityCatalogFromPlugins } from "./capabilityCatalog.js";
import { createCharacterCatalogItem, createCharacterResourceCatalog } from "./characterCatalog.js";
import { runtimeEventCatalog, type RuntimeEventCatalogItem } from "./eventCatalog.js";
import { hostEventCatalog } from "./hostEventCatalog.js";
import { createDefaultRules } from "../../runtime/defaultRules.js";
import { defaultTiming } from "../../runtime/runtimeDefaults.js";
import type { RuntimeAction, RuntimeEventName, RuntimeRule } from "../../core/types.js";
import type { NanikaRuntimePreset } from "./preset.js";

export type NanikaMappingRegistry = ReturnType<typeof createNanikaMappingRegistry>;

/**
 * Collects action types from nested action arrays used by timers or menu items.
 */
function collectActionTypes(actions: readonly RuntimeAction[], output = new Set<string>()) {
  actions.forEach((action) => {
    output.add(action.type);

    const record = action as Record<string, unknown>;
    if (Array.isArray(record.actions)) {
      collectActionTypes(record.actions as RuntimeAction[], output);
    }

    if (Array.isArray(record.items)) {
      record.items.forEach((item) => {
        const itemActions = (item as { actions?: RuntimeAction[] }).actions;

        if (Array.isArray(itemActions)) {
          collectActionTypes(itemActions, output);
        }
      });
    }
  });

  return output;
}

function createHostEventCatalogItem(event: RuntimeEventName): RuntimeEventCatalogItem {
  return {
    event,
    label: event,
    description: "호스트 앱이나 페이지에서 runtime.emit으로 전달하는 커스텀 이벤트입니다.",
  };
}

function createEventCatalogFromMappings(mappings: readonly RuntimeRule[]) {
  const baseEvents = [
    ...runtimeEventCatalog,
    ...hostEventCatalog,
  ];
  const knownEvents = new Set<RuntimeEventName>(baseEvents.map((item) => item.event));
  const hostEvents = Array.from(new Set(mappings.map((rule) => rule.event)))
    .filter((event) => !knownEvents.has(event))
    .sort()
    .map(createHostEventCatalogItem);

  return [
    ...baseEvents,
    ...hostEvents,
  ];
}

/**
 * Collects mapping editor source lists behind one plugin-facing entry point.
 */
export function createNanikaMappingRegistry(preset: NanikaRuntimePreset) {
  const plugins = preset.plugins ?? preset.options.plugins ?? [];
  const timing = {
    ...defaultTiming,
    ...preset.options.timing,
  };
  const mappings = [
    ...createDefaultRules(timing),
    ...(preset.rules ?? []),
  ];
  const events = createEventCatalogFromMappings(mappings);
  const mappedEvents = new Set(mappings.map((rule) => rule.event));
  const mappedActionTypes = collectActionTypes(mappings.flatMap((rule) => rule.actions));

  return {
    preset: {
      id: preset.id,
      name: preset.name ?? preset.id,
    },
    character: createCharacterCatalogItem(preset.character),
    characterResources: createCharacterResourceCatalog(preset.character),
    actions: runtimeActionCatalog,
    events,
    capabilities: preset.capabilities ?? createCapabilityCatalogFromPlugins(plugins),
    mappings,
    plugins,
    coverage: {
      mappedEvents: events.filter((event) => mappedEvents.has(event.event)),
      unmappedEvents: events.filter((event) => !mappedEvents.has(event.event)),
      mappedActions: runtimeActionCatalog.filter((action) => mappedActionTypes.has(action.type)),
      unmappedActions: runtimeActionCatalog.filter((action) => !mappedActionTypes.has(action.type)),
    },
  };
}
