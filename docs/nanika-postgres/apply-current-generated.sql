-- GhostNest Nanika PostgreSQL/Supabase all-in-one apply script.
-- Generated from schema.sql, data-api-functions.sql, seed-current-generated.sql, and policies.supabase.sql.
-- Image binaries should live in public storage, CDN, or object storage.

-- Source: docs/nanika-postgres/schema.sql
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

create table if not exists public.nanika_menus (
  id text primary key,
  name text,
  description text,
  audience text not null default 'custom',
  default_display text not null default 'balloon',
  close_on_select boolean,
  draggable boolean,
  items_json jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nanika_menus_id_format
    check (id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),
  constraint nanika_menus_audience_check
    check (audience in ('user', 'developer', 'custom')),
  constraint nanika_menus_display_check
    check (default_display in ('balloon', 'panel')),
  constraint nanika_menus_items_array
    check (jsonb_typeof(items_json) = 'array')
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

create index if not exists nanika_menus_audience_idx
  on public.nanika_menus (audience, enabled);

create index if not exists nanika_menus_items_gin_idx
  on public.nanika_menus using gin (items_json);

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

drop trigger if exists nanika_menus_touch_updated_at on public.nanika_menus;
create trigger nanika_menus_touch_updated_at
before update on public.nanika_menus
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

create or replace view public.nanika_menu_definitions as
select
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'id', id,
    'name', name,
    'description', description,
    'audience', audience,
    'defaultDisplay', default_display,
    'closeOnSelect', close_on_select,
    'draggable', draggable,
    'items', items_json
  )) as menu_json,
  enabled,
  sort_order,
  updated_at
from public.nanika_menus;

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

-- Source: docs/nanika-postgres/data-api-functions.sql
-- GhostNest Nanika PostgreSQL/Supabase data API helper functions.
-- Run docs/nanika-postgres/schema.sql before this file.
-- These functions are optional. They make it easier for a host API route to
-- implement /api/nanika/data/:scope without hand-writing per-table SQL.

create or replace function public.nanika_upsert_mapping(mapping jsonb)
returns jsonb
language plpgsql
as $$
declare
  mapping_id text := mapping->>'id';
  target_json jsonb := mapping->'target';
  result jsonb;
begin
  if mapping_id is null or mapping_id = '' then
    raise exception 'invalid_nanika_mapping_id';
  end if;

  if mapping->>'event' is null or mapping->>'event' = '' then
    raise exception 'invalid_nanika_mapping_event';
  end if;

  if jsonb_typeof(coalesce(mapping->'actions', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_mapping_actions';
  end if;

  insert into public.nanika_mappings (
    id,
    name,
    description,
    target_scope,
    target_id,
    target_label,
    event,
    when_json,
    conditions_json,
    actions_json
  )
  values (
    mapping_id,
    nullif(mapping->>'name', ''),
    nullif(mapping->>'description', ''),
    nullif(target_json->>'scope', ''),
    nullif(target_json->>'id', ''),
    nullif(target_json->>'label', ''),
    mapping->>'event',
    mapping->'when',
    mapping->'conditions',
    coalesce(mapping->'actions', '[]'::jsonb)
  )
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
    enabled = true;

  select mapping_json
  into result
  from public.nanika_mapping_definitions
  where id = mapping_id;

  return result;
end;
$$;

create or replace function public.nanika_delete_mapping(mapping_id text)
returns text
language plpgsql
as $$
begin
  delete from public.nanika_mappings
  where id = mapping_id;

  return mapping_id;
end;
$$;

create or replace function public.nanika_upsert_feature_set(feature_set jsonb)
returns jsonb
language plpgsql
as $$
declare
  feature_set_id text := feature_set->>'id';
  result jsonb;
begin
  if feature_set_id is null or feature_set_id = '' then
    raise exception 'invalid_nanika_feature_set_id';
  end if;

  if jsonb_typeof(coalesce(feature_set->'mappingIds', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_feature_set_mappings';
  end if;

  insert into public.nanika_feature_sets (
    id,
    name,
    description,
    mode,
    source_character_id,
    requirements_json,
    mapping_ids
  )
  values (
    feature_set_id,
    nullif(feature_set->>'name', ''),
    nullif(feature_set->>'description', ''),
    coalesce(nullif(feature_set->>'mode', ''), 'character-template'),
    nullif(feature_set->>'sourceCharacterId', ''),
    feature_set->'requirements',
    coalesce(
      array(
        select jsonb_array_elements_text(feature_set->'mappingIds')
      ),
      array[]::text[]
    )
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    mode = excluded.mode,
    source_character_id = excluded.source_character_id,
    requirements_json = excluded.requirements_json,
    mapping_ids = excluded.mapping_ids,
    enabled = true;

  select feature_set_json
  into result
  from public.nanika_feature_set_definitions
  where id = feature_set_id;

  return result;
end;
$$;

create or replace function public.nanika_delete_feature_set(feature_set_id text)
returns text
language plpgsql
as $$
begin
  delete from public.nanika_feature_sets
  where id = feature_set_id;

  return feature_set_id;
end;
$$;

create or replace function public.nanika_upsert_condition(condition jsonb)
returns jsonb
language plpgsql
as $$
declare
  condition_id text := condition->>'id';
  result jsonb;
begin
  if condition_id is null or condition_id = '' then
    raise exception 'invalid_nanika_condition_id';
  end if;

  insert into public.nanika_conditions (
    id,
    scope,
    type,
    operator,
    value,
    name,
    description
  )
  values (
    condition_id,
    condition->>'scope',
    condition->>'type',
    coalesce(nullif(condition->>'operator', ''), 'equals'),
    condition->>'value',
    nullif(condition->>'name', ''),
    nullif(condition->>'description', '')
  )
  on conflict (id) do update set
    scope = excluded.scope,
    type = excluded.type,
    operator = excluded.operator,
    value = excluded.value,
    name = excluded.name,
    description = excluded.description,
    enabled = true;

  select condition_json
  into result
  from public.nanika_condition_definitions
  where id = condition_id;

  return result;
end;
$$;

create or replace function public.nanika_delete_condition(condition_id text)
returns text
language plpgsql
as $$
begin
  delete from public.nanika_conditions
  where id = condition_id;

  return condition_id;
end;
$$;

create or replace function public.nanika_upsert_menu(menu jsonb)
returns jsonb
language plpgsql
as $$
declare
  menu_id text := menu->>'id';
  result jsonb;
begin
  if menu_id is null or menu_id = '' then
    raise exception 'invalid_nanika_menu_id';
  end if;

  if jsonb_typeof(coalesce(menu->'items', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_menu_items';
  end if;

  insert into public.nanika_menus (
    id,
    name,
    description,
    audience,
    default_display,
    close_on_select,
    draggable,
    items_json
  )
  values (
    menu_id,
    nullif(menu->>'name', ''),
    nullif(menu->>'description', ''),
    coalesce(nullif(menu->>'audience', ''), 'custom'),
    coalesce(nullif(menu->>'defaultDisplay', ''), 'balloon'),
    case
      when menu ? 'closeOnSelect' then (menu->>'closeOnSelect')::boolean
      else null
    end,
    case
      when menu ? 'draggable' then (menu->>'draggable')::boolean
      else null
    end,
    coalesce(menu->'items', '[]'::jsonb)
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    audience = excluded.audience,
    default_display = excluded.default_display,
    close_on_select = excluded.close_on_select,
    draggable = excluded.draggable,
    items_json = excluded.items_json,
    enabled = true;

  select menu_json
  into result
  from public.nanika_menu_definitions
  where id = menu_id;

  return result;
end;
$$;

create or replace function public.nanika_delete_menu(menu_id text)
returns text
language plpgsql
as $$
begin
  delete from public.nanika_menus
  where id = menu_id;

  return menu_id;
end;
$$;

-- Source: docs/nanika-postgres/seed-current-generated.sql
-- Current GhostNest generated Nanika mapping seed.
-- Source files:
-- - generated/nanika-mappings.json
-- - generated/nanika-feature-sets.json
--
-- Run docs/nanika-postgres/schema.sql first.
-- This seed stores runtime-ready JSON metadata only. It does not store image binaries.

begin;

insert into public.nanika_mappings (
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
  (
    'rine.runtime.ready',
    'Rine 시작 인사',
    null,
    'runtime',
    'ghost-nest.demo.nanika',
    '런타임: GhostNest Demo Nanika',
    'runtime:ready',
    null,
    null,
    '[{"type":"speak","category":"onMount"},{"type":"log","label":"runtime:ready"}]'::jsonb,
    10
  ),
  (
    'rine.character.click',
    'Rine 캐릭터 클릭 대화',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:click',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"speak","category":"onClick"},{"type":"log","label":"character:click"}]'::jsonb,
    20
  ),
  (
    'rine.character.double-click',
    'Rine 더블 클릭 반응',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:double_click',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak_text","text":"앗, 거기는 왜 자꾸 누르시나요?"},{"type":"log","label":"character:double_click"}]'::jsonb,
    30
  ),
  (
    'rine.character.touch.head',
    'Rine 머리 터치',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:touch',
    '{"part":"head"}'::jsonb,
    null,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"happy"},{"type":"set_touched_part","part":"head"},{"type":"speak","category":"onTouchHead"},{"type":"log","label":"character:touch.head"}]'::jsonb,
    40
  ),
  (
    'rine.character.touch.face',
    'Rine 얼굴 터치',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:touch',
    '{"part":"face"}'::jsonb,
    null,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"surprised"},{"type":"set_touched_part","part":"face"},{"type":"speak","category":"onTouchFace"},{"type":"log","label":"character:touch.face"}]'::jsonb,
    50
  ),
  (
    'rine.character.touch.body',
    'Rine 몸 터치',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:touch',
    '{"part":"body"}'::jsonb,
    null,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking"},{"type":"set_touched_part","part":"body"},{"type":"speak","category":"onTouchBody"},{"type":"log","label":"character:touch.body"}]'::jsonb,
    60
  ),
  (
    'rine.character.idle',
    'Rine 대기 반응',
    null,
    'character',
    'rine',
    '캐릭터: 리네',
    'character:idle',
    null,
    null,
    '[{"type":"change_expression","expression":"neutral","clearTouchedPart":true},{"type":"speak","category":"onIdle"},{"type":"log","label":"character:idle"}]'::jsonb,
    70
  ),
  (
    'rine.character.random-prompt',
    'Rine 랜덤 발화',
    null,
    'speech',
    'speech',
    '대사 / 말풍선',
    'character:randomPrompt',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"mark_prompted"},{"type":"change_expression","expression":"happy","clearTouchedPart":true},{"type":"speak","category":"onRandomPrompt"},{"type":"log","label":"character:randomPrompt"}]'::jsonb,
    80
  ),
  (
    'rine.area.hover.runtime-title',
    'Rine 제목 영역 hover',
    null,
    'ui',
    'ui',
    'UI / 메뉴',
    'area:hover',
    '{"area":"runtimeTitle"}'::jsonb,
    '[{"type":"cooldown","key":"area:hover:runtimeTitle","duration":5000}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverRuntimeTitle"},{"type":"log","label":"area:hover.runtimeTitle"}]'::jsonb,
    90
  ),
  (
    'rine.area.hover.event-log',
    'Rine 이벤트 로그 hover',
    null,
    'ui',
    'ui',
    'UI / 메뉴',
    'area:hover',
    '{"area":"eventLog"}'::jsonb,
    '[{"type":"cooldown","key":"area:hover:eventLog","duration":5000}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverEventLog"},{"type":"log","label":"area:hover.eventLog"}]'::jsonb,
    100
  ),
  (
    'rine.area.hover.command-menu',
    'Rine 명령 메뉴 hover',
    null,
    'ui',
    'ui',
    'UI / 메뉴',
    'area:hover',
    '{"area":"commandMenu"}'::jsonb,
    '[{"type":"cooldown","key":"area:hover:commandMenu","duration":5000}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverCommandMenu"},{"type":"log","label":"area:hover.commandMenu"}]'::jsonb,
    110
  ),
  (
    'rine.command.hover.sample_result',
    'Rine 확장 기능 버튼 hover',
    null,
    'plugin',
    'sample_result',
    '기능: 샘플 결과',
    'command:hover',
    '{"command":"sample_result"}'::jsonb,
    '[{"type":"feature_enabled","feature":"commandHoverDescription"}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverExtensionCommand"},{"type":"log","label":"command:hover.sample_result"}]'::jsonb,
    120
  ),
  (
    'rine.command.hover.line',
    'Rine 한마디 버튼 hover',
    null,
    'speech',
    'speech',
    '대사 / 말풍선',
    'command:hover',
    '{"command":"line"}'::jsonb,
    '[{"type":"feature_enabled","feature":"commandHoverDescription"}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverLineCommand"},{"type":"log","label":"command:hover.line"}]'::jsonb,
    130
  ),
  (
    'rine.command.hover.hide',
    'Rine 숨김 버튼 hover',
    null,
    'ui',
    'ui',
    'UI / 메뉴',
    'command:hover',
    '{"command":"hide"}'::jsonb,
    '[{"type":"feature_enabled","feature":"commandHoverDescription"}]'::jsonb,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak","category":"onHoverHideCommand"},{"type":"log","label":"command:hover.hide"}]'::jsonb,
    140
  ),
  (
    'rine.command.line',
    'Rine 한마디 실행',
    null,
    'speech',
    'speech',
    '대사 / 말풍선',
    'command:line',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"speak","category":"onLine"},{"type":"log","label":"command:line"}]'::jsonb,
    150
  ),
  (
    'rine.command.sample_result',
    'Rine 샘플 결과 플러그인 실행',
    null,
    'plugin',
    'sample_result',
    '기능: 샘플 결과',
    'command:sample_result',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"call_plugin","pluginId":"sample_result"},{"type":"log","label":"plugin:sample_result.execute"}]'::jsonb,
    160
  ),
  (
    'rine.character.right-click.menu',
    'Rine 관리 메뉴 열기',
    null,
    'ui',
    'ui',
    'UI / 메뉴',
    'character:right_click',
    null,
    null,
    '[{"type":"touch_interaction"},{"type":"change_expression","expression":"thinking","clearTouchedPart":true},{"type":"speak_text","text":"관리 메뉴를 열었어요. 필요한 동작을 골라주세요."},{"type":"open_management_menu","title":"관리 메뉴","items":[]},{"type":"log","label":"character:right_click.management_menu"}]'::jsonb,
    170
  ),
  (
    'new.mapping',
    'Draft mapping',
    null,
    'character',
    'miyako',
    '캐릭터: miyako',
    'runtime:ready',
    null,
    null,
    '[{"type":"speak","category":"onMount"}]'::jsonb,
    180
  ),
  (
    'character.character:click',
    'character 캐릭터 클릭 연결',
    null,
    'character',
    'character',
    '캐릭터: character',
    'character:click',
    null,
    null,
    '[{"type":"speak","category":"onClick"}]'::jsonb,
    190
  ),
  (
    'character.character:right_click',
    'character 캐릭터 우클릭 연결',
    null,
    'character',
    'character',
    '캐릭터: character',
    'character:right_click',
    null,
    null,
    '[{"type":"open_management_menu","menuId":"demo.default","title":"기본 관리 메뉴","items":[{"id":"say-line","label":"한마디","description":"리네가 짧은 대사를 하나 말해요.","actions":[{"type":"speak","category":"onLine"},{"type":"log","label":"management.say_line"}]},{"id":"script-demo","label":"연출/선택지 테스트","description":"대기, 줄바꿈, 선택지를 포함한 JSON 대사 연출 예시예요.","actions":[{"type":"speak_script","text":"잠깐만요. 이런 식으로 선택지도 띄울 수 있어요.","script":[{"type":"surface","id":"0"},{"type":"text","value":"잠깐만요."},{"type":"wait","ms":450},{"type":"newline"},{"type":"surface","id":"0"},{"type":"text","value":"이런 식으로 선택지를 띄울 수도 있어요."},{"type":"wait","ms":250},{"type":"choice","choices":[{"label":"점프해봐","actions":[{"type":"play_animation","animation":"jump","duration":460},{"type":"speak_text","text":"좋아요, 가볍게 뛰어볼게요!"}]},{"label":"괜찮아","actions":[{"type":"speak_text","text":"알겠어요. 그럼 계속 곁에 있을게요."}]}]}]},{"type":"log","label":"management.script_demo"}]},{"id":"draw-sample-result","label":"샘플 결과 실행","description":"외부 기능 결과를 받아 말풍선과 표정으로 보여주는 예시예요.","actions":[{"type":"call_plugin","pluginId":"sample_result"},{"type":"log","label":"management.draw_sample_result"}]},{"id":"weather","label":"날씨","description":"날씨 기능을 호출해서 결과를 캐릭터가 설명해요.","actions":[{"type":"call_plugin","pluginId":"weather"},{"type":"log","label":"management.weather"}]},{"id":"minigame","label":"가위바위보","description":"메뉴 depth 안에서 미니게임 선택지를 보여주는 예시예요.","children":[{"id":"minigame-scissors","label":"가위","actions":[{"type":"call_plugin","pluginId":"minigame_가위"},{"type":"log","label":"management.minigame.scissors"}]},{"id":"minigame-rock","label":"바위","actions":[{"type":"call_plugin","pluginId":"minigame_바위"},{"type":"log","label":"management.minigame.rock"}]},{"id":"minigame-paper","label":"보","actions":[{"type":"call_plugin","pluginId":"minigame_보"},{"type":"log","label":"management.minigame.paper"}]}]},{"id":"timer-3m","label":"3분 타이머","description":"3분 뒤 알림과 대사를 실행하는 타이머 예시예요.","actions":[{"type":"call_plugin","pluginId":"timer"},{"type":"start_timer","timer":"cup_ramen","duration":180000,"actions":[{"type":"show_notification","title":"타이머 완료","message":"3분이 지났어요!"},{"type":"play_animation","animation":"jump","duration":500},{"type":"speak_text","text":"3분이 지났어요! 얼른 확인해보세요."}]},{"type":"log","label":"management.start_timer"}]},{"id":"balloon-theme","label":"말풍선 테마","description":"말풍선 분위기를 바꿔요. 선택한 값은 새로고침 후에도 유지돼요.","children":[{"id":"balloon-default","label":"기본","actions":[{"type":"change_balloon","theme":"default"},{"type":"speak_text","text":"말풍선을 기본 분위기로 돌려놓았어요."},{"type":"log","label":"management.balloon.default"}]},{"id":"balloon-soft","label":"soft","actions":[{"type":"change_balloon","theme":"soft"},{"type":"speak_text","text":"말풍선 분위기를 조금 부드럽게 바꿨어요."},{"type":"log","label":"management.balloon.soft"}]},{"id":"balloon-dark-magic","label":"dark magic","actions":[{"type":"change_balloon","theme":"dark_magic"},{"type":"speak_text","text":"조금 더 마법서 같은 분위기로 바꿨어요."},{"type":"log","label":"management.balloon.dark_magic"}]},{"id":"balloon-prompt-overlay","label":"prompt overlay","actions":[{"type":"change_balloon","theme":"prompt_overlay"},{"type":"speak_text","text":"호스트 앱 화면에 맞춘 반투명 프롬프트 분위기로 바꿨어요."},{"type":"log","label":"management.balloon.prompt_overlay"}]}]},{"id":"balloon-font-size","label":"글꼴 크기","description":"말풍선 글자 크기를 바꿔요.","children":[{"id":"balloon-font-size-small","label":"작게","actions":[{"type":"change_balloon_font_size","size":"small"},{"type":"speak_text","text":"글씨를 조금 작게 만들었어요."},{"type":"log","label":"management.balloon_font_size.small"}]},{"id":"balloon-font-size-default","label":"기본","actions":[{"type":"change_balloon_font_size","size":"default"},{"type":"speak_text","text":"원래 글씨 크기로 돌아왔어요."},{"type":"log","label":"management.balloon_font_size.default"}]},{"id":"balloon-font-size-large","label":"크게","actions":[{"type":"change_balloon_font_size","size":"large"},{"type":"speak_text","text":"글씨를 조금 크게 만들었어요."},{"type":"log","label":"management.balloon_font_size.large"}]}]},{"id":"speech-layout","label":"대사창 배치","description":"캐릭터 대사를 기존 말풍선처럼 띄울지, 게임식 대사창으로 띄울지 고를 수 있어요.","children":[{"id":"speech-layout-floating","label":"기본 말풍선","actions":[{"type":"change_speech_layout","mode":"floating","placement":"below-character"},{"type":"speak_text","text":"대사를 기존 말풍선 방식으로 보여줄게요."},{"type":"log","label":"management.speech_layout.floating"}]},{"id":"speech-layout-dialogue-below","label":"하단 대사창","actions":[{"type":"change_speech_layout","mode":"dialogue-box","placement":"below-character"},{"type":"speak_text","text":"대사를 캐릭터 아래의 대사창으로 보여줄게요."},{"type":"log","label":"management.speech_layout.dialogue_below"}]},{"id":"speech-layout-dialogue-overlay","label":"겹치는 대사창","actions":[{"type":"change_speech_layout","mode":"dialogue-box","placement":"overlay-bottom"},{"type":"speak_text","text":"대사창을 캐릭터 아래쪽에 살짝 겹쳐서 보여줄게요."},{"type":"log","label":"management.speech_layout.dialogue_overlay"}]}]},{"id":"speech-size","label":"대사창 크기","description":"런타임 실행 영역 기준으로 말풍선과 대사창 크기 제한을 테스트해요.","children":[{"id":"speech-size-default","label":"기본","actions":[{"type":"set_speech_balloon_size","reset":true},{"type":"speak_text","text":"대사창 크기를 런타임 영역 기준 기본값으로 돌렸어요."},{"type":"log","label":"management.speech_size.default"}]},{"id":"speech-size-compact","label":"좁게","actions":[{"type":"set_speech_balloon_size","size":{"stageWidth":"min(320px, calc(var(--runtime-area-width, 320px) - 48px))","maxWidth":"100%","maxHeight":"160px","dialogueWidth":"min(100%, calc(var(--runtime-area-width, 420px) - 48px))","dialogueMaxWidth":"420px","dialogueHeight":"150px","dialogueMaxHeight":"180px","actionMenuMaxHeight":"96px"}},{"type":"speak_text","text":"긴 대사와 많은 메뉴가 들어와도 대사창은 런타임 실행 영역 안에서만 움직여야 해요.\n캐릭터가 위아래로 크게 밀리거나, 화면 밖으로 사라지거나, 말풍선이 끝없이 늘어나면 안 돼요.\n이 문장은 개발자가 overflow, scroll, max-height, width 제한을 한 번에 확인할 수 있도록 일부러 길게 만들었어요."},{"type":"log","label":"management.speech_size.compact"}]},{"id":"speech-size-wide","label":"넓게","actions":[{"type":"set_speech_balloon_size","size":{"stageWidth":"min(560px, calc(var(--runtime-area-width, 560px) - 48px))","maxWidth":"100%","maxHeight":"min(340px, var(--floating-content-max-height, 340px))","dialogueWidth":"min(100%, calc(var(--runtime-area-width, 760px) - 48px))","dialogueMaxWidth":"760px","dialogueHeight":"min(34vh, 300px)","dialogueMaxHeight":"min(38vh, calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 390px) - 72px))"}},{"type":"speak_text","text":"긴 대사와 많은 메뉴가 들어와도 대사창은 런타임 실행 영역 안에서만 움직여야 해요.\n캐릭터가 위아래로 크게 밀리거나, 화면 밖으로 사라지거나, 말풍선이 끝없이 늘어나면 안 돼요.\n이 문장은 개발자가 overflow, scroll, max-height, width 제한을 한 번에 확인할 수 있도록 일부러 길게 만들었어요."},{"type":"log","label":"management.speech_size.wide"}]}]},{"id":"menu-ui","label":"메뉴 UI","description":"메뉴를 말풍선 안에 띄울지, 별도 패널로 띄울지 고를 수 있어요.","children":[{"id":"menu-ui-default-balloon","label":"기본: 말풍선","actions":[{"type":"set_management_menu_display","display":"balloon"},{"type":"speak_text","text":"기본 메뉴를 말풍선 안에서 열도록 바꿨어요."},{"type":"log","label":"management.menu_ui.default.balloon"}]},{"id":"menu-ui-default-panel","label":"기본: 패널","actions":[{"type":"set_management_menu_display","display":"panel"},{"type":"speak_text","text":"기본 메뉴를 별도 패널로 열도록 바꿨어요."},{"type":"log","label":"management.menu_ui.default.panel"}]},{"id":"menu-ui-system-balloon","label":"시스템: 말풍선","actions":[{"type":"set_management_menu_display","menuId":"system-tools","display":"balloon"},{"type":"speak_text","text":"시스템 도구 메뉴를 말풍선 방식으로 바꿨어요."},{"type":"log","label":"management.menu_ui.system.balloon"}]},{"id":"menu-ui-system-panel","label":"시스템: 패널","actions":[{"type":"set_management_menu_display","menuId":"system-tools","display":"panel"},{"type":"speak_text","text":"시스템 도구 메뉴를 패널 방식으로 바꿨어요."},{"type":"log","label":"management.menu_ui.system.panel"}]},{"id":"menu-ui-reset","label":"UI 초기화","actions":[{"type":"reset_runtime_ui"},{"type":"speak_text","text":"메뉴와 말풍선 설정을 기본값으로 돌려둘게요."},{"type":"log","label":"management.menu_ui.reset"}]}]},{"id":"jump","label":"점프","description":"캐릭터 sprite 애니메이션을 실행해요.","actions":[{"type":"play_animation","animation":"jump","duration":460},{"type":"speak_text","text":"가볍게 뛰어볼게요."},{"type":"log","label":"management.animation.jump"}]},{"id":"asset-test","label":"에셋 테스트","description":"현재 캐릭터에 등록된 assets 정보가 있는지 확인해요.","actions":[{"type":"log","label":"management.asset_test.empty"}]},{"id":"change-character","label":"캐릭터 변경","description":"호스트 앱에 캐릭터 교체 요청을 보냅니다. 앱은 이 이벤트를 받아 런타임을 다시 생성할 수 있어요.","actions":[{"type":"request_character_change","reason":"management_menu"},{"type":"speak_text","text":"캐릭터 변경 요청을 보냈어요."},{"type":"log","label":"management.character_change.request"}]},{"id":"hide","label":"숨기기","description":"캐릭터를 잠시 숨기고 배지로 다시 부를 수 있어요.","actions":[{"type":"toggle_hidden"},{"type":"speak","category":"onHide"},{"type":"log","label":"management.hide"}]},{"id":"close","label":"나가기","description":"열려 있는 메뉴를 닫아요.","actions":[{"type":"close_management_menu"},{"type":"change_expression","expression":"neutral"},{"type":"speak_text","text":"메뉴를 닫을게요."},{"type":"log","label":"management.close"}]}]}]'::jsonb,
    200
  )
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

insert into public.nanika_feature_sets (
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
  (
    'rine.full-runtime',
    'Rine 전체 런타임 세트',
    null,
    'character-specific',
    'rine',
    '[]'::jsonb,
    array['rine.runtime.ready'::text, 'rine.character.click'::text, 'rine.character.double-click'::text, 'rine.character.touch.head'::text, 'rine.character.touch.face'::text, 'rine.character.touch.body'::text, 'rine.character.idle'::text, 'rine.character.random-prompt'::text, 'rine.area.hover.runtime-title'::text, 'rine.area.hover.event-log'::text, 'rine.area.hover.command-menu'::text, 'rine.command.hover.sample_result'::text, 'rine.command.hover.line'::text, 'rine.command.hover.hide'::text, 'rine.command.line'::text, 'rine.command.sample_result'::text, 'rine.character.right-click.menu'::text],
    10
  ),
  (
    'generic.character.full-runtime',
    '캐릭터 미지정 기본 런타임 템플릿',
    'Rine 전체 런타임 세트를 기반으로 한 캐릭터 미지정 템플릿입니다. 실제 캐릭터를 지정하면 필요한 재료 호환성을 확인합니다.',
    'character-template',
    'rine',
    '[{"kind":"expression","id":"neutral","label":"기본 표정","required":true},{"kind":"expression","id":"happy","label":"기쁜 표정","required":true},{"kind":"expression","id":"thinking","label":"생각하는 표정","required":true},{"kind":"expression","id":"surprised","label":"놀란 표정","required":true},{"kind":"dialogue","id":"onMount","label":"시작 대사","required":true},{"kind":"dialogue","id":"onClick","label":"클릭 대사","required":true},{"kind":"dialogue","id":"onIdle","label":"대기 대사","required":true},{"kind":"dialogue","id":"onRandomPrompt","label":"랜덤 발화 대사","required":true},{"kind":"hitArea","id":"head","label":"머리 터치 영역","required":false},{"kind":"hitArea","id":"face","label":"얼굴 터치 영역","required":false},{"kind":"hitArea","id":"body","label":"몸 터치 영역","required":false}]'::jsonb,
    array['rine.runtime.ready'::text, 'rine.character.click'::text, 'rine.character.double-click'::text, 'rine.character.touch.head'::text, 'rine.character.touch.face'::text, 'rine.character.touch.body'::text, 'rine.character.idle'::text, 'rine.character.random-prompt'::text, 'rine.area.hover.runtime-title'::text, 'rine.area.hover.event-log'::text, 'rine.area.hover.command-menu'::text, 'rine.command.hover.sample_result'::text, 'rine.command.hover.line'::text, 'rine.command.hover.hide'::text, 'rine.command.line'::text, 'rine.command.sample_result'::text, 'rine.character.right-click.menu'::text],
    20
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  mode = excluded.mode,
  source_character_id = excluded.source_character_id,
  requirements_json = excluded.requirements_json,
  mapping_ids = excluded.mapping_ids,
  sort_order = excluded.sort_order,
  enabled = true;

insert into public.nanika_menus (
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
  (
    'demo.default',
    '기본 관리 메뉴',
    'DB 모드에서 바로 확인할 수 있는 최소 관리 메뉴입니다.',
    'custom',
    'balloon',
    true,
    true,
    '[
      {
        "id": "say-line",
        "label": "한마디",
        "description": "캐릭터가 짧은 대사를 말합니다.",
        "actions": [
          { "type": "speak", "category": "onLine" },
          { "type": "log", "label": "management.say_line" }
        ]
      },
      {
        "id": "close",
        "label": "나가기",
        "description": "열려 있는 메뉴를 닫습니다.",
        "actions": [
          { "type": "close_management_menu" }
        ]
      }
    ]'::jsonb,
    10
  )
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

-- No generated/nanika-conditions.json file exists in this workspace yet.
-- Conditions created in devtools should be inserted into public.nanika_conditions
-- and read through public.nanika_condition_definitions.

commit;

-- Source: docs/nanika-postgres/policies.supabase.sql
-- Optional Supabase RLS policies for GhostNest Nanika tables.
-- Recommended default:
-- - Client apps can read enabled Nanika configuration.
-- - Writes should happen from a trusted server route or Supabase service role.
-- - Runtime preferences are left server-only by default because owner_key design is app-specific.

alter table public.nanika_characters enable row level security;
alter table public.nanika_common_keys enable row level security;
alter table public.nanika_character_assets enable row level security;
alter table public.nanika_character_slot_bindings enable row level security;
alter table public.nanika_mappings enable row level security;
alter table public.nanika_feature_sets enable row level security;
alter table public.nanika_conditions enable row level security;
alter table public.nanika_menus enable row level security;
alter table public.nanika_runtime_profiles enable row level security;
alter table public.nanika_runtime_profile_characters enable row level security;
alter table public.nanika_runtime_preferences enable row level security;

drop policy if exists nanika_characters_read_enabled on public.nanika_characters;
create policy nanika_characters_read_enabled
on public.nanika_characters
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_common_keys_read_all on public.nanika_common_keys;
create policy nanika_common_keys_read_all
on public.nanika_common_keys
for select
to anon, authenticated
using (true);

drop policy if exists nanika_character_assets_read_enabled on public.nanika_character_assets;
create policy nanika_character_assets_read_enabled
on public.nanika_character_assets
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_character_slot_bindings_read_enabled_character on public.nanika_character_slot_bindings;
create policy nanika_character_slot_bindings_read_enabled_character
on public.nanika_character_slot_bindings
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.nanika_characters character
    where character.id = nanika_character_slot_bindings.character_id
      and character.enabled = true
  )
);

drop policy if exists nanika_mappings_read_enabled on public.nanika_mappings;
create policy nanika_mappings_read_enabled
on public.nanika_mappings
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_feature_sets_read_enabled on public.nanika_feature_sets;
create policy nanika_feature_sets_read_enabled
on public.nanika_feature_sets
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_conditions_read_enabled on public.nanika_conditions;
create policy nanika_conditions_read_enabled
on public.nanika_conditions
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_menus_read_enabled on public.nanika_menus;
create policy nanika_menus_read_enabled
on public.nanika_menus
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_runtime_profiles_read_enabled on public.nanika_runtime_profiles;
create policy nanika_runtime_profiles_read_enabled
on public.nanika_runtime_profiles
for select
to anon, authenticated
using (enabled = true);

drop policy if exists nanika_runtime_profile_characters_read_enabled_profile on public.nanika_runtime_profile_characters;
create policy nanika_runtime_profile_characters_read_enabled_profile
on public.nanika_runtime_profile_characters
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.nanika_runtime_profiles profile
    where profile.id = nanika_runtime_profile_characters.profile_id
      and profile.enabled = true
  )
);

-- Service-role requests bypass RLS in Supabase.
-- Keep mutation APIs in your application server and do not expose write policies here unless required.

