# Nanika Integration and Usage Guide

이 문서는 GhostNest/Nanika를 다른 사이트나 앱에 붙일 때, 누가 어디까지 만져야 하는지 정리한 기준 문서다.

Nanika는 모든 기능을 직접 제공하는 만능 앱이 아니라, 캐릭터를 중심으로 기능, 대사, 메뉴, 무대 조합, 외부 이벤트를 연결해 보여주는 런타임 모듈이다. Host 앱은 자신의 화면과 서비스를 유지하고, Nanika는 그 안에서 캐릭터 기반 반응을 담당한다.

## 역할 구분

### 1. Host 앱 개발자

Host 앱 개발자는 Nanika를 자기 서비스 화면에 붙이는 사람이다.

주로 만지는 것:

- Nanika 패키지 설치
- Nanika를 붙일 mount 영역 생성
- `createGhostRuntimeFromPreset` 또는 runtime 생성 API 호출
- 페이지별 runtime profile 또는 initial option 지정
- host 이벤트를 `runtime.emit(...)`으로 전달
- 캐릭터 변경이 필요하면 `runtime.setCharacter(...)` 또는 runtime 재생성 처리
- 이미지 asset을 host public 경로, CDN, storage에 배치
- host 인증, 관리자 접근 제한, 라우팅, 권한 처리
- host CSS wrapper와 theme variable 설정

직접 만지지 않는 것이 좋은 것:

- `src/core`
- `src/runtime` 내부 렌더링 로직
- `.ghostnest-runtime`, `.character-sprite`, `.speech-balloon`, `.scene-layer-root` 같은 런타임 내부 layout selector
- Nanika devtools HTML을 host 라우트에 억지로 끼워 맞추는 임시 shim
- 이미지 파일을 DB에 직접 저장하는 구조

Host 앱에서 처리해야 하는 것:

- Nanika가 어느 페이지에 나올지
- 어떤 profile id를 사용할지
- 어떤 이벤트를 Nanika에 넘길지
- asset URL이 브라우저에서 접근 가능한지
- 개발자 도구 접근 제한을 어떻게 걸지
- Vercel 같은 읽기 전용 배포 환경에서 파일 저장 대신 DB 저장을 쓸지

### 2. Nanika 기능 개발자

Nanika 기능 개발자는 GhostNest 안에서 런타임, 플러그인, devtools, 캐릭터 설정 도구를 만드는 사람이다.

주로 만지는 것:

- `src/plugins`
- `src/plugins/*/devtools`
- `src/devtools` 공통 helper
- `src/characters`
- `src/ghost`
- `generated` 기본 예시 데이터
- docs와 가이드

신중하게 만져야 하는 것:

- `src/runtime`
- `src/core`
- `styles.css`의 런타임 layout 규칙
- data adapter contract
- action/rule contract

원칙:

- 코어와 런타임은 최소 실행 계약과 렌더링 계약만 책임진다.
- 플러그인과 devtools는 기능 단위로 분리한다.
- 파일 저장과 DB 저장의 차이는 data adapter 경계에서 숨긴다.
- devtools 편의를 위해 코어/런타임이 특정 화면 구조에 종속되면 안 된다.
- UI 변경은 브라우저 또는 DOM rect 기준으로 검증한다.

### 3. 캐릭터/에셋 작업자

캐릭터/에셋 작업자는 코드를 거의 보지 않고 캐릭터 재료를 만드는 사람이다.

주로 사용하는 화면:

- 캐릭터 만들기
- 표정 설정
- 상태 연결
- 파츠 편집
- 무대 조합 설정
- 히트박스 설정
- 대사 설정

주로 하는 일:

- base 이미지 등록
- parts 이미지 등록
- 표정 후보 만들기
- 상태에 표정, base, scene, layer 연결
- 눈 깜빡임, 입모양 같은 파츠 애니메이션 설정
- 무대 조합에서 캐릭터와 소품을 배치
- 클릭 가능한 영역 설정
- 캐릭터별 대사 작성

주의:

- 이미지는 DB에 넣지 않고 path 또는 URL만 저장한다.
- 무대 조합은 이미지 파일 하나가 아니라 여러 레이어의 배치 정보다.
- 파츠는 base 이미지 기준으로 따라다닌다.
- 무대 조합은 캐릭터와 같은 scene viewport 안에서 앞뒤 depth로 배치된다.

### 4. 운영자 또는 비개발 사용자

운영자 또는 비개발 사용자는 이미 만들어진 도구를 통해 Nanika 동작을 조정하는 사람이다.

주로 사용하는 화면:

- 매핑 설정
- 메뉴 설정
- DB 어댑터 테스트
- 런타임 테스트

주로 하는 일:

- 어떤 이벤트에서 어떤 액션을 실행할지 연결
- 저장된 연결 세트를 profile에 붙이기
- 메뉴 항목과 메뉴 액션 수정
- 특정 페이지 조건이나 URL 조건 설정
- 캐릭터, 대사, 무대 조합, 메뉴 UI가 실제로 어떻게 보이는지 확인

사용자가 직접 알 필요 없는 것:

- runtime 내부 CSS selector
- core/runtime/plugin 경계
- DB query 구현
- 캐릭터 파일의 실제 TypeScript module 구조
- package build 산출물 구조

## 설치와 기본 연결

GitHub dependency로 설치할 수 있다.

```bash
npm install github:nightcat01/ghost-nest
```

Host 앱에서 public asset 폴더를 만들고 싶다면 명시적으로 init 명령을 실행한다.

```bash
npx ghost-nest init-assets --root public/assets/nanika
```

공식 데모 캐릭터 asset을 복사하려면 다음 명령을 쓴다.

```bash
npx ghost-nest export-demo-assets --character rine --root public/assets/nanika
```

기본 runtime 연결 예시:

```ts
import {
  createGhostRuntimeFromPreset,
  nanikaPreset,
  runtimeSpeechPresets,
} from "ghost-nest";

const runtime = createGhostRuntimeFromPreset(nanikaPreset, {
  root: "#nanika-root",
  assetBaseUrl: "/assets/nanika",
  stageMode: "fill",
  hideUntilReady: true,
  speechLayout: runtimeSpeechPresets.hostEmbed.speechLayout,
});
```

Host 이벤트 전달 예시:

```ts
runtime.emit("page:open", {
  pageId: "home",
  path: location.pathname,
});

runtime.emit("feature:selected", {
  featureId: "tarot",
  label: "타로",
});
```

## Profile과 Mapping 사용 방식

Nanika를 실사용할 때는 runtime이 모든 것을 자동으로 알아서 찾는 구조보다, host가 사용할 profile id를 명확히 지정하는 방식이 안전하다.

권장 흐름:

```txt
Host page
-> profile id 선택
-> Runtime profile 로드
-> Character 선택
-> Initial surface/scene/expression 적용
-> Mapping rules 실행
-> Menu/Speech/Plugin action 표시
```

개발자는 페이지나 조건에 따라 profile id를 고른다.

예시:

```ts
const profileId = pageId === "home"
  ? "rine.full-runtime.profile"
  : "rine.subpage.profile";
```

매핑 설정 화면에서 해야 하는 일:

- profile이 어떤 캐릭터를 쓰는지 확인
- profile에 어떤 연결 세트가 붙는지 확인
- 이벤트에서 어떤 액션으로 이어지는지 말단까지 확인
- 조건 카드가 runtime 범위인지 character 범위인지 구분
- 저장 ID를 명확하게 부여

## 메뉴 UI 사용 방식

메뉴는 코어 기능이 아니라 runtime action으로 열리는 UI 재료다.

메뉴 설정 화면에서 하는 일:

- 메뉴 ID 작성
- 메뉴 이름과 설명 작성
- 메뉴 표시 방식 선택
- 메뉴 항목 추가
- 메뉴 항목별 action 설정
- 저장된 메뉴 JSON 확인

매핑에서 하는 일:

- 특정 이벤트에 `open_management_menu` 같은 메뉴 열기 액션 연결
- 메뉴를 닫을지 고정할지 action option으로 결정
- profile 또는 연결 세트에 메뉴 열기 흐름 포함

Host 앱에서 하는 일:

- 메뉴를 띄울 위치와 영역을 제공
- 필요한 경우 host CSS variable로 테마만 조정
- 메뉴 항목이 host 기능을 호출해야 하면 host event 또는 plugin action을 연결

## 캐릭터 변경 방식

같은 runtime mount 안에서 캐릭터만 바꿔도 되는 경우에는 `runtime.setCharacter(...)`를 사용한다.

```ts
await runtime.setCharacter(nextCharacter, {
  initialScene: "desk-room",
  initialSurface: "idle",
  initialExpression: "neutral",
});
```

하지만 다음이 함께 바뀌어야 한다면 runtime을 재생성하는 쪽이 안전하다.

- rules
- menu set
- feature set
- profile id
- storage scope
- plugin list

즉 단순 캐릭터 교체는 `setCharacter`, 실행 흐름 전체 교체는 profile 변경 또는 runtime 재생성을 쓴다.

## Embed CSS 책임 범위

Host CSS는 Nanika 바깥 wrapper와 theme만 조정하는 것이 안전하다.

Host가 만져도 되는 것:

- mount 크기
- mount 위치
- `z-index`
- `visibility`
- host page overflow
- CSS variable
- route별 wrapper class

Host가 되도록 만지지 말아야 하는 것:

- `.ghostnest-runtime.character-stage`
- `.character-sprite`
- `.character-sprite-layer`
- `.speech-balloon`
- `.balloon-action-menu`
- `.scene-viewport`
- `.scene-layer-root`
- `.scene-layer`

특히 다음 속성은 host CSS에서 직접 덮지 않는 것이 좋다.

- `grid-template-areas`
- `grid-area`
- `align-self`
- `justify-self`
- `left`
- `right`
- `top`
- `bottom`
- `transform`
- `width`
- `height`
- `max-height`
- `overflow`

임베드에서 중요한 기준:

- `stageMode: "fill"`이면 Nanika stage는 mount 전체를 사용한다.
- 겹치는 대사창은 scene group 영역을 줄이지 않는다.
- 하단/상단 대사창은 speech가 차지하는 공간만큼 scene group이 줄어들 수 있다.
- 캐릭터와 무대 조합은 같은 scene viewport를 기준으로 움직인다.

## 저장 방식

Nanika metadata는 파일 또는 DB에 저장할 수 있다.

파일 저장에 적합한 경우:

- 로컬 개발
- 데모
- Git으로 관리되는 기본 preset
- 작은 팀 내부 도구

DB 저장에 적합한 경우:

- Vercel 같은 읽기 전용 배포 환경
- 운영 중 메뉴/매핑/대사/캐릭터 설정을 바꿔야 하는 경우
- 여러 관리자가 같은 데이터를 수정하는 경우
- host 앱의 관리자 화면에서 설정을 관리하는 경우

DB에 저장하는 것:

- character metadata
- expressions
- surfaces
- layers
- scenes
- dialogues
- mappings
- feature sets
- runtime profiles
- menus
- conditions

DB에 직접 저장하지 않는 것:

- PNG/WebP 이미지 binary
- 대용량 asset 파일

이미지는 public folder, CDN, object storage 등에 두고 DB에는 path 또는 URL만 저장한다.

## 개발자가 직접 수정할 때의 기준

일반적인 host 연동에서는 아래 파일을 직접 수정하지 않는 것이 목표다.

```txt
src/core
src/runtime
styles.css 런타임 공통 layout
```

수정이 필요한 경우:

- runtime action contract가 부족한 경우
- scene/character rendering contract가 부족한 경우
- data adapter contract가 부족한 경우
- plugin만으로 표현할 수 없는 공통 기능이 필요한 경우

수정 전 확인:

- 플러그인으로 가능한가
- devtools 내부 변경으로 가능한가
- host option으로 가능한가
- CSS variable로 가능한가
- data adapter로 숨길 수 있는가

위 방법으로 해결되지 않을 때만 core/runtime을 수정한다.

## 사용자 작업 흐름

비개발 사용자에게는 다음 순서로 안내하는 것이 좋다.

```txt
1. 캐릭터 만들기
2. 이미지 등록
3. 표정 만들기
4. 상태 연결
5. 파츠 편집
6. 무대 조합
7. 대사 작성
8. 히트박스 설정
9. 매핑 연결
10. 메뉴 설정
11. 런타임 테스트
```

각 화면에서 사용자는 다음 질문에 답하면 된다.

- 지금 무엇을 만들고 있나
- 이 재료는 어디에서 쓰이나
- 현재 사용 중인 재료는 무엇인가
- 저장하면 어떤 ID로 저장되나
- 런타임에서 어떻게 보이나

## 배포 전 체크리스트

Host 앱 개발자 체크:

- `npm install` 후 `dist` import가 되는가
- assetBaseUrl이 실제 public URL과 맞는가
- mount 안에서만 runtime node가 생성되는가
- `hideUntilReady` 또는 ready event로 초기 깜빡임을 막았는가
- host CSS가 runtime layout selector를 덮지 않는가
- profile id 선택 기준이 명확한가
- production에서 파일 저장 대신 DB 저장이 필요한가
- 관리자 도구 접근 제한은 host에서 처리했는가

Nanika 기능 개발자 체크:

- `npm run check`
- `npm run build`
- `npm run verify:ui`
- 임베드 rect 검증
- 기본 런타임 데모 확인
- 캐릭터 설정 화면 확인
- 매핑 작업판 확인
- 메뉴 설정 화면 확인
- DB 어댑터 테스트 페이지 확인

비개발 사용자 체크:

- 캐릭터가 보이는가
- 대사가 보이는가
- 클릭/터치 반응이 동작하는가
- 메뉴가 열리는가
- 무대 조합이 의도한 위치에 보이는가
- 저장 후 다시 불러와도 같은 결과인가

