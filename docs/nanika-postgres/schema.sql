-- GhostNest Nanika PostgreSQL/Supabase schema.
-- This schema stores runtime-ready JSON metadata only.
-- Image binaries should live in public storage, CDN, or object storage.

create extension if not exists pgcrypto;

create table if not exists public.nanika_characters (
  id text primary key,
  display_name text not null,
  description text,
  profile_json jsonb not null default '{}'::jsonb,
  character_json jsonb,
  asset_base_url text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_characters_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$')
);

create table if not exists public.nanika_common_keys (
  key text primary key,
  kind text not null,
  label text not null,
  description text,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_common_keys_key_format
    check (key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_common_keys_kind_check
    check (kind in ('expression', 'surface', 'scene', 'layer', 'dialogue', 'hitArea'))
);

create table if not exists public.nanika_character_assets (
  id uuid primary key default gen_random_uuid(),
  character_id text references public.nanika_characters(id) on delete cascade,
  character_scope text generated always as (coalesce(character_id, '__common__')) stored,
  asset_key text not null,
  asset_kind text not null,
  url text not null,
  width integer,
  height integer,
  mime_type text,
  meta jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_character_assets_key_format
    check (asset_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_character_assets_kind_check
    check (asset_kind in ('base', 'part', 'scene', 'layer', 'expression', 'surface', 'common'))
);

create unique index if not exists nanika_character_assets_unique_key
  on public.nanika_character_assets (
    character_scope,
    asset_kind,
    asset_key
  );

create table if not exists public.nanika_character_slot_bindings (
  character_id text not null references public.nanika_characters(id) on delete cascade,
  common_key text not null references public.nanika_common_keys(key) on delete cascade,
  target_id text not null,
  label text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (character_id, common_key)
);

create table if not exists public.nanika_mappings (
  id text primary key,
  name text,
  description text,
  target_scope text,
  target_id text,
  target_label text,
  event text not null,
  when_json jsonb,
  conditions_json jsonb,
  actions_json jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_mappings_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_mappings_actions_array
    check (jsonb_typeof(actions_json) = 'array'),
  constraint nanika_mappings_conditions_array
    check (conditions_json is null or jsonb_typeof(conditions_json) = 'array')
);

create table if not exists public.nanika_feature_sets (
  id text primary key,
  name text,
  description text,
  mode text not null default 'character-template',
  source_character_id text references public.nanika_characters(id) on delete set null,
  requirements_json jsonb,
  mapping_ids text[] not null default array[]::text[],
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_feature_sets_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_feature_sets_mode_check
    check (mode in ('character-specific', 'character-template')),
  constraint nanika_feature_sets_requirements_array
    check (requirements_json is null or jsonb_typeof(requirements_json) = 'array')
);

create table if not exists public.nanika_conditions (
  id text primary key,
  scope text not null,
  type text not null,
  operator text not null,
  value text not null,
  name text,
  description text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_conditions_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_conditions_scope_check
    check (scope in ('runtime', 'character')),
  constraint nanika_conditions_type_check
    check (type in ('url', 'pageId')),
  constraint nanika_conditions_operator_check
    check (operator in ('contains', 'startsWith', 'equals', 'pattern'))
);

create table if not exists public.nanika_runtime_profiles (
  id text primary key,
  name text,
  description text,
  match_json jsonb,
  initial_json jsonb,
  controls_json jsonb,
  user_preferences_json jsonb,
  preference_storage_json jsonb,
  speech_layout_json jsonb,
  speech_balloon_size_json jsonb,
  sprite_size_json jsonb,
  balloon_theme text,
  include_default_rules boolean,
  feature_set_ids text[] not null default array[]::text[],
  mapping_ids text[] not null default array[]::text[],
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_runtime_profiles_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$')
);

create table if not exists public.nanika_runtime_profile_characters (
  profile_id text not null references public.nanika_runtime_profiles(id) on delete cascade,
  character_id text not null references public.nanika_characters(id) on delete cascade,
  sort_order integer not null default 0,
  match_json jsonb,
  initial_json jsonb,
  controls_json jsonb,
  user_preferences_json jsonb,
  preference_storage_json jsonb,
  speech_layout_json jsonb,
  speech_balloon_size_json jsonb,
  sprite_size_json jsonb,
  balloon_theme text,
  include_default_rules boolean,
  feature_set_ids text[] not null default array[]::text[],
  mapping_ids text[] not null default array[]::text[],
  slot_bindings_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, character_id)
);

create table if not exists public.nanika_runtime_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  character_id text references public.nanika_characters(id) on delete cascade,
  preference_key text not null,
  value_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_key, character_id, preference_key)
);

create index if not exists nanika_characters_enabled_idx
  on public.nanika_characters (enabled, id);

create index if not exists nanika_character_assets_character_idx
  on public.nanika_character_assets (character_id, asset_kind, enabled);

create index if not exists nanika_character_assets_meta_gin_idx
  on public.nanika_character_assets using gin (meta);

create index if not exists nanika_mappings_event_idx
  on public.nanika_mappings (event, enabled);

create index if not exists nanika_mappings_actions_gin_idx
  on public.nanika_mappings using gin (actions_json);

create index if not exists nanika_feature_sets_mapping_ids_gin_idx
  on public.nanika_feature_sets using gin (mapping_ids);

create index if not exists nanika_conditions_scope_idx
  on public.nanika_conditions (scope, type, enabled);

create index if not exists nanika_runtime_profiles_enabled_idx
  on public.nanika_runtime_profiles (enabled, sort_order, id);

create index if not exists nanika_runtime_profiles_feature_set_ids_gin_idx
  on public.nanika_runtime_profiles using gin (feature_set_ids);

create index if not exists nanika_runtime_profile_characters_character_idx
  on public.nanika_runtime_profile_characters (character_id, sort_order);

create or replace function public.nanika_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nanika_characters_touch_updated_at on public.nanika_characters;
create trigger nanika_characters_touch_updated_at
before update on public.nanika_characters
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_common_keys_touch_updated_at on public.nanika_common_keys;
create trigger nanika_common_keys_touch_updated_at
before update on public.nanika_common_keys
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_character_assets_touch_updated_at on public.nanika_character_assets;
create trigger nanika_character_assets_touch_updated_at
before update on public.nanika_character_assets
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_character_slot_bindings_touch_updated_at on public.nanika_character_slot_bindings;
create trigger nanika_character_slot_bindings_touch_updated_at
before update on public.nanika_character_slot_bindings
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_mappings_touch_updated_at on public.nanika_mappings;
create trigger nanika_mappings_touch_updated_at
before update on public.nanika_mappings
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_feature_sets_touch_updated_at on public.nanika_feature_sets;
create trigger nanika_feature_sets_touch_updated_at
before update on public.nanika_feature_sets
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_conditions_touch_updated_at on public.nanika_conditions;
create trigger nanika_conditions_touch_updated_at
before update on public.nanika_conditions
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_runtime_profiles_touch_updated_at on public.nanika_runtime_profiles;
create trigger nanika_runtime_profiles_touch_updated_at
before update on public.nanika_runtime_profiles
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_runtime_profile_characters_touch_updated_at on public.nanika_runtime_profile_characters;
create trigger nanika_runtime_profile_characters_touch_updated_at
before update on public.nanika_runtime_profile_characters
for each row execute function public.nanika_touch_updated_at();

drop trigger if exists nanika_runtime_preferences_touch_updated_at on public.nanika_runtime_preferences;
create trigger nanika_runtime_preferences_touch_updated_at
before update on public.nanika_runtime_preferences
for each row execute function public.nanika_touch_updated_at();

create or replace view public.nanika_mapping_definitions as
select
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'id', id,
    'name', name,
    'description', description,
    'target', case
      when target_scope is null and target_id is null and target_label is null then null
      else jsonb_strip_nulls(jsonb_build_object(
        'scope', target_scope,
        'id', target_id,
        'label', target_label
      ))
    end,
    'event', event,
    'when', when_json,
    'conditions', conditions_json,
    'actions', actions_json
  )) as mapping_json,
  enabled,
  sort_order,
  updated_at
from public.nanika_mappings;

create or replace view public.nanika_feature_set_definitions as
select
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'id', id,
    'name', name,
    'description', description,
    'mode', mode,
    'sourceCharacterId', source_character_id,
    'requirements', requirements_json,
    'mappingIds', to_jsonb(mapping_ids)
  )) as feature_set_json,
  enabled,
  sort_order,
  updated_at
from public.nanika_feature_sets;

create or replace view public.nanika_condition_definitions as
select
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'id', id,
    'scope', scope,
    'type', type,
    'operator', operator,
    'value', value,
    'name', name,
    'description', description
  )) as condition_json,
  enabled,
  sort_order,
  updated_at
from public.nanika_conditions;

create or replace view public.nanika_runtime_profile_definitions as
select
  profile.id,
  jsonb_strip_nulls(jsonb_build_object(
    'id', profile.id,
    'name', profile.name,
    'description', profile.description,
    'match', profile.match_json,
    'initial', profile.initial_json,
    'controls', profile.controls_json,
    'userPreferences', profile.user_preferences_json,
    'preferenceStorage', profile.preference_storage_json,
    'speechLayout', profile.speech_layout_json,
    'speechBalloonSize', profile.speech_balloon_size_json,
    'spriteSize', profile.sprite_size_json,
    'balloonTheme', profile.balloon_theme,
    'includeDefaultRules', profile.include_default_rules,
    'featureSetIds', to_jsonb(profile.feature_set_ids),
    'mappingIds', to_jsonb(profile.mapping_ids),
    'characterProfiles', coalesce(character_profiles.character_profiles_json, '[]'::jsonb)
  )) as profile_json,
  profile.enabled,
  profile.sort_order,
  profile.updated_at
from public.nanika_runtime_profiles profile
left join lateral (
  select jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'characterId', character_profile.character_id,
      'match', character_profile.match_json,
      'initial', character_profile.initial_json,
      'controls', character_profile.controls_json,
      'userPreferences', character_profile.user_preferences_json,
      'preferenceStorage', character_profile.preference_storage_json,
      'speechLayout', character_profile.speech_layout_json,
      'speechBalloonSize', character_profile.speech_balloon_size_json,
      'spriteSize', character_profile.sprite_size_json,
      'balloonTheme', character_profile.balloon_theme,
      'includeDefaultRules', character_profile.include_default_rules,
      'featureSetIds', to_jsonb(character_profile.feature_set_ids),
      'mappingIds', to_jsonb(character_profile.mapping_ids),
      'slotBindings', character_profile.slot_bindings_json
    ))
    order by character_profile.sort_order, character_profile.character_id
  ) as character_profiles_json
  from public.nanika_runtime_profile_characters character_profile
  where character_profile.profile_id = profile.id
) character_profiles on true;
