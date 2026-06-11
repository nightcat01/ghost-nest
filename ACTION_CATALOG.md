# GhostNest Action Catalog

이 문서는 `RuntimeAction`으로 사용할 수 있는 기본 액션을 정리한다.

액션은 `src/ghost/actions.ts`의 `rules[].actions`, `ManagementMenuItem.actions`, `DialogueScript` 선택지 후속 액션에서 사용할 수 있다.

액션의 시작과 종료 기준은 [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md)를 함께 본다.

화면에서 액션 목록을 선택하거나 매핑 편집기를 만들 때는 개발자용 조립 플러그인의 코드 카탈로그인 `src/plugins/nanikaMapping/actionCatalog.ts`를 기준으로 삼는다.

## 한눈에 보기

| 분류 | 액션 |
| --- | --- |
| 대사 | `speak`, `speak_text`, `speak_script` |
| 캐릭터 표현 | `change_expression`, `surface`, `set_touched_part`, `play_animation`, `play_layer_animation`, `toggle_hidden`, `move_character` |
| 외부 기능 | `call_plugin` |
| UI | `open_ui`, `close_ui`, `open_management_menu`, `close_management_menu`, `set_management_menu_display`, `change_balloon`, `change_balloon_font_size`, `change_speech_layout`, `reset_runtime_ui` |
| 상태/흐름 | `set_state`, `emit_event`, `touch_interaction`, `mark_prompted`, `start_timer`, `stop_timer` |
| 입출력 | `log`, `play_sound`, `show_notification`, `save_data`, `load_data`, `navigate` |

## 대사

### speak

캐릭터 대사 카테고리에서 랜덤 대사를 출력한다.

```ts
{ type: "speak", category: "onTouchHead" }
```

현재 기본 rule에서는 터치 반응, hover 설명, idle, 랜덤 발화에 사용한다.

### speak_text

고정 문장을 말풍선에 출력한다.

```ts
{ type: "speak_text", text: "여기는 직접 지정한 안내 문장이에요." }
```

DB나 AI 응답 텍스트를 그대로 보여줄 때 가장 단순한 출력 액션이다.

### speak_script

JSON `DialogueScript`를 실행한다.

```ts
{
  type: "speak_script",
  text: "선택지를 보여줄게요.",
  script: [
    { type: "text", value: "어느 쪽으로 갈까요?" },
    { type: "wait", ms: 300 },
    {
      type: "choice",
      choices: [
        {
          label: "점프",
          actions: [{ type: "play_animation", animation: "jump", duration: 460 }],
        },
      ],
    },
  ],
}
```

`text`는 fallback 또는 요약 텍스트이고, 실제 연출은 `script` 토큰 배열이 담당한다.

## 캐릭터 표현

### change_expression

캐릭터 표정을 변경한다.

```ts
{ type: "change_expression", expression: "thinking", clearTouchedPart: true }
```

등록된 이미지 후보가 여러 개라면 해당 표정 안에서 후보를 선택할 수 있다.

### surface

캐릭터 surface를 변경한다.

```ts
{ type: "surface", id: "idle", startIdleLayers: true }
```

surface는 expression보다 실제 렌더링에 가까운 표시 단위이며, scene visual이나 layer 조합을 포함할 수 있다.

### set_touched_part

마지막으로 반응한 캐릭터 부위를 기록한다.

```ts
{ type: "set_touched_part", part: "head" }
```

`null`을 주면 터치 부위 상태를 비울 수 있다.

### play_animation

캐릭터 sprite에 CSS 애니메이션 상태를 적용한다.

```ts
{ type: "play_animation", animation: "jump", duration: 460 }
```

현재 CSS에는 `wave_hand`, `jump`, `nod` 예시 애니메이션이 있다.

### play_layer_animation

캐릭터 surface의 특정 layer 애니메이션을 실행하거나 중지한다.

```ts
{ type: "play_layer_animation", layerId: "mouth", duration: 1200 }
```

`active: false`를 주면 해당 layer 애니메이션을 명시적으로 중지할 수 있다.

```ts
{ type: "play_layer_animation", layerId: "mouth", active: false }
```

입모양, 눈 깜빡임, 귀 움직임처럼 파츠별 표현을 붙일 때 쓰는 액션이다.

### toggle_hidden

캐릭터 스테이지의 숨김 상태를 토글한다.

```ts
{ type: "toggle_hidden" }
```

### move_character

캐릭터 스테이지 위치를 직접 지정한다.

```ts
{ type: "move_character", x: 40, y: 120 }
```

현재는 스테이지에 CSS 변수와 `data-position-mode="custom"`을 적용한다.

## 외부 기능

### call_plugin

등록된 `RuntimePlugin`을 `pluginId`로 찾아 실행한다.

```ts
{ type: "call_plugin", pluginId: "sample_result" }
```

플러그인은 API, DB, AI, 미니게임, 상점 같은 외부 기능을 감싸는 경계다. 결과는 `PluginResult`로 반환하고 런타임이 말풍선, 표정, script에 반영한다.

## UI

### open_ui

`data-runtime-ui`가 일치하는 UI 요소를 연다.

```ts
{ type: "open_ui", target: "sample_result_modal" }
```

```html
<section data-runtime-ui="sample_result_modal" hidden>...</section>
```

### close_ui

`data-runtime-ui`가 일치하는 UI 요소를 닫는다.

```ts
{ type: "close_ui", target: "sample_result_modal" }
```

### open_management_menu

관리 메뉴를 연다. 메뉴 항목은 `children`으로 depth를 만들고, 실제 실행은 각 항목의 `actions` 배열에 위임한다.

```ts
{
  type: "open_management_menu",
  menuId: "system-tools",
  title: "시스템 도구",
  display: "panel",
  closeOnSelect: false,
  draggable: false,
  items: [
    {
      id: "weather",
      label: "날씨 확인",
      description: "날씨 기능을 실행해요.",
      actions: [{ type: "call_plugin", pluginId: "weather" }],
    },
  ],
}
```

`display`가 있으면 이 액션의 표시 위치를 직접 정한다. 없으면 `menuId`별 표시 방식 설정과 기본 표시 방식을 따른다.
`closeOnSelect: false`를 주면 항목 실행 후 메뉴를 자동으로 닫지 않는다. `draggable: false`는 패널 메뉴의 제목 드래그 이동을 끈다.
매핑 편집기에서는 `items`를 비워도 `menuId` 또는 기본 메뉴 프리셋으로 메뉴 항목을 채울 수 있다.

### close_management_menu

열려 있는 관리 메뉴를 닫는다.

```ts
{ type: "close_management_menu" }
```

### set_management_menu_display

관리 메뉴를 말풍선 안에서 열지, 별도 패널로 열지 설정한다.

```ts
{ type: "set_management_menu_display", display: "panel" }
```

특정 메뉴에만 적용하려면 `menuId`를 함께 지정한다.

```ts
{ type: "set_management_menu_display", menuId: "system-tools", display: "balloon" }
```

현재 구현에서는 캐릭터별 저장소에 저장되어 새로고침 후에도 유지된다.

### change_balloon

말풍선 테마를 변경한다.

```ts
{ type: "change_balloon", theme: "dark_magic" }
```

현재 CSS에는 `dark_magic`, `soft` 테마 예시가 있다.

### change_balloon_font_size

말풍선과 메뉴 글자 크기를 변경한다.

```ts
{ type: "change_balloon_font_size", size: "large" }
```

현재 CSS에는 `small`, `large` 예시가 있고, `default`를 주면 기본 크기로 되돌린다.

### change_speech_layout

대사 UI 배치를 변경한다.

```ts
{ type: "change_speech_layout", mode: "dialogue-box", placement: "overlay-bottom" }
```

현재 지원하는 mode는 `floating`, `dialogue-box`이고 placement는 `below-character`, `overlay-bottom`이다.

### reset_runtime_ui

사용자가 바꾼 런타임 UI 설정을 기본값으로 되돌린다.

```ts
{ type: "reset_runtime_ui" }
```

현재 초기화 대상은 메뉴 표시 방식, 말풍선 테마, 말풍선 글자 크기, 캐릭터 위치다.

## 상태와 흐름

### set_state

캐릭터 런타임 상태를 변경한다.

```ts
{ type: "set_state", state: "service_active" }
```

상태는 `state.mode`와 스테이지의 `data-state`에 반영된다.

### emit_event

다른 런타임 이벤트를 발생시킨다.

```ts
{ type: "emit_event", event: "character:idle" }
```

이벤트를 조합하거나 후속 rule을 실행할 때 사용할 수 있다.

### touch_interaction

마지막 사용자 상호작용 시간을 갱신한다.

```ts
{ type: "touch_interaction" }
```

idle, 랜덤 발화 타이밍을 밀어내는 데 사용한다.

### mark_prompted

마지막 랜덤 발화 시각을 갱신한다.

```ts
{ type: "mark_prompted" }
```

현재 `character:randomPrompt` 기본 rule에서 사용한다.

### start_timer

일정 시간 뒤 액션 배열을 실행하는 타이머를 시작한다.

```ts
{
  type: "start_timer",
  timer: "delayed_hint",
  duration: 3000,
  actions: [
    { type: "speak_text", text: "3초 뒤에 나온 안내예요." },
    { type: "log", label: "timer.delayed_hint" },
  ],
}
```

같은 이름의 타이머가 이미 있으면 기존 타이머를 취소하고 새로 시작한다.

### stop_timer

실행 대기 중인 타이머를 취소한다.

```ts
{ type: "stop_timer", timer: "delayed_hint" }
```

## 입출력

### log

이벤트 로그에 문자열을 추가한다.

```ts
{ type: "log", label: "custom.head.touch" }
```

디버깅과 rule 실행 확인용으로 사용한다.

### play_sound

지정한 사운드 파일을 재생한다.

```ts
{ type: "play_sound", sound: "./assets/sounds/magic_click.mp3", volume: 0.5 }
```

브라우저 정책상 사용자 제스처 없이 재생이 막힐 수 있다.

### show_notification

알림을 표시한다.

```ts
{ type: "show_notification", title: "오늘의 샘플 결과", message: "새 결과가 도착했어요." }
```

브라우저 알림 권한이 있으면 Notification을 사용하고, 아니면 말풍선으로 출력한다.

### save_data

캐릭터별 저장소에 데이터를 저장한다.

```ts
{ type: "save_data", key: "last_sample_result", value: "ready" }
```

기본 저장소의 키는 내부적으로 `ghostNest:{characterId}:{key}` 형식이 된다.

### load_data

캐릭터별 저장소에서 데이터를 불러온다.

```ts
{ type: "load_data", key: "last_sample_result", speak: true }
```

`speak: true`이면 불러온 값을 말풍선으로 출력한다.

### navigate

지정한 경로로 이동한다.

```ts
{ type: "navigate", route: "/tarot" }
```

현재 구현은 `window.location.assign(route)`를 사용한다.

## Custom Action

기본 액션으로 표현하기 어렵고 여러 곳에서 재사용할 행동은 custom action handler로 등록할 수 있다.

```ts
runtime.registerAction("my_action", async (action, context) => {
  await context.runActions([
    { type: "speak_text", text: "커스텀 액션 실행 완료" },
  ]);
});
```

단, API 호출이나 DB 조회처럼 특정 서비스에 묶인 구현은 먼저 `RuntimePlugin`으로 분리할 수 있는지 확인한다.
