import type {
  RuntimeAction,
  RuntimeCondition,
  RuntimeEventName,
  RuntimeRule,
  RuntimeRuleWhen,
} from "../../core/types.js";

export type NanikaMapping = {
  id: string;
  name?: string;
  description?: string;
  target?: {
    scope: string;
    id: string;
    label?: string;
  };
  event: RuntimeEventName;
  when?: RuntimeRuleWhen;
  conditions?: RuntimeCondition[];
  actions: RuntimeAction[];
};

export type NanikaFeatureSet = {
  id: string;
  name?: string;
  description?: string;
  mode?: "character-specific" | "character-template";
  sourceCharacterId?: string;
  requirements?: NanikaFeatureRequirement[];
  mappingIds: string[];
};

export type NanikaFeatureRequirement = {
  kind: "expression" | "surface" | "scene" | "layer" | "dialogue" | "hitArea";
  id: string;
  label?: string;
  required?: boolean;
};

export type NanikaFeatureSetRuleResult = {
  rules: RuntimeRule[];
  warnings: string[];
};

/**
 * Converts an editor-facing mapping into the runtime rule format.
 */
export function createRuntimeRuleFromMapping(mapping: NanikaMapping): RuntimeRule {
  const rule: RuntimeRule = {
    id: mapping.id,
    event: mapping.event,
    actions: mapping.actions,
  };

  if (mapping.when) {
    rule.when = mapping.when;
  }

  if (mapping.conditions) {
    rule.conditions = mapping.conditions;
  }

  return rule;
}

/**
 * Converts editor-facing mappings into runtime rules.
 */
export function createRuntimeRulesFromMappings(mappings: readonly NanikaMapping[] = []): RuntimeRule[] {
  return mappings.map(createRuntimeRuleFromMapping);
}

/**
 * Resolves reusable feature sets into runtime rules using saved mappings.
 */
export function createRuntimeRulesFromFeatureSets(
  featureSets: readonly NanikaFeatureSet[] = [],
  mappings: readonly NanikaMapping[] = [],
  featureSetIds: readonly string[] = featureSets.map((featureSet) => featureSet.id),
): NanikaFeatureSetRuleResult {
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const featureSetById = new Map(featureSets.map((featureSet) => [featureSet.id, featureSet]));
  const selectedFeatureSetIds = Array.from(new Set(featureSetIds));
  const selectedMappingIds: string[] = [];
  const warnings: string[] = [];

  selectedFeatureSetIds.forEach((featureSetId) => {
    const featureSet = featureSetById.get(featureSetId);

    if (!featureSet) {
      warnings.push(`Missing feature set: ${featureSetId}`);
      return;
    }

    featureSet.mappingIds.forEach((mappingId) => {
      if (!mappingById.has(mappingId)) {
        warnings.push(`Missing mapping '${mappingId}' in feature set '${featureSet.id}'`);
        return;
      }

      selectedMappingIds.push(mappingId);
    });
  });

  const rules = Array.from(new Set(selectedMappingIds))
    .map((mappingId) => mappingById.get(mappingId))
    .filter((mapping): mapping is NanikaMapping => Boolean(mapping))
    .map(createRuntimeRuleFromMapping);

  return {
    rules,
    warnings,
  };
}
