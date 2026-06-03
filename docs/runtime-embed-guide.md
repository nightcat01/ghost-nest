# GhostNest Runtime Embed Guide

GhostNest/Nanika is intended to run as a character runtime layer inside a host page. The host application owns routing, page layout, authentication, commerce, and feature UI. Nanika owns character display, speech, idle reactions, scene/surface changes, and mapped responses to host events.

## Integration Roadmap

Use this roadmap when embedding Nanika into a host site such as Fortune Master.

| Step | Goal | Current support |
| --- | --- | --- |
| 1 | Runtime mount boundary | `root` limits selector lookup to a host-owned mount area. |
| 2 | CSS isolation and theme inheritance | Runtime styles are scoped under `.ghostnest-runtime`; host themes can override `--ghostnest-*` variables. |
| 3 | Initial runtime state | `initialScene`, `initialSurface`, `initialExpression`, speech layout, speech size, and sprite size can be passed per page. |
| 4 | Speech layout variants | `runtimeSpeechPresets.floatingCompact` and `runtimeSpeechPresets.dialogueOverlay` cover compact balloons and bottom dialogue overlays. |
| 5 | Host event input API | Host pages can call `runtime.emit("event:name", payload)`. |
| 6 | Feature mapping structure | Mapping catalogs show character, plugins, runtime events, host event examples, actions, and current rules. |
| 7 | Real embed sample | `dev-fortune-embed.html` demonstrates a mobile Fortune Master style host page. |
| 8 | Re-initialization and route movement | The sample calls `destroy()` before recreating runtime state for another page. Browser visual verification is still required before shipping. |
| 9 | Developer settings access | Devtool APIs support localhost/default IP allowlist and context-path handling. |
| 10 | Verification criteria | This guide keeps the embed checklist and visual checks. |

## Embed Boundary

- Provide a dedicated root element for each runtime instance.
- Pass `root` to runtime options so selectors are resolved inside that root only.
- Keep host UI buttons and cards outside Nanika unless they are part of the character UI.
- Send host interactions into Nanika with `runtime.emit(...)`.
- Treat the host page as the layout owner. Nanika should not create runtime nodes outside the mount.
- When a page already has a design system, set theme variables on the mount instead of importing host-global reset styles from Nanika.

```ts
const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#fortuneNanikaRuntime",
  selectors: {
    stage: ".fortune-nanika-stage",
    sprite: ".fortune-nanika-sprite",
    spriteImage: ".fortune-nanika-sprite-image",
    speakerName: ".fortune-nanika-speaker",
    speechText: ".fortune-nanika-text",
    speechBalloon: ".fortune-nanika-speech",
    balloonActionMenu: ".fortune-nanika-actions",
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
runtime.emit("fortune:home:open");
runtime.emit("zodiac:selected", { zodiac: "aries" });
runtime.emit("tarot:card:selected", { cardId: "star" });
```

Map those events to Nanika rules:

```ts
{
  id: "zodiac-selected",
  event: "zodiac:selected",
  actions: [
    { type: "scene", id: "zodiac-room" },
    { type: "surface", id: "zodiac-guide", startIdleLayers: true },
    { type: "speak_text", text: "선택한 별자리에 맞춰 오늘의 흐름을 읽어볼게요." },
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
- `controls.persistence: false` when the host page must ignore developer-tool localStorage settings.

```ts
const pageState = {
  initialScene: "desk-room",
  initialSurface: "8",
};

const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#fortuneNanikaRuntime",
  initialScene: pageState.initialScene,
  initialSurface: pageState.initialSurface,
  controls: {
    persistence: false,
    devtools: false,
    management: false,
    diagnostics: false,
  },
});
```

After creation, use mapped host events for state changes that happen because the user acted.

```ts
runtime.emit("fortune:menu:selected", { menu: "zodiac" });
runtime.emit("fortune:zodiac:selected", { zodiac: "aries" });
```

## Theme And CSS

- Runtime CSS is scoped under `.ghostnest-runtime`.
- The host can override theme variables on the runtime root or mount area.
- Avoid styling host `body`, `button`, `h1`, or global utility classes from Nanika CSS.
- Devtools CSS is scoped to `.asset-lab-shell` and should not be bundled into a host page unless the host intentionally exposes developer screens.
- Demo-only host styles such as `.fortune-nanika-mount` are examples, not runtime requirements.

```css
.fortune-nanika-mount {
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
    root: "#fortuneNanikaRuntime",
    initialScene: pageState.scene,
    initialSurface: pageState.surface,
  });
}
```

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
- Recreating the runtime in the same root updates the status once and does not duplicate character layers.
- Host buttons can emit app events without becoming part of Nanika's internal command menu.
- Theme variables are applied from the mount area and do not require global CSS changes.
