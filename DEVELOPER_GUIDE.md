# GhostNest Developer Guide

## 먼저 볼 문서

Nanika를 host 앱에 붙이거나, 개발자와 비개발 사용자의 책임 범위를 정리해야 한다면 아래 문서를 먼저 봅니다.

- [Nanika Integration and Usage Guide](./docs/nanika-integration-and-usage-guide.md)

핵심 기준:

- Host 앱 개발자는 mount, routing, asset URL, profile 선택, host event 전달을 책임집니다.
- 비개발 사용자는 devtools 화면에서 캐릭터, 대사, 무대 조합, 매핑, 메뉴를 설정합니다.
- Nanika 기능 개발자는 plugin/devtools/data adapter/runtime contract를 관리합니다.
- core/runtime은 plugin, option, adapter로 해결할 수 없을 때만 수정합니다.

이 문서는 GhostNest를 서비스나 데모에 붙이는 개발자가 가장 먼저 보는 안내서다.

GhostNest의 기본 목표는 코어 런타임을 직접 수정하지 않고, 외부 기능과 캐릭터 행동을 액션으로 연결하는 것이다.

## 먼저 볼 파일

개발자가 일반적인 기능 연결을 할 때 우선 보는 파일은 4개다.

| 파일 | 역할 | 주로 바꾸는 내용 |
| --- | --- | --- |
| `src/ghost/character.ts` | 캐릭터 선택 | 사용할 캐릭터 모듈 |
| `src/ghost/nanika.config.ts` | 런타임 설정 | 플러그인, selector, 메뉴 표시 방식, 타이핑, 크기 |
| `src/ghost/actions.ts` | 액션 매핑 | 메뉴 항목, 이벤트 rule, 실행할 actions |
| `src/ghost/preset.ts` | 실행 단위 | 캐릭터, 기능, 매핑, 런타임 옵션 조립 |

`src/core`, `src/runtime`, `dist`는 일반적인 기능 추가 과정에서 직접 수정하지 않는 것을 목표로 한다.

## 기본 흐름

새 기능을 붙일 때는 다음 순서로 생각한다.

```txt
외부 기능 준비
-> nanika.config.ts에 등록
-> actions.ts에서 메뉴나 이벤트에 매핑
-> preset.ts에서 실행 단위로 묶기
-> 캐릭터가 대사, 표정, UI, 애니메이션으로 결과를 표현
```

현재 `src/ghost` 파일들은 기본 동작을 보여주기 위해 `src/demo` preset과 `src/plugins/nanikaMapping` 조립 헬퍼를 가져다 쓴다.

서비스에 붙일 때는 `src/demo`나 `src/plugins/nanikaMapping`을 직접 고치기보다, `src/ghost/character.ts`, `src/ghost/nanika.config.ts`, `src/ghost/actions.ts`, `src/ghost/preset.ts`에서 필요한 import를 교체하거나 자기 기능을 추가하는 흐름을 우선한다.

데모 preset의 역할은 [src/demo/README.md](./src/demo/README.md)에 따로 정리한다.

샘플 플러그인의 역할은 [src/plugins/README.md](./src/plugins/README.md)에 따로 정리한다.

예를 들어 AI, DB, API를 붙이고 싶다면 GhostNest 코어에 요청 코드를 직접 넣지 않는다.

1. 개발자 코드에서 AI, DB, API 호출을 구현한다.
2. 그 결과를 `RuntimePlugin`, `DialogueEngine`, `StorageAdapter` 중 알맞은 경계로 감싼다.
3. `actions.ts`에서 `call_plugin`, `speak_text`, `speak_script`, `open_ui` 같은 액션으로 결과를 표현한다.

외부 결과를 액션으로 연결하는 구체적인 예시는 [EXTERNAL_RESULT_MAPPING.md](./EXTERNAL_RESULT_MAPPING.md)를 기준으로 본다.

저장값과 사용자 설정 경계는 [STORAGE_AND_SETTINGS.md](./STORAGE_AND_SETTINGS.md)를 기준으로 본다.

말풍선, 메뉴, 캐릭터 표시 같은 UI renderer 교체 경계는 [UI_RENDERER_BOUNDARY.md](./UI_RENDERER_BOUNDARY.md)를 기준으로 본다.

## character.ts

캐릭터 모듈을 고르는 진입점이다.

```ts
import { rine } from "../characters/rine/index.js";

export const character = rine;
```

다른 캐릭터를 쓰려면 캐릭터 모듈을 만든 뒤 이 export만 교체한다.

캐릭터별로 달라지는 데이터는 가능한 한 캐릭터 모듈 안에 둔다.

- 프로필
- 대사 카테고리
- 표정과 surface
- 레이어 이미지
- 히트박스
- 캐릭터별 애니메이션 리소스

캐릭터 모듈의 구조와 경계는 [src/characters/README.md](./src/characters/README.md)에 따로 정리한다.

## nanika.config.ts

런타임과 외부 세계를 연결하는 설정 파일이다.

주요 섹션은 다음과 같다.

| 섹션 | 역할 |
| --- | --- |
| `externalFeatures` | 플러그인과 외부 기능 등록 |
| `runtimeSelectors` | GhostNest가 사용할 DOM selector |
| `devtoolOptions` | 진단 패널, 히트박스 에디터 같은 개발 도구 연결 |
| `managementMenuOptions` | 메뉴별 표시 방식 설정 |
| `controlOptions` | 개발자가 허용할 기능 관문 |
| `typingOptions` | 대사 타이핑 속도 |
| `spriteSizeOptions` | 캐릭터 표시 크기 |

외부 API, DB, AI 연결은 보통 `externalFeatures`에 들어갈 플러그인으로 감싼다.

```ts
const externalFeatures = [
  ...createDemoPlugins(),
  myServicePlugin,
] satisfies RuntimePlugin[];
```

서비스 화면의 HTML 구조가 바뀌면 `runtimeSelectors`를 수정한다.

## actions.ts

사용자 입력과 메뉴 선택을 실제 행동으로 매핑하는 파일이다.

크게 두 영역으로 나뉜다.

| export | 역할 |
| --- | --- |
| `managementMenuItems` | 우클릭 관리 메뉴와 하위 메뉴 정의 |
| `nanikaRules` | 런타임 이벤트가 발생했을 때 실행할 액션 정의 |

메뉴 항목은 기능을 직접 구현하지 않는다.

현재 파일은 데모 메뉴를 기본값으로 가져온다.

```ts
export const managementMenuItems = createDemoManagementMenuItems(character, {
  includeDeveloperTools: true,
});
```

서비스 기능을 붙일 때는 이 배열에 메뉴 항목을 추가하거나, 데모 preset 대신 직접 메뉴 배열을 정의한다.

사용자에게 개발자 도구를 노출하지 않을 서비스라면 `includeDeveloperTools`를 끄거나, `developer-tools` 묶음을 제외한 메뉴를 직접 조립한다.

메뉴 파일은 기능군 단위로 나누는 것을 기본으로 한다. 항목 하나마다 파일을 만들기보다, `dialogue`, `plugin`, `ui`, `character`처럼 찾기 쉬운 묶음으로 유지하고, 특정 묶음이 커질 때만 한 단계 더 분리한다.

```ts
{
  id: "weather",
  label: "날씨",
  description: "날씨 기능을 호출해서 결과를 캐릭터가 설명해요.",
  actions: [
    { type: "call_plugin", pluginId: "weather" },
    { type: "log", label: "management.weather" },
  ],
}
```

이 구조에서는 `weather` 플러그인이 실제 날씨 API 연결을 맡고, 메뉴는 그 플러그인을 호출하겠다는 매핑만 가진다.

이벤트 rule도 같은 방식이다.

```ts
{
  id: "nanika.command.fortune",
  event: "command:fortune",
  actions: [
    { type: "touch_interaction" },
    { type: "call_plugin", pluginId: "fortune" },
    { type: "log", label: "plugin:fortune.execute" },
  ],
}
```

### 환경별 진입 경로

GhostNest 코어는 PC와 모바일을 나눠서 액션을 만들지 않는다.

환경별 차이는 액션이 아니라 `event -> actions` 매핑에서 처리한다. 예를 들어 데스크톱에서는 우클릭으로 관리 메뉴를 열고, 모바일에서는 앱이 제공하는 버튼이 같은 이벤트를 발생시키게 할 수 있다.

```ts
const openManagementMenuActions = [
  { type: "touch_interaction" },
  { type: "change_expression", expression: "thinking", clearTouchedPart: true },
  { type: "speak_text", text: "관리 메뉴를 열었어요. 필요한 동작을 골라주세요." },
  {
    type: "open_management_menu",
    title: "관리 메뉴",
    items: managementMenuItems,
  },
  { type: "log", label: "management_menu.open" },
];

export const nanikaRules = [
  {
    id: "nanika.character.right_click.management_menu",
    event: "character:right_click",
    actions: openManagementMenuActions,
  },
  {
    id: "nanika.command.management_menu",
    event: "command:management_menu",
    actions: openManagementMenuActions,
  },
];
```

위 예시에서 메뉴 내용과 액션은 하나만 유지된다. PC/모바일 차이는 어떤 이벤트가 같은 액션 배열을 실행하느냐의 문제다.

모바일 버튼, long press, keyboard shortcut 같은 진입 경로는 서비스가 필요할 때 추가한다. GhostNest 코어에 `mobile_*` 액션을 늘리는 방식은 피한다.

## preset.ts

프리셋은 캐릭터, 플러그인 기능, 매핑, 런타임 옵션을 하나의 실행 단위로 묶는다.

```ts
export const nanikaPreset = defineNanikaRuntimePreset({
  id: "my-service.main",
  character,
  plugins: externalFeatures,
  mappings: [
    {
      id: "main.ready",
      event: "runtime:ready",
      actions: [
        { type: "surface", id: "main" },
        { type: "speak_text", text: "어서오세요." },
      ],
    },
  ],
  options: {
    selectors: runtimeSelectors,
    controls: {
      managementMenu: false,
      devtools: false,
      randomPrompt: true,
    },
  },
});
```

외부 사이트에서 페이지별로 다른 나니카를 쓰고 싶다면 preset을 페이지 단위로 나누는 방식을 우선한다.

## 액션을 만들 때의 기준

기능을 추가할 때는 먼저 기존 액션 조합으로 표현 가능한지 확인한다.

지원 액션의 전체 목록과 예시는 [ACTION_CATALOG.md](./ACTION_CATALOG.md)를 기준으로 확인한다.

코드에서 매핑 편집기나 개발자 도구가 읽을 수 있는 구조화 데이터는 다음 카탈로그를 기준으로 한다.

- `src/plugins/nanikaMapping/actionCatalog.ts`: 액션 목록과 입력값
- `src/plugins/nanikaMapping/capabilityCatalog.ts`: 등록된 플러그인을 기능 목록으로 변환
- `src/plugins/nanikaMapping/eventCatalog.ts`: rule trigger로 사용할 이벤트 목록
- `src/plugins/nanikaMapping/mapping.ts`: 화면 친화적인 mapping을 runtime rule로 변환
- `src/plugins/nanikaMapping/registry.ts`: 화면이 사용할 캐릭터, 기능, 이벤트, 액션, 매핑 목록을 한 입구로 제공

개발자 도구 화면을 select, card, tree 등 어떤 UI로 만들더라도 직접 여러 카탈로그 파일을 읽지 말고 `createNanikaMappingRegistry(preset)` 결과를 기준으로 구성한다.

- 단순 대사 출력: `speak_text`
- JSON 대사 연출: `speak_script`
- 외부 기능 호출: `call_plugin`
- 메뉴 열기: `open_management_menu`
- 화면 UI 열기: `open_ui`
- 캐릭터 애니메이션: `play_animation`
- 레이어 애니메이션: `play_layer_animation`
- 저장/불러오기: `save_data`, `load_data`

기존 액션으로 표현하기 어렵고 여러 서비스에서 반복될 행동이면 새 `RuntimeAction` 후보로 본다.

특정 서비스에만 필요한 구현이면 코어 액션보다 `RuntimePlugin`이 먼저다.

## 언제 코어를 수정하는가

다음 경우에만 `src/core` 또는 `src/runtime` 수정을 검토한다.

- 모든 캐릭터와 서비스에서 공통으로 쓸 행동이 필요하다.
- 기존 액션 조합으로 표현하면 중복과 오류 가능성이 커진다.
- 플러그인만으로는 런타임 상태, 대사 출력, 캐릭터 렌더링과 안전하게 연결할 수 없다.
- 문서화 가능한 공통 API로 제공할 수 있다.

반대로 API 호출, DB 조회, AI 응답 생성, 특정 서비스 화면 이동은 코어에 넣지 않는다.

## 더 자세히 볼 문서

- 전체 방향성: [PROJECT_COMPASS.md](./PROJECT_COMPASS.md)
- 액션 시작과 종료 기준: [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md)
- 외부 결과와 액션 매핑 예시: [EXTERNAL_RESULT_MAPPING.md](./EXTERNAL_RESULT_MAPPING.md)
- 저장과 사용자 설정 경계: [STORAGE_AND_SETTINGS.md](./STORAGE_AND_SETTINGS.md)
- UI renderer 교체 경계: [UI_RENDERER_BOUNDARY.md](./UI_RENDERER_BOUNDARY.md)
- JSON 대사 포맷: [DIALOGUE_SCRIPT_GUIDE.md](./DIALOGUE_SCRIPT_GUIDE.md)
