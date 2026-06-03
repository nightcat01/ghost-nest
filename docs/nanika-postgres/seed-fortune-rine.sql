-- Minimal Fortune Master / Rine seed data for the GhostNest Nanika PostgreSQL schema.
-- Run docs/nanika-postgres/schema.sql first.
-- Replace asset URLs with your Supabase Storage, CDN, or host public paths.

insert into public.nanika_common_keys (key, kind, label, description, required, sort_order)
values
  ('expression.neutral', 'expression', 'Neutral expression', 'Default calm expression.', true, 10),
  ('expression.happy', 'expression', 'Happy expression', 'Friendly positive expression.', false, 20),
  ('expression.thinking', 'expression', 'Thinking expression', 'Used while guiding or waiting.', false, 30),
  ('expression.surprised', 'expression', 'Surprised expression', 'Used for small reactions.', false, 40),
  ('surface.idle', 'surface', 'Idle surface', 'Default displayed surface.', true, 50),
  ('surface.guide', 'surface', 'Guide surface', 'Guide or pointing state.', false, 60),
  ('surface.talking', 'surface', 'Talking surface', 'Used while speaking.', false, 70),
  ('scene.default', 'scene', 'Default scene', 'Default runtime scene.', false, 80),
  ('scene.desk', 'scene', 'Desk scene', 'Desk or reception stage.', false, 90),
  ('dialogue.guide.welcome', 'dialogue', 'Welcome dialogue', 'First line shown on boot.', true, 100),
  ('dialogue.menu.selected', 'dialogue', 'Menu selected dialogue', 'Shown when a host menu is selected.', false, 110),
  ('dialogue.error.default', 'dialogue', 'Default error dialogue', 'Fallback line for errors.', false, 120),
  ('layer.eyes.blink', 'layer', 'Blink layer', 'Eye blink animation layer.', false, 130),
  ('layer.mouth.talk', 'layer', 'Talking mouth layer', 'Mouth animation while speaking.', false, 140),
  ('layer.fx.emphasis', 'layer', 'Emphasis effect layer', 'Small emotional effect.', false, 150)
on conflict (key) do update set
  kind = excluded.kind,
  label = excluded.label,
  description = excluded.description,
  required = excluded.required,
  sort_order = excluded.sort_order;

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
  'Demo guide character used by GhostNest and Fortune Master examples.',
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

insert into public.nanika_character_assets (character_id, asset_key, asset_kind, url, width, height, mime_type, meta)
values
  ('rine', 'base.default', 'base', '/assets/nanika/rine/base/rine_standing_default.webp', null, null, 'image/webp', '{"commonKey":"surface.idle"}'::jsonb),
  ('rine', 'scene.desk', 'scene', '/assets/nanika/rine/scenes/desk-room.webp', null, null, 'image/webp', '{"commonKey":"scene.desk"}'::jsonb),
  ('rine', 'part.eyes.blink', 'part', '/assets/nanika/rine/parts/eyes-blink.webp', null, null, 'image/webp', '{"commonKey":"layer.eyes.blink"}'::jsonb),
  ('rine', 'part.mouth.talk', 'part', '/assets/nanika/rine/parts/mouth-talk.webp', null, null, 'image/webp', '{"commonKey":"layer.mouth.talk"}'::jsonb)
on conflict (character_scope, asset_kind, asset_key) do update set
  url = excluded.url,
  width = excluded.width,
  height = excluded.height,
  mime_type = excluded.mime_type,
  meta = excluded.meta,
  enabled = true;

insert into public.nanika_character_slot_bindings (character_id, common_key, target_id, label, meta)
values
  ('rine', 'expression.neutral', 'neutral', 'Neutral', '{}'::jsonb),
  ('rine', 'expression.happy', 'happy', 'Happy', '{}'::jsonb),
  ('rine', 'expression.thinking', 'thinking', 'Thinking', '{}'::jsonb),
  ('rine', 'expression.surprised', 'surprised', 'Surprised', '{}'::jsonb),
  ('rine', 'surface.idle', '0', 'Idle', '{}'::jsonb),
  ('rine', 'surface.guide', '8', 'Guide', '{}'::jsonb),
  ('rine', 'surface.talking', '0', 'Talking', '{"layer":"mouth"}'::jsonb),
  ('rine', 'scene.default', 'desk-room', 'Default desk room', '{}'::jsonb),
  ('rine', 'scene.desk', 'desk-room', 'Desk room', '{}'::jsonb),
  ('rine', 'dialogue.guide.welcome', 'welcome', 'Welcome dialogue', '{}'::jsonb),
  ('rine', 'dialogue.menu.selected', 'menu-selected', 'Menu selected dialogue', '{}'::jsonb),
  ('rine', 'dialogue.error.default', 'error-default', 'Default error dialogue', '{}'::jsonb),
  ('rine', 'layer.eyes.blink', 'eyes', 'Blink layer', '{}'::jsonb),
  ('rine', 'layer.mouth.talk', 'mouth', 'Mouth layer', '{}'::jsonb),
  ('rine', 'layer.fx.emphasis', 'fx-emphasis', 'Emphasis FX', '{}'::jsonb)
on conflict (character_id, common_key) do update set
  target_id = excluded.target_id,
  label = excluded.label,
  meta = excluded.meta;

insert into public.nanika_mappings (
  id,
  name,
  description,
  target_scope,
  target_id,
  target_label,
  event,
  actions_json,
  sort_order
)
values
  (
    'fortune-home-open',
    'Fortune home open',
    'Boot line and scene for the Fortune Master home page.',
    'page',
    'home',
    'Fortune home',
    'fortune:home:open',
    '[
      { "type": "change_balloon", "theme": "fortune_prompt" },
      { "type": "speak_text", "text": "Stella: What fortune would you like to see today? Choose a menu and I will guide you." },
      { "type": "scene", "id": "desk-room" }
    ]'::jsonb,
    10
  ),
  (
    'fortune-zodiac-open',
    'Fortune zodiac open',
    'Boot line and scene for the zodiac page.',
    'page',
    'zodiac',
    'Fortune zodiac',
    'fortune:zodiac:open',
    '[
      { "type": "change_balloon", "theme": "fortune_prompt" },
      { "type": "speak_text", "text": "Choose the zodiac sign you want to read, or enter your birthday." },
      { "type": "scene", "id": "desk-room" },
      { "type": "surface", "id": "8", "startIdleLayers": true }
    ]'::jsonb,
    20
  ),
  (
    'fortune-zodiac-selected',
    'Fortune zodiac selected',
    'Reaction after the host app selects a zodiac sign.',
    'host',
    'zodiac:selected',
    'Zodiac selected',
    'zodiac:selected',
    '[
      { "type": "speak_text", "text": "Good. I will read today with that sign in mind." },
      { "type": "surface", "id": "8", "startIdleLayers": true }
    ]'::jsonb,
    30
  ),
  (
    'fortune-menu-selected',
    'Fortune menu selected',
    'Generic reaction after a Fortune Master menu is selected.',
    'host',
    'fortune:menu:selected',
    'Menu selected',
    'fortune:menu:selected',
    '[
      { "type": "speak_text", "text": "I can connect this menu to the host page action." }
    ]'::jsonb,
    40
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  target_scope = excluded.target_scope,
  target_id = excluded.target_id,
  target_label = excluded.target_label,
  event = excluded.event,
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
    'fortune.home',
    'Fortune home basics',
    'Feature set for the Fortune Master home page.',
    'character-template',
    null,
    '[
      { "kind": "scene", "id": "desk-room", "label": "Desk room", "required": false },
      { "kind": "surface", "id": "0", "label": "Idle surface", "required": true }
    ]'::jsonb,
    array['fortune-home-open', 'fortune-menu-selected', 'fortune-zodiac-selected'],
    10
  ),
  (
    'fortune.zodiac',
    'Fortune zodiac basics',
    'Feature set for the Fortune Master zodiac page.',
    'character-template',
    null,
    '[
      { "kind": "scene", "id": "desk-room", "label": "Desk room", "required": false },
      { "kind": "surface", "id": "8", "label": "Guide surface", "required": true }
    ]'::jsonb,
    array['fortune-zodiac-open', 'fortune-menu-selected', 'fortune-zodiac-selected'],
    20
  ),
  (
    'rine.full-runtime',
    'Rine full runtime',
    'Character-specific example set that can be cloned for another character.',
    'character-specific',
    'rine',
    '[
      { "kind": "expression", "id": "neutral", "label": "Neutral", "required": true },
      { "kind": "surface", "id": "0", "label": "Idle surface", "required": true },
      { "kind": "surface", "id": "8", "label": "Guide surface", "required": false },
      { "kind": "scene", "id": "desk-room", "label": "Desk room", "required": false }
    ]'::jsonb,
    array['fortune-home-open', 'fortune-zodiac-open', 'fortune-menu-selected', 'fortune-zodiac-selected'],
    30
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

insert into public.nanika_runtime_profiles (
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
  sort_order
)
values
  (
    'fortune.home.rine',
    'Fortune home / Rine',
    'Runtime profile for the Fortune Master home page.',
    '{ "pageId": "home", "urlPattern": "*" }'::jsonb,
    '{ "scene": "desk-room" }'::jsonb,
    '{
      "devtools": false,
      "diagnostics": false,
      "hitboxEditor": false,
      "debugHitAreas": false,
      "managementMenu": false,
      "commandButtons": false,
      "commandHoverDescription": false,
      "areaHoverDescription": false,
      "randomPrompt": false,
      "persistence": false
    }'::jsonb,
    '{ "runtimeUi": "preset", "managementMenu": "disabled" }'::jsonb,
    '{ "mode": "dialogue-box", "placement": "overlay-bottom", "overlayAnchor": "right" }'::jsonb,
    '{
      "width": "min(92%, 640px)",
      "maxWidth": "640px",
      "dialogueMaxHeight": "min(24vh, 160px)"
    }'::jsonb,
    '{
      "desktopWidth": "250px",
      "desktopHeight": "340px",
      "mobileWidth": "210px",
      "mobileHeight": "286px"
    }'::jsonb,
    'fortune_prompt',
    false,
    array['fortune.home'],
    10
  ),
  (
    'fortune.zodiac.rine',
    'Fortune zodiac / Rine',
    'Runtime profile for the Fortune Master zodiac page.',
    '{ "pageId": "zodiac", "urlPattern": "*" }'::jsonb,
    '{ "scene": "desk-room" }'::jsonb,
    '{
      "devtools": false,
      "diagnostics": false,
      "hitboxEditor": false,
      "debugHitAreas": false,
      "managementMenu": false,
      "commandButtons": false,
      "commandHoverDescription": false,
      "areaHoverDescription": false,
      "randomPrompt": false,
      "persistence": false,
      "floatingLayout": false
    }'::jsonb,
    '{ "runtimeUi": "preset", "managementMenu": "disabled" }'::jsonb,
    '{ "mode": "dialogue-box", "placement": "overlay-bottom", "overlayAnchor": "right" }'::jsonb,
    '{
      "width": "min(92%, 640px)",
      "maxWidth": "640px",
      "dialogueMaxHeight": "min(20vh, 132px)"
    }'::jsonb,
    '{
      "desktopWidth": "250px",
      "desktopHeight": "340px",
      "mobileWidth": "210px",
      "mobileHeight": "286px"
    }'::jsonb,
    'fortune_prompt',
    false,
    array['fortune.zodiac'],
    20
  )
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
  sort_order = excluded.sort_order,
  enabled = true;

insert into public.nanika_runtime_profile_characters (
  profile_id,
  character_id,
  sort_order,
  initial_json,
  feature_set_ids
)
values
  ('fortune.home.rine', 'rine', 10, '{ "surface": "0" }'::jsonb, array[]::text[]),
  ('fortune.zodiac.rine', 'rine', 10, '{ "surface": "8" }'::jsonb, array[]::text[])
on conflict (profile_id, character_id) do update set
  sort_order = excluded.sort_order,
  initial_json = excluded.initial_json,
  feature_set_ids = excluded.feature_set_ids;
