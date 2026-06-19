# GhostNest Runtime Embed Guide

GhostNest/Nanika is intended to run as a character runtime layer inside a host page. The host application owns routing, page layout, authentication, commerce, and feature UI. Nanika owns character display, speech, idle reactions, scene/surface changes, and mapped responses to host events.

## Integration Roadmap

Use this roadmap when embedding Nanika into a host site such as host app.

| Step | Goal | Current support |
| --- | --- | --- |
| 1 | Runtime mount boundary | `root` limits selector lookup to a host-owned mount area. |
| 2 | CSS isolation and theme inheritance | Runtime styles are scoped under `.ghostnest-runtime`; host themes can override `--ghostnest-*` variables. |
| 3 | Initial runtime state | `initialScene`, `initialSurface`, `initialExpression`, speech layout, speech size, and sprite size can be passed per page. |
| 4 | Speech layout variants | `runtimeSpeechPresets.floatingCompact`, `runtimeSpeechPresets.dialogueOverlay`, and `runtimeSpeechPresets.hostEmbed` cover compact balloons, bottom dialogue overlays, and host-page embeds. |
| 5 | Host event input API | Host pages can call `runtime.emit("event:name", payload)`. |
| 6 | Feature mapping structure | Mapping catalogs show character, plugins, runtime events, host event examples, actions, and current rules. |
| 7 | Real embed sample | `dev-runtime-embed.html` demonstrates a constrained host-page embed. |
| 8 | Re-initialization, route movement, and character switching | Use `runtime.emit(...)` for page events, `runtime.setCharacter(...)` for an in-place character switch, and `destroy()` only when the mount or rule/menu contract must be rebuilt. Browser visual verification is still required before shipping. |
| 9 | Developer settings access | Devtool APIs support localhost/default IP allowlist and context-path handling. |
| 10 | Verification criteria | This guide keeps the embed checklist and visual checks. |

## Embed Boundary

- Provide a dedicated root element for each runtime instance.
- Pass `root` to runtime options so selectors are resolved inside that root only.
- Keep host UI buttons and cards outside Nanika unless they are part of the character UI.
- Send host interactions into Nanika with `runtime.emit(...)`.
- Treat the host page as the layout owner. Nanika should not create runtime nodes outside the mount.
- When a page already has a design system, set theme variables on the mount instead of importing host-global reset styles from Nanika.

## Embed CSS Contract

Host apps should treat the Nanika mount as a layout boundary. The host owns the outside box; Nanika owns character, speech, menu, and scene layout inside `.ghostnest-runtime`.

For runtime layout invariants, see `docs/nanika-runtime-layout-contract.md`. In particular, character sprite, character parts, and stage composition layers are one visual group inside `scene-viewport`. Host CSS may size the mount, but it must not make the character and stage composition use different coordinate systems.

Safe host responsibilities:

- Size and position the host wrapper, for example `.embed-nanika-root` or `.new-nanika-stage-root`.
- Set `position`, `z-index`, `visibility`, and route-level overflow on the host wrapper.
- Provide theme tokens and CSS custom properties on the wrapper or stage.
- Set asset container size and page-specific min-height before creating the runtime.
- Hide the wrapper until `ghostnest:ready` or `.character-stage[data-ready="true"]` is observed.

Avoid overriding these runtime-owned layout selectors from host CSS:

- `.ghostnest-runtime.character-stage`
- `.ghostnest-runtime .character-sprite`
- `.ghostnest-runtime .speech-balloon`
- `.ghostnest-runtime .balloon-action-menu`
- `.ghostnest-runtime .scene-layer-root`
- `.ghostnest-runtime .character-sprite-layer`

Avoid overriding these properties on the runtime-owned selectors unless you are intentionally replacing the layout preset:

- `display`, `grid-template-areas`, `grid-area`
- `align-self`, `justify-self`
- `left`, `right`, `top`, `bottom`, `transform`
- `margin-bottom`
- `width`, `height`, `max-height`, `overflow`

Prefer CSS variables and runtime options for custom styling:

```css
.embed-nanika-root {
  --runtime-area-width: 430px;
  --runtime-area-height: 720px;
  --ghostnest-prompt-overlay-border: rgba(245, 220, 155, 0.24);
  --ghostnest-prompt-overlay-bg: rgba(18, 17, 27, 0.54);
}
```

For narrow embeds, start with `runtimeSpeechPresets.hostEmbed`, then adjust `speechBalloonSize` rather than writing host CSS against `.speech-balloon`.

## Runtime Ready State

Every runtime stage starts with `data-ready="false"` and switches to `data-ready="true"` after the initial character/surface/scene render path has been applied. The stage also dispatches a bubbling `ghostnest:ready` event.

```ts
const root = document.querySelector("#nanikaRuntimeEmbed");

root?.addEventListener("ghostnest:ready", () => {
  root.classList.add("is-nanika-ready");
});

createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  hideUntilReady: true,
});
```

When `hideUntilReady: true` is used, Nanika keeps the runtime stage hidden with `visibility: hidden` until it is ready. This prevents a blank character or empty speech box from flashing before the first render.

## Character Placement

For page-level placement, prefer `characterPlacement` over host CSS overrides. It uses a 9-area preset inside the runtime mount:

```ts
createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  characterPlacement: {
    placement: "bottom-center",
    offsetX: 20,
    offsetY: 12,
  },
});
```

The same placement can be changed from a mapping action:

```ts
{
  type: "set_character_placement",
  placement: "bottom-right",
  offsetX: 16,
  offsetY: 20
}
```

Use `move_character` only when a developer explicitly wants pixel coordinates. Use `set_character_placement` for normal user-facing pages because it survives different host widths more predictably.

## GitHub Package Install

GhostNest can be installed directly from GitHub while it is still private or pre-release.

```bash
npm install github:nightcat01/ghost-nest
```

The package builds `dist` during GitHub dependency installation through `prepare`. Host apps can import runtime APIs from the package root.

```ts
import {
  createGhostRuntimeFromPreset,
  nanikaPreset,
} from "ghost-nest";
```

## Asset Directory Init

GhostNest does not create host app folders during `npm install`. If the host wants the recommended public asset structure, run the CLI explicitly from the host app root:

```bash
npx ghost-nest init-assets --root public/assets/nanika
```

This creates directories only. It does not overwrite files or copy character images.

```txt
public/assets/nanika/
  characters/
  common/
    parts/
    scenes/
```

The default root is `public/assets/nanika`, so this shorter command is equivalent:

```bash
npx ghost-nest init-assets
```

If the host uses another static root or a CDN sync folder, pass that path with `--root` and then set `assetBaseUrl` to the browser URL that serves it.

To copy the bundled official demo character assets into that structure, run:

```bash
npx ghost-nest export-demo-assets --character rine --root public/assets/nanika
```

This copies packaged demo files into:

```txt
public/assets/nanika/characters/rine/assets/
```

Existing files are not overwritten by default. Use `--force` only when the host intentionally wants to refresh the demo assets.

## Host Route Ownership

GhostNest does not automatically register pages, routes, or menus inside a consuming app. The host application decides where Nanika appears and which URL serves developer tools.

Use one of these integration shapes:

| Shape | Who owns the URL | When to use |
| --- | --- | --- |
| Runtime library import | Host app | Production pages that render Nanika inside an existing screen. |
| Bundled static devtools | Host app or a separate GhostNest dev server | Internal developer tools, asset setup, mapping setup, or character setup. |
| Framework-specific admin component | Host app | Future React/Next integration where the host route renders exported admin components. |

For a normal product page, import the runtime and mount it into a host-owned element. The host keeps routing, authentication, page layout, and app CSS. Nanika only renders inside the configured runtime root.

For devtools, the HTML files are included in the package, but they are not mounted into the host app automatically. A host app can choose one of these approaches:

1. Run GhostNest's dev server separately while developing.
2. Serve selected devtools HTML/CSS/JS files from a protected host route.
3. Proxy a protected host route to a GhostNest devtools server.
4. Use future exported admin components when a framework-specific integration exists.

Keep public user pages and developer-only devtools routes separate. In production embeds, prefer `controls.devtools: false` and expose settings only through a protected route owned by the host app.

## Host Routing Map

When GhostNest is installed through npm, it does not create any route in the host app. host app, or any other host service, should decide which URL is public runtime UI and which URL is protected developer UI.

Use this split as the default:

| Host URL | Purpose | GhostNest piece to connect | Public? | Notes |
| --- | --- | --- | --- | --- |
| `/` or a product page such as `/sample_result`, `/subpage` | User-facing Nanika runtime | Import `createGhostRuntimeFromPreset` and mount into a host-owned div | Yes | This is just normal app UI. Do not expose devtools controls here. |
| `/assets/nanika/characters/:characterId/assets/...` | Character images | Host static files, CDN, or storage | Yes | Runtime image URLs should resolve here. Copy or publish assets from the character workspace. |
| `/assets/nanika/common/...` | Reusable common parts/scenes | Host static files, CDN, or storage | Yes | Shared props, stage materials, and reusable effects can live here. |
| `/admin/nanika` or `/dev/nanika` | Developer landing page | Host-owned protected page linking to character/mapping tools | No | Put account, role, or IP checks here. |
| `/admin/nanika/character` | Character settings tool | Either proxy GhostNest devtools, serve bundled devtools files, or later render exported admin UI | No | Needs write access to the host's chosen character workspace or DB adapter. |
| `/admin/nanika/mapping` | Mapping editor | Same as above | No | This edits mapping data, not runtime user UI. |
| `/api/nanika/*` | Host-owned data adapter | Optional DB/file adapter for characters, mappings, feature sets, or runtime profiles | No for writes, maybe yes for reads | Do not point browser devtools writes at `node_modules`. |
| `/api/devtools/*` | GhostNest dev server API | Only available when using the GhostNest dev server directly or through a protected proxy | No | If the host serves devtools itself, the host must provide/proxy equivalent APIs. |

The main decision is whether host app wants to use only the runtime or also host the developer tools.

### Runtime-only Route

For normal host app pages, no GhostNest route is needed. The page renders a mount element and imports the runtime.

```tsx
import {
  createGhostRuntimeFromPreset,
  nanikaPreset,
} from "ghost-nest";

createGhostRuntimeFromPreset(nanikaPreset, {
  root: "#nanikaRuntimeEmbed",
  stageMode: "fill",
  sceneLayout: {
    viewportAnchor: "center",
  },
  assetBaseUrl: {
    charactersRootUrl: "/assets/nanika/characters",
    commonAssetBaseUrl: "/assets/nanika/common",
  },
  controls: {
    devtools: false,
  },
});
```

The host page owns the route, for example `/`, `/subpage`, or `/result`. Nanika only owns the DOM inside `#nanikaRuntimeEmbed`.

### Protected Devtools Route

If host app wants to open the character settings or mapping editor inside the app, it should create a protected host route first. That route can then choose one of these patterns:

1. Link to a separate local GhostNest dev server during development, for example `http://127.0.0.1:4173/dev-character.html`.
2. Proxy `/admin/nanika/*` to a GhostNest dev server, keeping the host's admin/IP guard in front.
3. Serve the bundled `dev-*.html`, `styles.css`, and `dist/devtools/*` files from a protected route, and provide matching `/api/devtools/*` write endpoints.
4. Use a future framework-specific admin export when one exists.

The important part is that static HTML alone is not enough for editing. Character settings and mapping screens call APIs such as:

- `/api/devtools/characters`
- `/api/devtools/character-assets`
- `/api/devtools/character-workspace`
- `/api/devtools/save-character-layer`
- `/api/devtools/save-character-scene`
- `/api/devtools/nanika-mappings`
- `/api/devtools/save-nanika-mapping`

If the devtools page is served from host app, those relative API calls go to host app. host app must either proxy them to GhostNest's dev server or implement equivalent server routes. If it does neither, saves will fail or return host-specific errors such as workspace-write restrictions.

### Asset URL Rule

Runtime image paths should point at browser-readable URLs, not source workspace paths. In host app, prefer this shape:

```txt
public/assets/nanika/characters/rine/assets/base/...
public/assets/nanika/characters/rine/assets/parts/...
public/assets/nanika/common/parts/...
public/assets/nanika/common/scenes/...
```

Then configure the runtime preset with `assetBaseUrl`:

```ts
createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  assetBaseUrl: {
    charactersRootUrl: "/assets/nanika/characters",
    commonAssetBaseUrl: "/assets/nanika/common",
  },
});
```

## Stage Composition Contract

GhostNest stores stage compositions under the runtime `scene` data shape, but user-facing tools should call them `무대 조합`.

A stage composition is not a single image. It is a bounded visual coordinate space containing background, character-depth reference, props, foreground, and effect layers. Runtime should render the stage in the same coordinate space instead of letting individual images resize the character or push layout.

Use these conventions:

| Usage | Runtime action | Meaning |
| --- | --- | --- |
| Base stage | `scene` | Replace the active stage composition. Use this for page defaults or major scene changes. |
| Temporary layer | `scene_overlay` | Add or remove a limited overlay on top of the active stage. Use this for weather, foreground, or temporary effects. |

Recommended first limits:

- one active base stage
- up to two simultaneous overlays
- WebP for production assets where possible
- PNG/WebP with alpha for props and foreground parts
- large opaque desk/background images should use low depth unless intentionally covering the character

Deleting or unlinking a stage mapping does not delete the character asset. Delete the actual stage composition from the character settings tool or the host data adapter.

`charactersRootUrl` is the path immediately before the character id. GhostNest will resolve character-owned assets below `/:characterId/assets/...`.

Bundled demo character data may store source-style asset paths such as `./src/characters/rine/assets/base/...`, `src/characters/rine/assets/base/...`, or `/src/characters/rine/assets/base/...`. Host apps do not need to care which source-prefix style was saved. Set the character root and common root once, and GhostNest rewrites those known source prefixes before booting the runtime.

```ts
const runtime = createGhostRuntimeFromPreset(nanikaPreset, {
  root: "#nanikaRuntimeEmbed",
  assetBaseUrl: {
    charactersRootUrl: "/assets/nanika/characters",
    commonAssetBaseUrl: "/assets/nanika/common",
  },
});
```

`charactersRootUrl` points to the folder just before each character id. The older `characterAssetBaseUrl` option is still accepted as a backward-compatible alias.

When the bundled runtime demo is opened through the GhostNest dev server, it also reads the saved character workspace setting from `/api/devtools/character-workspace` and applies the same rewrite internally. In consuming apps, prefer the `assetBaseUrl` runtime preset override. Use the lower-level `createCharacterWithAssetBaseUrl(...)` helper only when you need to rewrite a character definition before passing it to another system.

For host app, a practical first pass is to run `npx ghost-nest export-demo-assets --character rine --root public/assets/nanika`. Later, production characters can provide their own character definitions and use the same key/preset mapping flow.

```ts
const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  selectors: {
    stage: ".embed-nanika-stage",
    sprite: ".embed-nanika-sprite",
    spriteImage: ".embed-nanika-sprite-image",
    speakerName: ".embed-nanika-speaker",
    speechText: ".embed-nanika-text",
    speechBalloon: ".embed-nanika-speech",
    balloonActionMenu: ".embed-nanika-actions",
    menuButtons: "[data-nanika-command]",
    observeAreas: "[data-nanika-observe]",
  },
  initialScene: "home",
  initialSurface: "home-idle",
});
```

## Page Events

Host pages can emit app-specific event names. Use this for page entry, card selection, menu selection, and feature completion.

```ts
runtime.emit("demo:home:open");
runtime.emit("choice:selected", { subpage: "aries" });
runtime.emit("tarot:card:selected", { cardId: "star" });
```

Map those events to Nanika rules:

```ts
{
  id: "choice-selected",
  event: "choice:selected",
  actions: [
    { type: "scene", id: "choice-room" },
    { type: "surface", id: "choice-guide", startIdleLayers: true },
    { type: "speak_text", text: "선택한 선택 항목에 맞춰 오늘의 흐름을 읽어볼게요." },
  ],
}
```

## Page-Specific Startup

Use runtime creation options for values that must be true as soon as Nanika appears on a page.

Good candidates:

- `initialScene` for the page background or stage composition.
- `initialSurface` for the starting character pose/state.
- `initialExpression` for simple image-based characters.
- `speechLayout` and `speechBalloonSize` for page-specific speech placement.
- `sceneLayout.viewportAnchor` for page-specific scene anchoring inside the embed mount. Use `center` for free-floating character scenes, `bottom` for desk or floor based scenes, and `top` only when the scene is intentionally header-anchored.
- `characterPlacement` for 9-area character placement inside the mount.
- `hideUntilReady` when the host should not show empty runtime DOM before Nanika is ready.
- `controls.persistence: false` when the host page must ignore developer-tool localStorage settings.

```ts
const pageState = {
  initialScene: "desk-room",
  initialSurface: "8",
};

const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  initialScene: pageState.initialScene,
  initialSurface: pageState.initialSurface,
  characterPlacement: {
    placement: "bottom-center",
  },
  hideUntilReady: true,
  controls: {
    persistence: false,
    devtools: false,
    managementMenu: false,
    diagnostics: false,
  },
});
```

After creation, use mapped host events for state changes that happen because the user acted.

```ts
runtime.emit("demo:menu:selected", { menu: "subpage" });
runtime.emit("sample_result:choice:selected", { subpage: "aries" });
```

## Runtime Profiles

When one character is reused across multiple host pages, keep page behavior in a runtime profile instead of scattering options across page code.

A runtime profile answers:

- Whether Nanika should run on this page or URL.
- Which character profile should be active.
- Which feature sets or mappings should be loaded.
- Which initial scene, surface, or expression should be shown.
- Which runtime behaviors should be enabled, such as hover, random prompts, management menus, persistence, and character movement.

```ts
import {
  createGhostRuntimeFromPreset,
  createNanikaRuntimeProfileOptionsById,
} from "ghost-nest";

const result = createNanikaRuntimeProfileOptionsById({
  profileId: "demo.home.rine",
  profiles,
  context: { pageId: "home", url: location.pathname },
  featureSets,
  mappings,
  characterId: preset.character.profile.id,
});

const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  selectors,
  ...result.overrides,
});
```

`profiles`, `featureSets`, and `mappings` can come from local files, generated JSON, or a DB-backed host API. GhostNest only needs the resolved JSON arrays.

Use runtime profile conditions for page-level decisions. Use runtime rule conditions only after a profile has already been selected.

Menus can request a runtime profile switch without letting the runtime know how profiles are stored. Add a menu action with `request_profile_change`, then handle the event in the host app.

```ts
root.addEventListener("ghostnest:profile-change-request", (event) => {
  const detail = (event as CustomEvent<{ profileId: string; reason?: string }>).detail;

  // Load detail.profileId from your file or DB-backed profile store,
  // then recreate the runtime with the resolved profile options.
});
```

## Management Menu Presets In Mappings

Mapping files may store a management menu action as a lightweight placeholder, for example `open_management_menu` with `menuId: "demo.default"` and an empty `items` array. Hydrate those placeholders before passing rules into the runtime.

```ts
import {
  createDemoManagementMenuItems,
  createRuntimeRulesFromMappings,
  hydrateDemoManagementMenuRules,
} from "ghost-nest";

const fallbackMenuItems = createDemoManagementMenuItems(character, {
  includeDeveloperTools: false,
});

const rules = hydrateDemoManagementMenuRules(
  createRuntimeRulesFromMappings(mappings),
  fallbackMenuItems,
);

createGhostRuntimeFromPreset(preset, {
  replaceRules: rules,
});
```

Use `demo.default` or no `menuId` for the normal menu, `demo.user` for user-facing menu items, and `demo.developer` for developer-only tools. Host apps can also pass their own fallback menu items when they do not want the demo preset.

## Fixed Panel Menu Slot

Host pages may reserve a fixed area for Nanika menu UI, separate from the character and speech areas. In that case, open the menu through a normal runtime rule instead of creating a second menu system.

```ts
const fixedMenuRule = {
  id: "runtime.fixed-panel-menu",
  event: "runtime:ready",
  actions: [
    {
      type: "open_management_menu",
      menuId: "demo.user",
      title: "사용자 메뉴",
      display: "panel",
      closeOnSelect: false,
      draggable: false,
      items: createDemoManagementMenuItems(character, {
        includeDeveloperTools: false,
      }),
    },
  ],
};
```

`display: "panel"` sends the menu to the configured panel target. `closeOnSelect: false` keeps the menu open after an item runs. `draggable: false` is useful when the host owns the menu slot position and the panel should not move.

For a fixed slot, keep the host CSS focused on the outer menu target:

- Give the target a stable box in the host layout.
- Style menu colors, spacing, and scroll limits through the panel target and menu-specific selectors.
- Do not override character, stage, scene, or speech layout selectors to position the menu.

Recommended menu selectors for host styling:

- `.management-panel-menu`
- `[data-management-menu-display="panel"]`
- `.management-menu-title`
- `.management-menu-body`
- `[data-management-action]`

## Theme And CSS

- Runtime CSS is scoped under `.ghostnest-runtime`.
- The host can override theme variables on the runtime root or mount area.
- Avoid styling host `body`, `button`, `h1`, or global utility classes from Nanika CSS.
- Devtools CSS is scoped to `.asset-lab-shell` and should not be bundled into a host page unless the host intentionally exposes developer screens.
- Demo-only host styles such as `.embed-nanika-mount` are examples, not runtime requirements.

```css
.embed-nanika-mount {
  --ghostnest-accent: #ffe59a;
  --ghostnest-ink: #fff7e4;
  --ghostnest-speech-dialogue-panel: rgba(16, 15, 28, 0.72);
  --ghostnest-speech-dialogue-line: rgba(255, 255, 255, 0.2);
}
```

## Layout Presets

Use `runtimeSpeechPresets` as a starting point and override only the values a host page needs.

```ts
import { runtimeSpeechPresets } from "ghost-nest";

createGhostRuntimeFromPreset(preset, {
  speechLayout: runtimeSpeechPresets.dialogueOverlay.layout,
  speechBalloonSize: {
    ...runtimeSpeechPresets.dialogueOverlay.size,
    dialogueMaxHeight: "min(22vh, 150px)",
  },
});
```

For host-style fixed top embeds, use `hostEmbed`. It keeps the dialogue box compact and anchors it to one side of the runtime stage so lower host content stays visible.

```ts
createGhostRuntimeFromPreset(preset, {
  speechLayout: runtimeSpeechPresets.hostEmbed.layout,
  speechBalloonSize: runtimeSpeechPresets.hostEmbed.size,
});
```

Override `overlayAnchor` when the host page needs the compact overlay on another side.

```ts
createGhostRuntimeFromPreset(preset, {
  speechLayout: {
    ...runtimeSpeechPresets.hostEmbed.layout,
    overlayAnchor: "left",
  },
  speechBalloonSize: runtimeSpeechPresets.hostEmbed.size,
});
```

## Re-initialization

When a host route changes, either emit a page event or destroy and recreate the runtime with a different initial state.

- Prefer `runtime.emit("page:open")` when the mount area stays alive.
- Use `runtime.destroy()` before recreating in the same mount.
- After destroy, timers, listeners, scene layers, and character layers should be removed.
- Recreate the runtime when the page needs a different initial scene/surface before the user sees it.
- Keep exactly one active runtime per mount unless the host intentionally renders multiple characters.

```ts
let runtime: ReturnType<typeof createGhostRuntimeFromPreset> | null = null;

function bootNanika(pageState: { scene: string; surface: string }) {
  runtime?.destroy();
  runtime = createGhostRuntimeFromPreset(preset, {
    root: "#nanikaRuntimeEmbed",
    initialScene: pageState.scene,
    initialSurface: pageState.surface,
  });
}
```

## Runtime Character Switching

Use `runtime.setCharacter(...)` when the host page wants to keep the current runtime instance alive and swap only the active character data.

This is the preferred path for host UI such as:

- A page menu that changes the displayed teller or guide character.
- A route section that keeps the same Nanika mount but uses another character.
- A host-owned character selector that already knows which `CharacterDefinition` should be loaded next.

```ts
const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#nanikaRuntimeEmbed",
  initialScene: "desk-room",
  initialSurface: "idle",
});

const nextCharacter = await loadCharacter("miyako");

await runtime.setCharacter(nextCharacter, {
  initialScene: "desk-room",
  initialSurface: "miyako-idle",
  initialExpression: "neutral",
});
```

`setCharacter` accepts the next `CharacterDefinition` and optional initial values:

| Option | Purpose |
| --- | --- |
| `initialExpression` | Sets the first expression after the switch. If omitted, the character default expression is used. |
| `initialSurface` | Applies a surface immediately after the switch. Use this when each page or character profile has a known starting surface. |
| `initialScene` | Selects the scene/scene set after the switch. Character-owned scenes are merged with host-provided scene options. |
| `scene` | Overrides or extends runtime scene options for this switch. |
| `dialogueEngine` | Replaces the dialogue source for the next character. If omitted, a dialogue engine is created from `nextCharacter.lines`. |
| `resetSpeech` | Defaults to `true`. Set `false` when the host wants to keep the current speech text during the switch. |

After a successful switch, the runtime stage dispatches `ghostnest:character-change`:

```ts
stage.addEventListener("ghostnest:character-change", (event) => {
  console.log(event.detail.characterId);
});
```

The runtime does not dispatch another `ghostnest:ready` event for `setCharacter(...)`. This is intentional: the runtime instance stayed alive.

## Character Change Requests

The demo management menu includes a `Character change` item. Host apps can either handle the request by opening their own selector or call `runtime.setCharacter(...)` directly when the target character is already known. The request event is emitted from the runtime stage:

```ts
stage.addEventListener("ghostnest:character-change-request", (event) => {
  console.log(event.detail);
});
```

The event detail has this shape:

```ts
{
  type: "request_character_change",
  characterId?: string,
  reason?: string,
}
```

The host app owns the actual character decision. In host app, that usually means opening a host-owned character selector, choosing a runtime profile, and then passing the resolved character plus initial values to `runtime.setCharacter(...)`.

```ts
import {
  createGhostRuntimeFromPreset,
  type NanikaRuntimePreset,
} from "ghost-nest";

let runtime: ReturnType<typeof createGhostRuntimeFromPreset> | null = null;

function mountNanika(preset: NanikaRuntimePreset) {
  runtime?.destroy();

  runtime = createGhostRuntimeFromPreset(preset, {
    root: "#nanikaRuntimeEmbed",
    controls: {
      devtools: false,
    },
  });

  const stage = document.querySelector("#nanikaRuntimeEmbed .character-stage");

  stage?.addEventListener("ghostnest:character-change-request", () => {
    openHostCharacterSelector();
  }, { once: false });
}

async function applySelectedCharacter(characterId: string) {
  const nextCharacter = await loadNanikaCharacter(characterId);
  const initial = await loadNanikaInitialState(characterId);

  await runtime?.setCharacter(nextCharacter, {
    initialScene: initial.scene,
    initialSurface: initial.surface,
    initialExpression: initial.expression,
  });
}
```

This separation is intentional. A character switch changes more than the visible image:

- Character profile and speaker name.
- Dialogue lines and script categories.
- Expressions, surfaces, layers, scenes, and hit areas.
- Character-owned scene options and default scene.
- Active surface, layer animations, touched part state, and hide/show state.

Use `destroy()` followed by a fresh `createGhostRuntimeFromPreset(...)` call instead of `setCharacter(...)` when the switch also needs to rebuild runtime-level contracts:

- A different mapping/rule set must be registered.
- The management menu items must be regenerated from scratch.
- Storage scope or preference storage should change.
- The mount element, selectors, root, or host layout contract changes.
- The host wants a clean timer/listener lifecycle rather than an in-place visual switch.

## Developer Tool Access

Character settings and mapping tools are developer-facing surfaces. They should not be exposed as normal user UI in a host service.

The bundled dev server already supports:

- Localhost access by default.
- `devServer.allowedIps` for additional developer machines.
- `devServer.basePath` or `GHOSTNEST_BASE_PATH` for deployments under a context path.
- A `403 devtools_forbidden` JSON response for blocked `/api/devtools/*` calls.

Recommended host behavior:

- Show normal users a fallback character state when Nanika assets or settings are missing.
- Show developers a link to the settings or mapping tool only when the current IP is allowed by the host service.
- Keep devtool routes separate from runtime mount routes.
- Treat the host account system, IP checks, or reverse proxy rules as the outer security boundary.

Example extension config shape:

```json
{
  "extensions": {
    "character-settings": {
      "enabled": true,
      "devServer": {
        "allowLocalhost": true,
        "allowedIps": ["192.168.0.10"],
        "basePath": "/nanika"
      }
    }
  }
}
```

## Verification Checklist

- Runtime selectors resolve only inside `root`.
- No `.ghostnest-runtime`, character sprite, speech balloon, scene layer, or menu node is created outside the mount.
- The host page layout does not shift when speech text changes.
- Long speech text scrolls inside the balloon.
- `destroy()` followed by recreation does not duplicate timers or layers.
- Route-like recreation keeps one runtime root and one stage in the mount.
- Host CSS can override Nanika colors without Nanika overriding the whole page.
- Host buttons keep their own styles unless they are inside `.ghostnest-runtime` or an explicit Nanika mount selector.
- Page-specific events can drive scene, surface, expression, and speech.
- Mobile viewport keeps character and speech inside the mount area.
- Developer tool APIs are blocked for non-allowed IPs.
- Context-path access works for runtime pages and devtool API calls.

## Host Page Visual Checks

Before shipping an embedded Nanika page, verify these cases in an actual browser:

- A short viewport around `360 x 740` keeps the speech balloon, character, main cards, and bottom navigation readable.
- A taller viewport around `448 x 900` does not leave the character floating too far away from the speech balloon.
- Tall embed areas can make a scene feel vertically floating even when the layout is technically correct. The host developer should choose a page-appropriate scene anchor or preset, such as centered character display for free-floating characters and lower anchoring for desk or floor based scenes.
- Recreating the runtime in the same root updates the status once and does not duplicate character layers.
- Host buttons can emit app events without becoming part of Nanika's internal command menu.
- Theme variables are applied from the mount area and do not require global CSS changes.
