# Nanika Data Adapter Guide

Nanika is not an all-in-one backend, CMS, or database layer. It is a modular character runtime that lets a host project connect its own features and data to one character-facing output.

The host project owns:

- database and DB driver
- authentication and authorization
- API routes
- file/blob/image storage
- business features and service APIs

GhostNest/Nanika owns:

- runtime data contracts
- character output
- action/rule execution
- mapping/profile assembly helpers
- developer tools for composing runtime-ready data

## Adapter Boundary

Runtime and devtools code should not know whether data is stored in files or a database. They should read and write Nanika data through one adapter contract.

```ts
type NanikaDataAdapter = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;

  list<T>(scope: NanikaDataScope, options?: NanikaListOptions): Promise<T[]>;
  getItem<T>(scope: NanikaDataScope, id: string): Promise<T | null>;
  saveItem<T>(scope: NanikaDataScope, id: string, value: T): Promise<void>;
  deleteItem(scope: NanikaDataScope, id: string): Promise<void>;
};
```

The first three methods cover small key-value settings. The scoped methods cover runtime and devtools data collections.

Initial scopes:

```ts
type NanikaDataScope =
  | "characters"
  | "characterAssets"
  | "mappings"
  | "featureSets"
  | "conditions"
  | "runtimeProfiles"
  | "menus"
  | "preferences"
  | "workspace";
```

## File Or DB Decision

Choose file or DB in one server-side resolver. Do not branch inside each devtools screen.

```txt
devtools UI
  -> NanikaDataClient
    -> /api/nanika/data/:scope
      -> resolveNanikaDataAdapter()
        -> file adapter
        -> db adapter
```

The browser-facing devtools UI should call the same client methods in every environment:

```ts
await client.list("mappings");
await client.saveItem("mappings", mapping.id, mapping);
await client.deleteItem("conditions", condition.id);
```

## HTTP Data API

For browser-based devtools, expose one host-owned HTTP contract. The UI should not call file or DB specific routes.

```txt
GET    /api/nanika/data/:scope
GET    /api/nanika/data/:scope/:id
PUT    /api/nanika/data/:scope/:id
DELETE /api/nanika/data/:scope/:id
```

Expected response shapes:

```json
{
  "ok": true,
  "scope": "mappings",
  "items": []
}
```

```json
{
  "ok": true,
  "scope": "mappings",
  "item": {}
}
```

`PUT` receives the item payload as `{ "value": ... }`. The server may also accept the raw object for convenience, but the client should prefer `{ value }`.

During migration, GhostNest devtools can keep legacy `/api/devtools/*` endpoints as a fallback. New host integrations should implement `/api/nanika/data/:scope` and decide file or DB behind that route.

The server decides where the data goes:

```ts
function resolveNanikaDataAdapter(config: NanikaDataConfig): NanikaDataAdapter {
  if (config.source === "db") {
    return createProjectNanikaDbAdapter(config);
  }

  return createFileNanikaDataAdapter(config);
}
```

## DBMS Responsibility

GhostNest does not need to know whether the host uses PostgreSQL, MySQL, SQLite, Supabase, Prisma, or another query layer.

The host project implements its own DB client and wraps it with `NanikaDataAdapter`.

```ts
const db = createDbClient({
  kind: "postgres",
  connectionString: process.env.DATABASE_URL,
});

export const nanikaDataAdapter: NanikaDataAdapter = {
  async list(scope, options) {
    return queryNanikaItems(db, scope, options);
  },
  async getItem(scope, id) {
    return queryNanikaItem(db, scope, id);
  },
  async saveItem(scope, id, value) {
    await upsertNanikaItem(db, scope, id, value);
  },
  async deleteItem(scope, id) {
    await deleteNanikaItem(db, scope, id);
  },
  async get(key) {
    return queryNanikaSetting(db, key);
  },
  async set(key, value) {
    await upsertNanikaSetting(db, key, value);
  },
  async remove(key) {
    await deleteNanikaSetting(db, key);
  },
};
```

`createDbClient`, `queryNanikaItems`, and `upsertNanikaItem` are host project code. GhostNest only requires the adapter shape.

DB credentials, pools, retry policy, and driver-specific setup stay in the host server. Do not pass a database URL, Supabase service role key, or raw pool object to browser runtime code.

```txt
Host env / server code
  -> DB client, pool, or Supabase server client
  -> NanikaDataAdapter
  -> /api/nanika/data/:scope
  -> runtime-ready JSON
```

For local verification, GhostNest includes `dev-nanika-db-adapter.html`. The page sends the entered Supabase REST URL and API key to the local dev server for a one-time view access test. It does not save the credentials. Use it only in a local or access-restricted developer environment.

## PostgreSQL/Supabase Sample

GhostNest includes a Postgres-oriented sample under `docs/nanika-postgres`.

| File | Purpose |
| --- | --- |
| `schema.sql` | Tables, indexes, triggers, and JSON views for Nanika metadata |
| `data-api-functions.sql` | Optional RPC helpers for saving and deleting mappings, feature sets, conditions, and menus |
| `seed-demo-rine.sql` | Minimal host app/Rine demo data |
| `seed-current-generated.sql` | Seed generated from the current local `generated/nanika-mappings.json` and `generated/nanika-feature-sets.json` files |
| `policies.supabase.sql` | Optional Supabase RLS example |
| `apply-current-generated.sql` | All-in-one SQL for Supabase SQL editor or a Postgres migration |
| `data-api-adapter.example.ts` | Example Supabase-backed `NanikaDataAdapter` |

The sample stores metadata and runtime-ready JSON only. It is not a required backend implementation. A host app can use the schema as-is, adapt it to another DBMS, or ignore it and implement the same `NanikaDataAdapter` contract with its own tables.

The important compatibility point is the output shape:

```sql
select mapping_json from public.nanika_mapping_definitions;
select feature_set_json from public.nanika_feature_set_definitions;
select condition_json from public.nanika_condition_definitions;
select menu_json from public.nanika_menu_definitions;
```

Those JSON values should match what `/api/nanika/data/mappings`, `/api/nanika/data/featureSets`, `/api/nanika/data/conditions`, and `/api/nanika/data/menus` return in file mode.

For a copy-paste start, use `docs/nanika-postgres/apply-current-generated.sql`. For host API wiring, adapt `docs/nanika-postgres/data-api-adapter.example.ts` and keep it server-side.

## File Mode And DB Mode

`generated/*.json` is the default file-mode implementation for editor-created data:

```txt
generated/nanika-mappings.json
generated/nanika-feature-sets.json
generated/nanika-conditions.json
generated/nanika-menus.json
```

In DB mode, those files should not be treated as the source of truth. The same scopes should be stored through `NanikaDataAdapter`:

```txt
mappings     -> DB rows/view JSON
featureSets  -> DB rows/view JSON
conditions   -> DB rows/view JSON
menus        -> DB rows/view JSON
```

Local generated files are still useful as seed material, export snapshots, or a local-only devtools fallback. Production hosts such as Vercel should route writes to DB/API storage instead of trying to mutate package or repository files.

## Image Storage

Image binaries do not belong in the Nanika data adapter.

Store images in:

- host public assets
- CDN
- Supabase Storage
- Vercel Blob
- another object storage service

Store only metadata in Nanika data:

```json
{
  "characterId": "miyako",
  "assetKey": "eyes.closed",
  "assetKind": "part",
  "url": "https://example.com/assets/nanika/miyako/eyes_closed.webp",
  "width": 512,
  "height": 128,
  "mimeType": "image/webp",
  "meta": {
    "region": {
      "x": 40.9,
      "y": 51.1,
      "w": 22.3,
      "h": 6.6
    }
  }
}
```

Upload flow:

```txt
1. Upload binary through a host-owned upload API.
2. Host storage returns a public or signed asset URL.
3. Save the URL and metadata through NanikaDataAdapter.
4. Runtime reads URLs from CharacterDefinition or runtime-ready profile data.
```

## Migration Strategy

Do not replace every existing devtools endpoint at once.

Recommended first pass:

1. Add `NanikaDataAdapter` core contract.
2. Add a thin devtools `NanikaDataClient`.
3. Route mappings, feature sets, and conditions through the client first.
4. Keep legacy file-backed `/api/devtools/*` endpoints behind the client during transition.
5. Add a host `/api/nanika/data/:scope` route later for DB-backed operation.
6. Move character, asset, dialogue, and scene tools to the same client gradually.

This keeps local file workflows working while making Vercel/DB-backed operation possible.
