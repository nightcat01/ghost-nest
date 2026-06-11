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
