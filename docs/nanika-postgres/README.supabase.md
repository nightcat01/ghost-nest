# GhostNest Nanika PostgreSQL/Supabase Demo Schema

이 폴더는 GhostNest/Nanika 설정을 파일이 아니라 PostgreSQL/Supabase에서 운영하기 위한 예시입니다.

코어 런타임은 DB를 직접 알지 않습니다. DB에서는 캐릭터, asset meta, mapping, feature set, runtime profile을 JSON 형태로 보관하고, 호스트 앱이 읽어서 `createNanikaRuntimeProfileOptions`와 `createGhostRuntimeFromPreset`에 전달합니다.

## Files

| File | Role |
| --- | --- |
| `schema.sql` | Postgres table, index, trigger, runtime JSON view |
| `data-api-functions.sql` | Optional RPC helper functions for `/api/nanika/data/:scope` |
| `seed-demo-rine.sql` | host app + Rine minimal demo data |
| `seed-current-generated.sql` | Current `generated/nanika-*.json` mapping, feature set, runtime profile, condition, and menu seed |
| `policies.supabase.sql` | Optional Supabase RLS policies |
| `apply-current-generated.sql` | All-in-one SQL for schema, helper functions, Rine demo seed, current generated seed, and RLS |
| `data-api-adapter.example.ts` | Supabase-backed `NanikaDataAdapter` example |

## Reset Warning

`schema.sql` and `apply-current-generated.sql` reset Nanika-owned tables with `drop table ... cascade` before recreating them. Use them for initial setup or deliberate reset only. They do not delete image binaries in Supabase Storage, CDN, or host `public` folders.

## Apply Order

Supabase SQL editor 또는 migration에서 아래 순서로 실행합니다.

```sql
-- 1. Base schema
\i docs/nanika-postgres/schema.sql

-- 2. Optional data API helper functions
\i docs/nanika-postgres/data-api-functions.sql

-- 3. Optional seed
\i docs/nanika-postgres/seed-demo-rine.sql

-- 3-b. Optional seed from current local generated files
\i docs/nanika-postgres/seed-current-generated.sql

-- 4. Optional Supabase RLS
\i docs/nanika-postgres/policies.supabase.sql
```

Supabase SQL editor에서는 `\i`를 사용할 수 없으니 파일 내용을 순서대로 붙여넣어 실행하세요.

현재 로컬 `generated` 기준으로 바로 시작하려면 `apply-current-generated.sql` 하나를 Supabase SQL editor에 붙여넣어도 됩니다.

`seed-current-generated.sql`과 `apply-current-generated.sql`은 `generated/nanika-mappings.json`, `generated/nanika-feature-sets.json`, `generated/nanika-runtime-profiles.json`, `generated/nanika-menus.json`, 그리고 존재할 경우 `generated/nanika-conditions.json`을 기준으로 생성됩니다. 로컬 generated 파일을 수정한 뒤 SQL을 다시 만들려면 다음 명령을 실행하세요.

```bash
npm run db:generate-seed
```

`apply-current-generated.sql`은 Rine 기본 common key, asset metadata, slot binding 예시도 함께 넣기 위해 `seed-demo-rine.sql`을 먼저 포함한 뒤 현재 generated seed를 적용합니다.

`dev-nanika-db-adapter.html`의 **DB 초기 세팅 적용** 버튼은 같은 SQL을 사용합니다. 브라우저에서 raw SQL을 직접 실행하지 않으므로, 버튼으로 실제 적용하려면 로컬 dev server에 `GHOSTNEST_DB_SETUP_APPLY_URL`로 host-owned 관리자 SQL 실행 endpoint를 연결하세요. 연결하지 않은 경우 버튼은 안전하게 실패하고 이 SQL 파일을 수동 실행하라는 안내를 보여줍니다.

## Runtime Read Queries

호스트 앱에서는 보통 아래 데이터를 읽으면 됩니다.

```sql
select mapping_json
from public.nanika_mapping_definitions
where enabled = true
order by sort_order, id;
```

```sql
select feature_set_json
from public.nanika_feature_set_definitions
where enabled = true
order by sort_order, id;
```

```sql
select condition_json
from public.nanika_condition_definitions
where enabled = true
order by sort_order, id;
```

```sql
select menu_json
from public.nanika_menu_definitions
where enabled = true
order by sort_order, id;
```

```sql
select profile_json
from public.nanika_runtime_profile_definitions
where enabled = true
  and id = 'demo.home.rine';
```

조회 결과는 각각 다음 런타임 타입에 대응합니다.

| View column | Runtime type |
| --- | --- |
| `mapping_json` | `NanikaMapping` |
| `feature_set_json` | `NanikaFeatureSet` |
| `condition_json` | Nanika condition card data |
| `menu_json` | saved Nanika menu set |
| `profile_json` | `NanikaRuntimeProfile` |

## Supabase JS Example

```ts
const [{ data: mappingRows }, { data: featureSetRows }, { data: conditionRows }, { data: menuRows }, { data: profileRows }] = await Promise.all([
  supabase
    .from("nanika_mapping_definitions")
    .select("mapping_json")
    .eq("enabled", true)
    .order("sort_order")
    .order("id"),
  supabase
    .from("nanika_feature_set_definitions")
    .select("feature_set_json")
    .eq("enabled", true)
    .order("sort_order")
    .order("id"),
  supabase
    .from("nanika_condition_definitions")
    .select("condition_json")
    .eq("enabled", true)
    .order("sort_order")
    .order("id"),
  supabase
    .from("nanika_menu_definitions")
    .select("menu_json")
    .eq("enabled", true)
    .order("sort_order")
    .order("id"),
  supabase
    .from("nanika_runtime_profile_definitions")
    .select("profile_json")
    .eq("enabled", true)
    .eq("id", "demo.home.rine")
    .single(),
]);

const mappings = mappingRows?.map((row) => row.mapping_json) ?? [];
const featureSets = featureSetRows?.map((row) => row.feature_set_json) ?? [];
const conditions = conditionRows?.map((row) => row.condition_json) ?? [];
const menus = menuRows?.map((row) => row.menu_json) ?? [];
const profile = profileRows?.profile_json;
```

이후 기존 런타임 조립 흐름을 그대로 사용합니다.

`conditions`는 devtools의 조건 카드 목록으로 다시 넘길 때 사용합니다. 런타임 rule에 이미 포함된 `mapping.conditions`와는 별개로, 저장 가능한 조건 재료 목록입니다.

`menus`는 메뉴 설정 플러그인의 저장 결과입니다. 런타임에서 메뉴를 열 때는 mapping action의 `menuId`로 이 목록을 조회해 `open_management_menu.items`를 채우거나, 호스트 앱이 메뉴 UI 플러그인에 같은 데이터를 직접 전달할 수 있습니다.

`runtimeProfiles` scope uses `public.nanika_runtime_profile_definitions` for reads and the optional `nanika_upsert_runtime_profile` / `nanika_delete_runtime_profile` RPC helpers for writes. Apply `data-api-functions.sql` again if an older database only has mapping, feature set, condition, and menu RPCs.

```ts
const result = createNanikaRuntimeProfileOptions({
  profile,
  context: { pageId: "home", url: location.pathname },
  mappings,
  featureSets,
  characterId: preset.character.profile.id,
});
```

## Data Boundary

- DB에는 이미지 바이너리를 저장하지 않습니다.
- `nanika_character_assets.url`에는 Supabase Storage, CDN, 또는 호스트 앱 `public` 경로를 저장합니다.
- `nanika_characters.character_json`에는 전체 `CharacterDefinition`을 넣을 수도 있지만, 운영 앱에서 패키지/코드로 캐릭터를 불러오고 DB에는 운영 메타만 둘 수도 있습니다.
- mapping과 feature set은 캐릭터 파일명보다 common key 또는 runtime action id를 기준으로 재사용하는 방향을 권장합니다.
- 파일 모드에서는 `generated/*.json`이 편집 데이터 저장소입니다.
- DB 모드에서는 `generated/*.json`을 만들거나 수정하지 않고, 같은 JSON shape를 DB table/view를 통해 읽고 씁니다.

## Recommended Operations

- 관리자/개발자 저장 API는 서버에서 service role로 실행하세요.
- 클라이언트는 enabled 상태의 설정을 읽는 용도로만 두는 편이 안전합니다.
- runtime preference 저장은 앱마다 사용자 식별 방식이 다르므로 `nanika_runtime_preferences.owner_key` 규칙을 서비스에서 별도로 정하세요.
- 새로운 DBMS가 필요하면 이 SQL을 정답 스키마로 보지 말고, JSON shape와 view 출력 형태를 계약으로 보고 변환하세요.
