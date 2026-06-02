import { createGhostRuntime } from "../../runtime/createGhostRuntime.js";
import { createCapabilityCatalogFromPlugins, type RuntimeCapabilityCatalogItem } from "./capabilityCatalog.js";
import { createRuntimeRulesFromMappings, type NanikaMapping } from "./mapping.js";
import type {
  CharacterDefinition,
  GhostRuntime,
  GhostRuntimeOptions,
  RuntimePlugin,
  RuntimeRule,
} from "../../core/types.js";

export type NanikaRuntimePresetOptions = Omit<
  GhostRuntimeOptions,
  "character" | "rules"
>;

export type NanikaRuntimePreset = {
  id: string;
  name?: string;
  character: CharacterDefinition;
  plugins?: RuntimePlugin[];
  rules?: RuntimeRule[];
  mappings?: NanikaMapping[];
  capabilities?: RuntimeCapabilityCatalogItem[];
  options: NanikaRuntimePresetOptions;
};

export type NanikaRuntimePresetOverrides = Partial<NanikaRuntimePresetOptions> & {
  plugins?: RuntimePlugin[];
  rules?: RuntimeRule[];
  replaceRules?: RuntimeRule[];
};

/**
 * Removes duplicated plugins while preserving the first occurrence.
 */
function uniquePluginsById(plugins: RuntimePlugin[]) {
  const seenPluginIds = new Set<string>();

  return plugins.filter((plugin) => {
    if (seenPluginIds.has(plugin.id)) {
      return false;
    }

    seenPluginIds.add(plugin.id);
    return true;
  });
}

/**
 * Creates a preset object that keeps character, capability, and mapping surfaces explicit.
 */
export function defineNanikaRuntimePreset(preset: NanikaRuntimePreset): NanikaRuntimePreset {
  return {
    ...preset,
    rules: [
      ...(preset.rules ?? []),
      ...createRuntimeRulesFromMappings(preset.mappings),
    ],
    capabilities: preset.capabilities ?? createCapabilityCatalogFromPlugins(preset.plugins),
  };
}

/**
 * Converts a Nanika preset into concrete runtime options.
 */
export function createGhostRuntimeOptionsFromPreset(
  preset: NanikaRuntimePreset,
  overrides: NanikaRuntimePresetOverrides = {},
): GhostRuntimeOptions {
  const { plugins: overridePlugins, rules: overrideRules, replaceRules, ...overrideOptions } = overrides;
  const { plugins: optionPlugins, ...baseOptions } = preset.options;

  return {
    ...baseOptions,
    ...overrideOptions,
    character: preset.character,
    plugins: uniquePluginsById([...(optionPlugins ?? []), ...(preset.plugins ?? []), ...(overridePlugins ?? [])]),
    rules: replaceRules ?? [...(preset.rules ?? []), ...(overrideRules ?? [])],
  };
}

/**
 * Boots a runtime from a preset while still allowing host-page overrides.
 */
export function createGhostRuntimeFromPreset(
  preset: NanikaRuntimePreset,
  overrides: NanikaRuntimePresetOverrides = {},
): GhostRuntime {
  return createGhostRuntime(createGhostRuntimeOptionsFromPreset(preset, overrides));
}
