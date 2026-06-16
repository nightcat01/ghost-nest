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

create or replace function public.nanika_upsert_runtime_profile(runtime_profile jsonb)
returns jsonb
language plpgsql
as $$
declare
  runtime_profile_id text := runtime_profile->>'id';
  result jsonb;
begin
  if runtime_profile_id is null or runtime_profile_id = '' then
    raise exception 'invalid_nanika_runtime_profile_id';
  end if;

  if jsonb_typeof(coalesce(runtime_profile->'featureSetIds', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_runtime_profile_feature_sets';
  end if;

  if jsonb_typeof(coalesce(runtime_profile->'mappingIds', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_runtime_profile_mappings';
  end if;

  if jsonb_typeof(coalesce(runtime_profile->'characterProfiles', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_nanika_runtime_profile_characters';
  end if;

  insert into public.nanika_runtime_profiles (
    id,
    name,
    description,
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
    mapping_ids
  )
  values (
    runtime_profile_id,
    nullif(runtime_profile->>'name', ''),
    nullif(runtime_profile->>'description', ''),
    runtime_profile->'match',
    runtime_profile->'initial',
    runtime_profile->'controls',
    runtime_profile->'userPreferences',
    runtime_profile->'preferenceStorage',
    runtime_profile->'speechLayout',
    runtime_profile->'speechBalloonSize',
    runtime_profile->'spriteSize',
    nullif(runtime_profile->>'balloonTheme', ''),
    case
      when runtime_profile ? 'includeDefaultRules' then (runtime_profile->>'includeDefaultRules')::boolean
      else null
    end,
    coalesce(
      array(
        select jsonb_array_elements_text(coalesce(runtime_profile->'featureSetIds', '[]'::jsonb))
      ),
      array[]::text[]
    ),
    coalesce(
      array(
        select jsonb_array_elements_text(coalesce(runtime_profile->'mappingIds', '[]'::jsonb))
      ),
      array[]::text[]
    )
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
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
    enabled = true;

  delete from public.nanika_runtime_profile_characters
  where nanika_runtime_profile_characters.profile_id = runtime_profile_id;

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
  select
    runtime_profile_id,
    character_profile.value->>'characterId',
    character_profile.ordinality::integer - 1,
    character_profile.value->'match',
    character_profile.value->'initial',
    character_profile.value->'controls',
    character_profile.value->'userPreferences',
    character_profile.value->'preferenceStorage',
    character_profile.value->'speechLayout',
    character_profile.value->'speechBalloonSize',
    character_profile.value->'spriteSize',
    nullif(character_profile.value->>'balloonTheme', ''),
    case
      when character_profile.value ? 'includeDefaultRules' then (character_profile.value->>'includeDefaultRules')::boolean
      else null
    end,
    coalesce(
      array(
        select jsonb_array_elements_text(coalesce(character_profile.value->'featureSetIds', '[]'::jsonb))
      ),
      array[]::text[]
    ),
    coalesce(
      array(
        select jsonb_array_elements_text(coalesce(character_profile.value->'mappingIds', '[]'::jsonb))
      ),
      array[]::text[]
    ),
    character_profile.value->'slotBindings'
  from jsonb_array_elements(coalesce(runtime_profile->'characterProfiles', '[]'::jsonb)) with ordinality as character_profile(value, ordinality)
  where character_profile.value->>'characterId' is not null
    and character_profile.value->>'characterId' <> '';

  select profile_json
  into result
  from public.nanika_runtime_profile_definitions
  where id = runtime_profile_id;

  return result;
end;
$$;

create or replace function public.nanika_delete_runtime_profile(profile_id text)
returns text
language plpgsql
as $$
begin
  delete from public.nanika_runtime_profiles
  where id = profile_id;

  return profile_id;
end;
$$;
