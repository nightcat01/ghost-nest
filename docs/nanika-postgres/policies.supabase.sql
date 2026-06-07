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
