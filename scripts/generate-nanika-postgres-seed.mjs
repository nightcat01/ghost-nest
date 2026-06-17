import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedDir = path.join(root, "generated");
const postgresDir = path.join(root, "docs", "nanika-postgres");

function readJsonIfExists(fileName, fallback) {
  const filePath = path.join(generatedDir, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sql(value) {
  if (value === undefined || value === null || value === "") {
    return "null";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonb(value) {
  if (value === undefined || value === null) {
    return "null";
  }
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function textArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "array[]::text[]";
  }
  return `array[${values.map((value) => `${sql(value)}::text`).join(", ")}]`;
}

function mappingTarget(mapping) {
  const target = mapping.target && typeof mapping.target === "object" ? mapping.target : {};
  return {
    scope: target.scope,
    id: target.id,
    label: target.label,
  };
}

function buildMappings(mappings) {
  if (!mappings.length) {
    return "-- No generated mappings.\n";
  }

  const rows = mappings.map((mapping, index) => {
    const target = mappingTarget(mapping);
    return `  (
    ${sql(mapping.id)},
    ${sql(mapping.name)},
    ${sql(mapping.description)},
    ${sql(target.scope)},
    ${sql(target.id)},
    ${sql(target.label)},
    ${sql(mapping.event)},
    ${jsonb(mapping.when)},
    ${jsonb(mapping.conditions)},
    ${jsonb(mapping.actions ?? [])},
    ${(index + 1) * 10}
  )`;
  });

  return `insert into public.nanika_mappings (
  id,
  name,
  description,
  target_scope,
  target_id,
  target_label,
  event,
  when_json,
  conditions_json,
  actions_json,
  sort_order
)
values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  target_scope = excluded.target_scope,
  target_id = excluded.target_id,
  target_label = excluded.target_label,
  event = excluded.event,
  when_json = excluded.when_json,
  conditions_json = excluded.conditions_json,
  actions_json = excluded.actions_json,
  sort_order = excluded.sort_order,
  enabled = true;
`;
}

function buildFeatureSets(featureSets) {
  if (!featureSets.length) {
    return "-- No generated feature sets.\n";
  }

  const rows = featureSets.map((featureSet, index) => `  (
    ${sql(featureSet.id)},
    ${sql(featureSet.name)},
    ${sql(featureSet.description)},
    ${sql(featureSet.mode ?? "character-specific")},
    ${sql(featureSet.sourceCharacterId)},
    ${jsonb(featureSet.requirements ?? [])},
    ${textArray(featureSet.mappingIds ?? [])},
    ${(index + 1) * 10}
  )`);

  return `insert into public.nanika_feature_sets (
  id,
  name,
  description,
  mode,
  source_character_id,
  requirements_json,
  mapping_ids,
  sort_order
)
values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  mode = excluded.mode,
  source_character_id = excluded.source_character_id,
  requirements_json = excluded.requirements_json,
  mapping_ids = excluded.mapping_ids,
  sort_order = excluded.sort_order,
  enabled = true;
`;
}

function buildMenus(menus) {
  if (!menus.length) {
    return "-- No generated menus.\n";
  }

  const rows = menus.map((menu, index) => `  (
    ${sql(menu.id)},
    ${sql(menu.name)},
    ${sql(menu.description)},
    ${sql(menu.audience ?? "user")},
    ${sql(menu.defaultDisplay ?? "balloon")},
    ${menu.closeOnSelect === false ? "false" : "true"},
    ${menu.draggable === false ? "false" : "true"},
    ${jsonb(menu.items ?? [])},
    ${(index + 1) * 10}
  )`);

  return `insert into public.nanika_menus (
  id,
  name,
  description,
  audience,
  default_display,
  close_on_select,
  draggable,
  items_json,
  sort_order
)
values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  audience = excluded.audience,
  default_display = excluded.default_display,
  close_on_select = excluded.close_on_select,
  draggable = excluded.draggable,
  items_json = excluded.items_json,
  sort_order = excluded.sort_order,
  enabled = true;
`;
}

function buildConditions(conditions) {
  if (!conditions.length) {
    return `-- No generated/nanika-conditions.json file exists in this workspace yet.
-- Conditions created in devtools should be inserted into public.nanika_conditions
-- and read through public.nanika_condition_definitions.
`;
  }

  const rows = conditions.map((condition, index) => `  (
    ${sql(condition.id)},
    ${sql(condition.scope)},
    ${sql(condition.type)},
    ${sql(condition.operator)},
    ${sql(condition.value)},
    ${sql(condition.label)},
    ${sql(condition.description)},
    ${(index + 1) * 10}
  )`);

  return `insert into public.nanika_conditions (
  id,
  scope,
  type,
  operator,
  value,
  label,
  description,
  sort_order
)
values
${rows.join(",\n")}
on conflict (id) do update set
  scope = excluded.scope,
  type = excluded.type,
  operator = excluded.operator,
  value = excluded.value,
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;
`;
}

function profileCharacterRows(runtimeProfiles) {
  const rows = [];
  runtimeProfiles.forEach((profile) => {
    (profile.characterProfiles ?? []).forEach((characterProfile, index) => {
      rows.push(`  (
    ${sql(profile.id)},
    ${sql(characterProfile.characterId)},
    ${(index + 1) * 10},
    ${jsonb(characterProfile.match)},
    ${jsonb(characterProfile.initial)},
    ${jsonb(characterProfile.controls)},
    ${jsonb(characterProfile.userPreferences)},
    ${jsonb(characterProfile.preferenceStorage)},
    ${jsonb(characterProfile.speechLayout)},
    ${jsonb(characterProfile.speechBalloonSize)},
    ${jsonb(characterProfile.spriteSize)},
    ${sql(characterProfile.balloonTheme)},
    ${typeof characterProfile.includeDefaultRules === "boolean" ? String(characterProfile.includeDefaultRules) : "null"},
    ${textArray(characterProfile.featureSetIds ?? [])},
    ${textArray(characterProfile.mappingIds ?? [])},
    ${jsonb(characterProfile.slotBindings)}
  )`);
    });
  });
  return rows;
}

function buildRuntimeProfiles(runtimeProfiles) {
  if (!runtimeProfiles.length) {
    return "-- No generated runtime profiles.\n";
  }

  const profileRows = runtimeProfiles.map((profile, index) => `  (
    ${sql(profile.id)},
    ${sql(profile.name)},
    ${sql(profile.description)},
    ${jsonb(profile.match)},
    ${jsonb(profile.initial)},
    ${jsonb(profile.controls)},
    ${jsonb(profile.preferenceStorage)},
    ${jsonb(profile.speechLayout)},
    ${jsonb(profile.speechBalloonSize)},
    ${jsonb(profile.spriteSize)},
    ${sql(profile.balloonTheme)},
    ${typeof profile.includeDefaultRules === "boolean" ? String(profile.includeDefaultRules) : "true"},
    ${textArray(profile.featureSetIds ?? [])},
    ${textArray(profile.mappingIds ?? [])},
    ${(index + 1) * 10}
  )`);

  const characterRows = profileCharacterRows(runtimeProfiles);
  const characterSql = characterRows.length
    ? `
insert into public.nanika_runtime_profile_characters (
  profile_id,
  character_id,
  sort_order,
  match_json,
  initial_json,
  controls_json,
  user_preferences_json,
  preference_storage_json,
  speech_layout_json,
  speech_balloon_size_json,
  sprite_size_json,
  balloon_theme,
  include_default_rules,
  feature_set_ids,
  mapping_ids,
  slot_bindings_json
)
values
${characterRows.join(",\n")}
on conflict (profile_id, character_id) do update set
  sort_order = excluded.sort_order,
  match_json = excluded.match_json,
  initial_json = excluded.initial_json,
  controls_json = excluded.controls_json,
  user_preferences_json = excluded.user_preferences_json,
  preference_storage_json = excluded.preference_storage_json,
  speech_layout_json = excluded.speech_layout_json,
  speech_balloon_size_json = excluded.speech_balloon_size_json,
  sprite_size_json = excluded.sprite_size_json,
  balloon_theme = excluded.balloon_theme,
  include_default_rules = excluded.include_default_rules,
  feature_set_ids = excluded.feature_set_ids,
  mapping_ids = excluded.mapping_ids,
  slot_bindings_json = excluded.slot_bindings_json;
`
    : "";

  return `insert into public.nanika_runtime_profiles (
  id,
  name,
  description,
  match_json,
  initial_json,
  controls_json,
  preference_storage_json,
  speech_layout_json,
  speech_balloon_size_json,
  sprite_size_json,
  balloon_theme,
  include_default_rules,
  feature_set_ids,
  mapping_ids,
  sort_order
)
values
${profileRows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  match_json = excluded.match_json,
  initial_json = excluded.initial_json,
  controls_json = excluded.controls_json,
  preference_storage_json = excluded.preference_storage_json,
  speech_layout_json = excluded.speech_layout_json,
  speech_balloon_size_json = excluded.speech_balloon_size_json,
  sprite_size_json = excluded.sprite_size_json,
  balloon_theme = excluded.balloon_theme,
  include_default_rules = excluded.include_default_rules,
  feature_set_ids = excluded.feature_set_ids,
  mapping_ids = excluded.mapping_ids,
  sort_order = excluded.sort_order,
  enabled = true;
${characterSql}`;
}

function buildSeed() {
  const mappings = readJsonIfExists("nanika-mappings.json", { mappings: [] }).mappings ?? [];
  const featureSets = readJsonIfExists("nanika-feature-sets.json", { featureSets: [] }).featureSets ?? [];
  const runtimeProfiles = readJsonIfExists("nanika-runtime-profiles.json", { runtimeProfiles: [] }).runtimeProfiles ?? [];
  const menus = readJsonIfExists("nanika-menus.json", { menus: [] }).menus ?? [];
  const conditions = readJsonIfExists("nanika-conditions.json", { conditions: [] }).conditions ?? [];

  return `-- Current GhostNest generated Nanika seed.
-- Source files:
-- - generated/nanika-mappings.json
-- - generated/nanika-feature-sets.json
-- - generated/nanika-runtime-profiles.json
-- - generated/nanika-menus.json
-- - generated/nanika-conditions.json, when present
--
-- Run docs/nanika-postgres/schema.sql first.
-- This seed stores runtime-ready JSON metadata only. It does not store image binaries.

begin;

insert into public.nanika_characters (
  id,
  display_name,
  description,
  asset_base_url,
  profile_json,
  character_json
)
values (
  'rine',
  'Rine',
  'Demo guide character used by GhostNest generated mapping examples.',
  '/assets/nanika/rine',
  '{
    "id": "rine",
    "name": "Rine",
    "defaultExpression": "neutral"
  }'::jsonb,
  '{
    "note": "Host apps may store the full CharacterDefinition here, or load it from a package and use this row as operational metadata."
  }'::jsonb
)
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  asset_base_url = excluded.asset_base_url,
  profile_json = excluded.profile_json,
  character_json = excluded.character_json;

${buildMappings(mappings)}
${buildFeatureSets(featureSets)}
${buildMenus(menus)}
${buildRuntimeProfiles(runtimeProfiles)}
${buildConditions(conditions)}
commit;
`;
}

function stripTrailingNewlines(source) {
  return source.replace(/\s+$/u, "");
}

function buildApplySql() {
  const parts = [
    "-- GhostNest Nanika PostgreSQL/Supabase all-in-one setup.",
    "-- Generated from schema.sql, data-api-functions.sql, seed-demo-rine.sql, seed-current-generated.sql, and policies.supabase.sql.",
    "",
    "-- Source: docs/nanika-postgres/schema.sql",
    stripTrailingNewlines(fs.readFileSync(path.join(postgresDir, "schema.sql"), "utf8")),
    "",
    "-- Source: docs/nanika-postgres/data-api-functions.sql",
    stripTrailingNewlines(fs.readFileSync(path.join(postgresDir, "data-api-functions.sql"), "utf8")),
    "",
    "-- Source: docs/nanika-postgres/seed-demo-rine.sql",
    stripTrailingNewlines(fs.readFileSync(path.join(postgresDir, "seed-demo-rine.sql"), "utf8")),
    "",
    "-- Source: docs/nanika-postgres/seed-current-generated.sql",
    stripTrailingNewlines(fs.readFileSync(path.join(postgresDir, "seed-current-generated.sql"), "utf8")),
    "",
    "-- Source: docs/nanika-postgres/policies.supabase.sql",
    stripTrailingNewlines(fs.readFileSync(path.join(postgresDir, "policies.supabase.sql"), "utf8")),
    "",
  ];
  return `${parts.join("\n")}\n`;
}

fs.mkdirSync(postgresDir, { recursive: true });
fs.writeFileSync(path.join(postgresDir, "seed-current-generated.sql"), buildSeed(), "utf8");
fs.writeFileSync(path.join(postgresDir, "apply-current-generated.sql"), buildApplySql(), "utf8");
