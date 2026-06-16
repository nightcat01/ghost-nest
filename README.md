# GhostNest

## Nanika 사용/연동 기준

개발자가 어디까지 만지고, host 앱과 비개발 사용자가 무엇을 설정해야 하는지는 아래 문서를 먼저 기준으로 삼습니다.

- [Nanika Integration and Usage Guide](./docs/nanika-integration-and-usage-guide.md)

요약:

- Host 앱 개발자는 mount, routing, asset URL, profile 선택, host event 전달, 접근 제한을 책임집니다.
- Nanika 기능 개발자는 plugin, devtools, runtime contract, data adapter, character/mapping/menu 도구를 관리합니다.
- 비개발 사용자는 캐릭터 설정, 무대 조합, 대사, 매핑, 메뉴 설정 화면을 통해 재료를 만들고 연결합니다.
- core/runtime은 일반 기능 추가 과정에서 직접 수정하지 않는 것을 기본 원칙으로 둡니다.

웹 기반 AI 캐릭터 런타임을 실험하기 위한 TypeScript MVP입니다.

GhostNest는 API, DB, AI, UI 같은 외부 기능을 액션에 매핑하고, 그 결과를 캐릭터 대사, 표정, 메뉴, 애니메이션으로 표현하는 나니카형 웹 런타임을 목표로 합니다.

## 현재 범위

- 캐릭터 표시
- 말풍선 출력
- 캐릭터 부위별 클릭 반응
- 화면 관찰 영역 hover/focus 반응
- idle 이벤트와 랜덤 발화
- 캐릭터 프로필과 대사 데이터 분리
- 데모 플러그인 호출
- 외부에서 호출 가능한 `createGhostRuntime()` API
- 실행 중인 런타임에서 캐릭터를 교체하는 `runtime.setCharacter()` API

## 실행

의존성을 설치한 뒤 TypeScript를 빌드합니다.

```bash
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

브라우저에서 `http://127.0.0.1:4173`을 열면 됩니다.

## Host asset 폴더 초기화

GhostNest를 다른 앱에 embed할 때는 host 앱이 캐릭터 이미지를 브라우저에서 접근 가능한 public 경로에 둡니다. 권장 폴더만 빠르게 만들고 싶다면 host 앱 루트에서 CLI를 실행합니다.

```bash
npx ghost-nest init-assets --root public/assets/nanika
```

이 명령은 폴더만 만들고 기존 파일은 덮어쓰지 않습니다.

공식 데모 캐릭터 에셋까지 복사하려면 다음 명령을 실행합니다.

```bash
npx ghost-nest export-demo-assets --character rine --root public/assets/nanika
```

기존 파일은 기본적으로 덮어쓰지 않습니다. 덮어써야 할 때만 `--force`를 사용합니다. 자세한 embed 경로 기준은 [docs/runtime-embed-guide.md](./docs/runtime-embed-guide.md)를 확인합니다.

## Runtime character switch

호스트 앱에서 같은 나니카 mount를 유지한 채 캐릭터만 바꾸고 싶다면 런타임을 다시 만들지 않고 `runtime.setCharacter()`를 사용할 수 있습니다.

```ts
const runtime = createGhostRuntimeFromPreset(preset, {
  root: "#nanika-root",
  initialScene: "desk-room",
  initialSurface: "idle",
});

await runtime.setCharacter(nextCharacter, {
  initialScene: "desk-room",
  initialSurface: "miyako-idle",
  initialExpression: "neutral",
});
```

캐릭터 변경 후에는 `ghostnest:character-change` 이벤트가 발생합니다. 런타임 rule, 관리 메뉴, storage scope까지 새로 잡아야 하는 경우에는 기존처럼 `destroy()` 후 새 런타임을 생성합니다. 자세한 기준은 [Runtime Character Switching](./docs/runtime-embed-guide.md#runtime-character-switching)을 확인합니다.

## 개발자 시작점

기능을 붙이는 개발자는 먼저 [GUIDE.md](./GUIDE.md)를 확인합니다.

일반적인 기능 추가나 서비스 연결에서 우선 확인할 파일은 다음 3개입니다.

- `src/ghost/character.ts`: 사용할 캐릭터 데이터 선택
- `src/ghost/nanika.config.ts`: 외부 연결점, selector, 런타임 옵션 설정
- `src/ghost/actions.ts`: 메뉴 항목과 이벤트 rule의 액션 매핑

`src/core`, `src/runtime`, `dist`는 일반적인 기능 매핑 과정에서 직접 수정하지 않는 것을 목표로 합니다.

## 주요 문서

| 문서 | 역할 |
| --- | --- |
| [GUIDE.md](./GUIDE.md) | 처음 보는 개발자를 위한 통합 가이드 |
| [DETAIL_GUIDE.md](./DETAIL_GUIDE.md) | 상세 문서와 데모별 문서 링크 지도 |
| [PROJECT_COMPASS.md](./PROJECT_COMPASS.md) | 프로젝트 방향과 판단 기준 |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | 개발자가 먼저 보는 사용 가이드 |
| [ACTION_CATALOG.md](./ACTION_CATALOG.md) | 지원 액션 목록과 예시 |
| [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md) | 액션의 시작, 종료, 후속 액션 기준 |
| [EXTERNAL_RESULT_MAPPING.md](./EXTERNAL_RESULT_MAPPING.md) | AI/API/DB 결과를 액션으로 연결하는 예시 |
| [STORAGE_AND_SETTINGS.md](./STORAGE_AND_SETTINGS.md) | 저장값, 사용자 설정, StorageAdapter 경계 |
| [docs/nanika-data-adapter.md](./docs/nanika-data-adapter.md) | 파일/DB 저장소를 같은 Nanika data adapter 계약으로 다루는 기준 |
| [docs/nanika-postgres/README.supabase.md](./docs/nanika-postgres/README.supabase.md) | PostgreSQL/Supabase 기반 Nanika metadata schema와 seed 예시 |
| [UI_RENDERER_BOUNDARY.md](./UI_RENDERER_BOUNDARY.md) | UI renderer 교체 경계 |
| [DIALOGUE_SCRIPT_GUIDE.md](./DIALOGUE_SCRIPT_GUIDE.md) | JSON 대사 연출 포맷 |
| [ASSET_GENERATOR_SETUP.md](./ASSET_GENERATOR_SETUP.md) | Asset Generator 확장과 ComfyUI bridge 설정 |
| [src/characters/README.md](./src/characters/README.md) | 캐릭터 모듈 구조 |
| [src/demo/README.md](./src/demo/README.md) | 데모 preset 구조 |
| [src/plugins/README.md](./src/plugins/README.md) | 샘플 플러그인 구조 |
| [src/examples/httpStorageAdapter.example.ts](./src/examples/httpStorageAdapter.example.ts) | HTTP 저장소 adapter 예시 |

## 구조

```txt
src/
  app.ts
  ghost/
    character.ts
    nanika.config.ts
    actions.ts
  characters/
  demo/
  plugins/
    menuSettings/
      devtools/
  core/
  runtime/
  devtools/      # devtools 공통 유틸
```

큰 경계는 다음과 같습니다.

```txt
src/ghost       실제 조립 지점
src/demo        샘플 preset
src/plugins     샘플 외부 기능 구현
src/characters  캐릭터 데이터/표현 리소스
src/core        타입/이벤트/상태/공통 계약
src/runtime     실제 실행기/렌더링/액션 처리
src/devtools    플러그인 devtools가 공유하는 공통 유틸
```

`app.ts`는 데모 진입점이고, 실제 런타임 조립은 `createGhostRuntime()`이 담당합니다.

개발자 도구 화면은 장기적으로 각 플러그인 내부의 `devtools/`에 둡니다. 예를 들어 메뉴 설정 화면 로직은
`src/plugins/menuSettings/devtools/assetMenuSettings.ts`에 있고, 최상위 `src/devtools`는 API client나 DOM helper처럼
여러 devtools가 공유하는 얇은 유틸만 담당합니다.

## Rule 예시

런타임은 `event -> conditions -> actions` 규칙을 받을 수 있습니다.

```ts
rules: [
  {
    id: "custom.head.touch",
    event: "character:touch",
    when: { part: "head" },
    conditions: [{ type: "not_hidden" }],
    actions: [
      { type: "change_expression", expression: "happy" },
      { type: "speak_text", text: "머리를 쓰다듬으셨네요." },
      { type: "log", label: "custom.head.touch" },
    ],
  },
]
```

지원 액션과 상세 예시는 [ACTION_CATALOG.md](./ACTION_CATALOG.md)를 기준으로 정리합니다.

액션이 어디서 시작하고 어디서 끝나는지, 외부 AI/DB/API 결과 뒤에 후속 액션을 어떻게 연결하는지는 [ACTION_LIFECYCLE.md](./ACTION_LIFECYCLE.md)를 함께 봅니다.
