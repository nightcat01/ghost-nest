# GhostNest Nanika PostgreSQL/Supabase Demo Schema

이 폴더는 GhostNest/Nanika 설정을 파일이 아니라 PostgreSQL/Supabase에서 운영하기 위한 예시입니다.

코어 런타임은 DB를 직접 알지 않습니다. DB에서는 캐릭터, asset meta, mapping, feature set, runtime profile을 JSON 형태로 보관하고, 호스트 앱이 읽어서 `createNanikaRuntimeProfileOptions`와 `createGhostRuntimeFromPreset`에 전달합니다.

## Files

| File | Role |
| --- | --- |
| `schema.sql` | Postgres table, index, trigger, runtime JSON view |
| `seed-fortune-rine.sql` | Fortune Master + Rine minimal demo data |
| `policies.supabase.sql` | Optional Supabase RLS policies |

## Apply Order

Supabase SQL editor 또는 migration에서 아래 순서로 실행합니다.

```sql
-- 1. Base schema
\i docs/nanika-postgres/schema.sql

-- 2. Optional seed
\i docs/nanika-postgres/seed-fortune-rine.sql

-- 3. Optional Supabase RLS
\i docs/nanika-postgres/policies.supabase.sql
```

Supabase SQL editor에서는 `\i`를 사용할 수 없으니 파일 내용을 순서대로 붙여넣어 실행하세요.

## Runtime Read Queries

호스트 앱에서는 보통 아래 세 종류를 읽으면 됩니다.

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
select profile_json
from public.nanika_runtime_profile_definitions
where enabled = true
  and id = 'fortune.home.rine';
```

조회 결과는 각각 다음 런타임 타입에 대응합니다.

| View column | Runtime type |
| --- | --- |
| `mapping_json` | `NanikaMapping` |
| `feature_set_json` | `NanikaFeatureSet` |
| `profile_json` | `NanikaRuntimeProfile` |

## Supabase JS Example

```ts
const [{ data: mappingRows }, { data: featureSetRows }, { data: profileRows }] = await Promise.all([
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
    .from("nanika_runtime_profile_definitions")
    .select("profile_json")
    .eq("enabled", true)
    .eq("id", "fortune.home.rine")
    .single(),
]);

const mappings = mappingRows?.map((row) => row.mapping_json) ?? [];
const featureSets = featureSetRows?.map((row) => row.feature_set_json) ?? [];
const profile = profileRows?.profile_json;
```

이후 기존 런타임 조립 흐름을 그대로 사용합니다.

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

## Recommended Operations

- 관리자/개발자 저장 API는 서버에서 service role로 실행하세요.
- 클라이언트는 enabled 상태의 설정을 읽는 용도로만 두는 편이 안전합니다.
- runtime preference 저장은 앱마다 사용자 식별 방식이 다르므로 `nanika_runtime_preferences.owner_key` 규칙을 서비스에서 별도로 정하세요.
- 새로운 DBMS가 필요하면 이 SQL을 정답 스키마로 보지 말고, JSON shape와 view 출력 형태를 계약으로 보고 변환하세요.
