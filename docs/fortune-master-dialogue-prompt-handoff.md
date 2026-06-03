# Fortune Master Dialogue Prompt Handoff

## Source

- Source project: Fortune Master
- Source file: `screens/home/HomeSections.tsx`
- Source style files:
  - `app/themes/stella.css`
  - `app/themes/global.css`
- Usage context: main hero character dialogue prompt

## Purpose

Fortune Master already has a simple dialogue prompt before Nanika runtime integration.
This document captures the JS behavior and CSS styling so GhostNest/Nanika can reuse the same prompt feeling as a runtime speech theme or preset.

## Behavior Summary

- The prompt text is derived from the current character and selected service.
- The text is revealed with a typewriter effect.
- When the prompt changes, the visible text resets and starts again.
- A blinking cursor is rendered at the end of the visible text.
- The prompt is an overlay panel placed near the bottom of the hero.

## Current Fortune Master JS

```tsx
const dialogueText = selectedService
  ? `${character.name}: ${selectedService.name}을 선택했군요. 준비가 되었다면 아래 버튼으로 들어가세요.`
  : `${character.name}: 오늘은 어떤 운세를 보고 싶으세요? 메뉴를 고르면 제가 길을 열어드릴게요.`;
const [visibleDialogue, setVisibleDialogue] = useState('');

useEffect(() => {
  setVisibleDialogue('');

  let nextIndex = 0;
  const timer = window.setInterval(() => {
    nextIndex += 1;
    setVisibleDialogue(dialogueText.slice(0, nextIndex));

    if (nextIndex >= dialogueText.length) {
      window.clearInterval(timer);
    }
  }, 32);

  return () => window.clearInterval(timer);
}, [dialogueText]);
```

## Current Fortune Master Markup

```tsx
<div className="theme-dialogue-log absolute bottom-[4.65rem] left-4 right-4 min-h-[74px] rounded-[1rem] px-4 py-3">
  <p className="text-sm font-bold leading-relaxed">
    {visibleDialogue}
    <span className="theme-dialogue-cursor" aria-hidden="true" />
  </p>
</div>
```

## Current Fortune Master CSS

```css
:is(.theme-dialogue-log, .stella-dialogue-log) {
    color: rgba(255, 250, 240, 0.94);
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.025)),
        rgba(9, 8, 23, 0.72);
    border: 1px solid rgba(245, 220, 155, 0.18);
    box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.34),
        0 0 24px rgba(var(--character-accent-rgb), 0.16),
        inset 0 1px 0 rgba(255, 250, 240, 0.08);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
}

:is(.theme-dialogue-cursor, .stella-dialogue-cursor) {
    display: inline-block;
    width: 0.55em;
    height: 1em;
    margin-left: 0.15rem;
    transform: translateY(0.16em);
    border-right: 2px solid var(--stella-gold-strong);
    animation: stella-dialogue-cursor-blink 0.72s steps(1) infinite;
}

@keyframes stella-dialogue-cursor-blink {
    50% {
        opacity: 0;
    }
}

.theme-dialogue-log,
.stella-dialogue-log {
    transition:
        background 420ms ease,
        background-color 420ms ease,
        border-color 420ms ease,
        box-shadow 420ms ease,
        color 420ms ease,
        text-shadow 420ms ease,
        opacity 240ms ease,
        filter 420ms ease;
}
```

## Nanika Adaptation Request

GhostNest can adapt this as one of the following:

- A speech balloon theme, for example `fortune_prompt`
- A runtime speech preset that applies the same visual treatment
- A reusable typewriter speech renderer option
- A `speak_text` action option such as `{ typewriter: true, intervalMs: 32 }`

## Requirements

- Typewriter animation must reset when text changes.
- Timer cleanup must run on unmount or text replacement.
- Cursor should be decorative and hidden from assistive tech.
- The visual style should be themeable through runtime variables instead of Fortune Master-only CSS variables.
- The prompt must stay inside the runtime area and avoid unbounded height growth.
- The theme should not force Nanika onto loading screens.

## Suggested GhostNest Variables

```css
--ghostnest-fortune-prompt-color: rgba(255, 250, 240, 0.94);
--ghostnest-fortune-prompt-bg: rgba(9, 8, 23, 0.72);
--ghostnest-fortune-prompt-border: rgba(245, 220, 155, 0.18);
--ghostnest-fortune-prompt-accent-rgb: 245, 220, 155;
--ghostnest-fortune-prompt-cursor: #f5dc9b;
```

## Related Request

See also:

- `docs/nanika-dialogue-overlay-a2a-request.md`

