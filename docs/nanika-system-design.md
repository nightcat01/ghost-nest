# Nanika System Design

이 문서는 Nanika 전체 설계 기준을 고정하기 위한 상위 문서다.

세부 구현 방법보다 먼저 지켜야 하는 책임 경계, 데이터 흐름, 렌더링 불변조건, UI/UX 기준을 정의한다. 이후 런타임, devtools, 플러그인, host 연동을 수정할 때 이 문서를 기준으로 삼는다.

## 한 줄 정의

Nanika는 host 사이트 안에서 캐릭터를 중심으로 대사, 무대 조합, 메뉴, 이벤트, 플러그인 기능을 조립해 보여주는 웹 런타임이다.

Nanika는 CMS, DB, 인증 시스템, 이미지 저장소, 사이트 라우터가 아니다. Host가 가진 기능과 데이터를 캐릭터 출력으로 연결하는 모듈형 런타임이다.

## 설계 목표

- 캐릭터를 중심으로 기능, 대사, 메뉴, 무대 조합을 연결한다.
- 런타임은 host가 지정한 mount 영역 안에서만 동작한다.
- 캐릭터와 무대 조합은 하나의 시각 단위로 움직인다.
- 말풍선과 메뉴 UI는 캐릭터/무대 조합 좌표계를 흔들지 않는다.
- 저장소가 파일이든 DB든 devtools와 runtime은 같은 데이터 계약을 사용한다.
- 코어, 런타임, 플러그인, devtools, 데모 데이터의 경계를 섞지 않는다.
- 사용자는 영어 key를 몰라도 화면 흐름을 따라 설정할 수 있어야 한다.

## 책임 경계

### Host

Host는 Nanika가 붙는 실제 제품 또는 사이트다.

Host가 책임진다.

- Nanika mount 영역의 위치, 크기, overflow, z-index
- asset URL 제공
- 페이지 라우팅과 pageId 결정
- 사용자/관리자 접근 제어
- DB, 파일, object storage, CDN
- Nanika runtime profile 또는 mapping profile 선택
- host 이벤트를 Nanika 이벤트로 전달
- host 테마 토큰 또는 CSS variable 제공

Host가 직접 건드리지 않는 것이 좋다.

- `.ghostnest-runtime` 내부 layout selector
- `.scene-viewport`, `.character-sprite`, `.scene-layer-root` 좌표계
- runtime 내부 z-index 계산
- 캐릭터 파츠 위치 계산
- scene layer placement 계산

### Core

Core는 Nanika의 데이터 타입과 실행 계약을 정의한다.

Core가 책임진다.

- character, surface, expression, scene, layer, hit area 타입
- action, rule, mapping, feature set 타입
- runtime profile 타입
- data adapter 계약

Core가 책임지지 않는다.

- 특정 UI 화면
- 특정 DBMS
- 특정 캐릭터 asset
- host 라우팅
- devtools 저장 방식

### Runtime

Runtime은 Nanika를 실제 화면에 그리는 실행기다.

Runtime이 책임진다.

- mount 안에 runtime stage 생성
- 캐릭터 렌더링
- 파츠 렌더링
- 무대 조합 렌더링
- 말풍선 렌더링
- 메뉴 UI 렌더링
- rule/action 실행
- runtime ready, hide, restore 상태
- 캐릭터 변경과 초기값 적용

Runtime이 책임지지 않는다.

- 사용자가 어떤 profile을 선택할지 결정
- DB 접속 정보
- host 인증/권한
- 이미지 업로드
- 페이지 이동 라우팅 구현

### Plugin

Plugin은 Nanika에 붙일 수 있는 기능 단위다.

Plugin이 책임진다.

- 특정 action 구현
- 특정 menu UI 구현
- 특정 speech UI 구현
- 외부 기능 호출 어댑터
- 플러그인 전용 devtools

Plugin이 책임지지 않는다.

- runtime 전체 생명주기
- core 타입을 임의로 바꾸는 일
- host 저장소 선택

### Devtools

Devtools는 runtime-ready 데이터를 만들고 검증하는 도구다.

Devtools가 책임진다.

- 캐릭터 생성
- base/parts/expression/surface/scene/layer/hit area 설정
- mapping profile 설정
- feature set 설정
- menu 설정
- DB/file adapter를 통한 데이터 저장
- 개발자가 확인 가능한 preview 제공

Devtools가 책임지지 않는다.

- host 사이트의 실제 라우팅
- runtime 내부 렌더링을 화면별로 강제로 우회하는 일
- core/runtime 동작의 필수 전제

## 핵심 개념

### Character

Nanika의 중심 단위다.

Character는 다음 재료를 가진다.

- base image
- parts image
- expression
- surface
- scene
- layer animation
- hit area
- dialogue

Character에 귀속되는 재료는 다른 캐릭터에 자동으로 있다고 가정하지 않는다. 다만 공통 key를 사용하면 mapping profile을 캐릭터별로 재사용하기 쉬워진다.

### Scene

Scene은 여러 layer를 묶어 하나의 시각 단위처럼 쓰는 조합이다.

Scene layer의 주요 role은 다음과 같다.

- `background`: runtime 표시 영역을 채우는 배경
- `character`: 캐릭터가 들어갈 slot
- `prop`: 캐릭터와 같은 scene viewport 안에서 앞뒤로 배치되는 소품
- `foreground`: 캐릭터보다 앞에 나오는 전경
- `effect`: 시각 효과

Scene은 단일 이미지가 아니라 배치 정보가 있는 이미지 그룹이다.

### Surface

Surface는 runtime에서 실제 표시되는 캐릭터 상태다.

Expression보다 실사용에 가까운 단위이며, base image, expression, layer, scene 등을 연결할 수 있다.

### Mapping Profile

Mapping profile은 runtime이 어떤 캐릭터, 조건, 이벤트, action flow, feature set을 사용할지 묶은 실행 프로필이다.

권장 방향:

```txt
Host page
-> mapping profile id 선택
-> runtime profile 로드
-> character 로드
-> scene/surface/expression/dialogue/menu/action 적용
```

즉 host는 가능하면 character id와 rule 목록을 따로따로 넘기기보다 profile id를 명확히 선택한다.

### Feature Set

Feature set은 여러 mapping/action flow를 재사용하기 위한 묶음이다.

Feature set은 재료 묶음이지 독립 runtime이 아니다.

제한:

- feature set 안에 feature set을 무한 중첩하지 않는다.
- 순환 참조를 허용하지 않는다.
- 펼쳐서 봤을 때 실제 action 흐름을 추적할 수 있어야 한다.

### Menu

Menu는 runtime action으로 열리는 UI 재료다.

Menu 설정은 메뉴 구조와 메뉴 항목 action을 만든다. 실제 어느 이벤트에서 열지는 mapping이 결정한다.

## 렌더링 불변조건

### 1. Runtime은 mount 안에서만 동작한다

Embed mode에서 가장 큰 기준은 host가 제공한 mount 영역이다.

Runtime은 mount 바깥으로 캐릭터, 무대 조합, 대사창, 메뉴를 밀어내지 않는다.

### 2. 캐릭터와 무대 조합은 같은 좌표계에 있어야 한다

캐릭터, 파츠, 소품, 전경은 같은 `scene-viewport` 기준으로 계산한다.

말풍선 크기나 배치가 바뀌어도 캐릭터와 소품이 서로 다른 기준점으로 움직이면 안 된다.

### 3. Background는 stage 배경으로 다룬다

`background` role은 캐릭터 slot과 소품 좌표계를 흔들지 않고 runtime 표시 영역을 채운다.

배경은 약간 늘어나거나 잘릴 수 있다. 하지만 캐릭터와 소품의 상대 위치를 바꾸면 안 된다.

### 4. Prop과 foreground는 scene viewport 안에서 움직인다

`prop`, `foreground`, `effect`는 scene viewport의 placement 값을 따른다.

이 레이어들은 캐릭터와 같은 좌표계에서 depth로 앞뒤를 정한다.

### 5. Speech area는 별도 책임이다

말풍선은 표시 방식만 바꾼다.

- 기본 말풍선: scene 위 또는 아래에 공간을 차지할 수 있다.
- 하단 대사창: 하단 영역을 차지할 수 있다.
- 겹치는 대사창: overlay로 떠야 하며 scene viewport 크기를 줄이면 안 된다.
- 대사창 숨김: speech DOM만 숨기고 캐릭터/무대 조합 관계를 바꾸지 않는다.

### 6. Editor와 Runtime은 같은 저장값을 같은 의미로 해석한다

무대 조합 설정 화면과 runtime은 다음 값을 같은 의미로 해석해야 한다.

- canvas width/height/aspect ratio
- layer x/y/width/height
- character slot x/y/width/height
- layer role
- layer depth
- fit
- overflow

두 화면의 UI가 같을 필요는 없지만, 같은 저장 데이터가 완전히 다른 시각 결과로 이어지면 안 된다.

## 데이터 흐름

### 저장 방식

Nanika 데이터는 파일 또는 DB에 저장될 수 있다.

Runtime과 devtools는 저장소 세부 구현을 직접 알지 않는다.

```txt
Devtools UI
-> Nanika data client
-> Host or local API
-> NanikaDataAdapter
-> File or DB
```

### 이미지

이미지는 DB에 저장하지 않는다.

DB 또는 file data에는 이미지 경로, URL, key만 저장한다.

Host는 브라우저에서 접근 가능한 asset URL을 제공한다.

### Generated data

파일 모드에서는 generated JSON이 만들어질 수 있다.

DB 모드에서는 같은 내용이 DB row 또는 JSON column에 저장될 수 있다.

두 모드는 data adapter 계약 위에서 같은 결과를 반환해야 한다.

## Mapping 설계 기준

### Mapping은 실행 흐름을 보여줘야 한다

Mapping 화면은 단순 재료 목록이 아니라 실행 흐름을 보여줘야 한다.

권장 흐름:

```txt
Runtime/Profile
-> Condition
-> Character
-> Event
-> Action Flow
-> Resource
```

단, 모든 화면이 이 순서를 강제할 필요는 없다. 저장 결과는 이 흐름으로 해석 가능해야 한다.

### 저장 가능한 최소 조건

Mapping 하나가 runtime에서 의미 있으려면 최소한 다음이 필요하다.

- 대상: runtime 또는 character
- 조건: 항상 실행 또는 page/url/pageId 조건
- 이벤트: 언제 실행되는지
- action: 무엇을 실행하는지

Action이 resource를 필요로 하면 resource key도 필요하다.

예:

- speak -> dialogue category 또는 text
- change expression -> expression key
- surface -> surface id
- scene -> scene id
- menu open -> menu id
- plugin call -> plugin id 또는 capability id

### 카드와 카테고리

카테고리명은 명사 중심으로 둔다.

좋은 예:

- 표정
- 상태
- 대사
- 무대 조합
- 메뉴
- 조건
- 이벤트
- 액션

피할 예:

- 표정 변경
- 메뉴 열기
- 대사 말하기

동사는 action 상세에서 표현한다.

## UI/UX 설계 기준

### 좌에서 우로 흐른다

설정 화면은 가능한 한 다음 흐름을 따른다.

```txt
시작 재료
-> 선택
-> 세부 설정
-> 미리보기
-> 저장 결과
```

### 재료 생성과 조합을 섞지 않는다

캐릭터 재료를 만드는 화면과 mapping으로 재료를 연결하는 화면은 다른 목적을 가진다.

- 캐릭터 설정: 재료 생성 및 캐릭터 귀속 데이터 관리
- 매핑 설정: 만들어진 재료와 기능 연결
- 메뉴 설정: 메뉴 재료 생성
- 런타임 테스트: 실제 실행 확인

### 사용자가 보는 이름은 한국어 우선

저장 key는 영어일 수 있다.

하지만 select, button, 설명, 카드 제목은 한국어 라벨을 우선 제공한다.

### 작업판 중심 화면

Mapping처럼 그래프가 중요한 화면은 작업판이 주 화면이다.

카드덱, 저장 버튼, 도움말, 상세 정보는 작업판을 보조해야 한다.

## 설정 화면 설계 기준

Nanika 설정 화면은 개발자용 도구지만, 코드를 거의 모르는 사용자도 순서를 따라가며 사용할 수 있어야 한다.

설정 화면의 목적은 크게 둘로 나뉜다.

- 재료 만들기: 캐릭터, 이미지, 표정, 상태, 무대 조합, 메뉴 같은 재료를 만든다.
- 재료 연결하기: 만들어진 재료를 runtime profile, mapping, feature set에 연결한다.

두 목적은 한 화면에 섞일 수 있지만, 사용자가 현재 어떤 작업을 하는지 헷갈리면 안 된다.

### 공통 화면 원칙

모든 설정 화면은 다음 정보를 구분해서 보여준다.

- 보유한 재료
- 현재 선택한 재료
- 현재 사용 중인 재료
- 저장될 결과
- 저장 후 runtime에서 적용되는 위치

저장, 다음 단계, 삭제처럼 작업을 끝내는 버튼은 사용자의 시선이 마지막에 머무는 곳에 둔다.

긴 화면에서는 저장 버튼이 화면 밖으로 사라지지 않게 한다. 다만 버튼이 작업판이나 미리보기를 가리면 안 된다.

확대/축소, 미리보기 크기, 현재 선택 정보처럼 자주 쓰는 조작은 작업판 근처에 둔다.

### 캐릭터 설정 화면

캐릭터 설정은 캐릭터 재료를 만드는 화면이다.

이 화면에서 다루는 재료는 다음과 같다.

- 캐릭터 기본 정보
- asset 경로
- base image
- parts image
- expression
- surface
- layer animation
- scene
- hit area
- dialogue

캐릭터 설정 화면은 가벼운 등록 작업과 편집 작업을 구분한다.

가벼운 등록 작업:

- 캐릭터 생성
- 이미지 등록
- 경로 설정
- 표정 이름과 key 등록
- 대사 카테고리 등록

편집 작업:

- crop
- parts 위치/크기 조정
- layer animation 조정
- scene 조합
- hit area 조정

편집 작업은 이미지 작업판이 중심이어야 한다. 설정 폼이나 버튼이 이미지 작업판을 지나치게 좁히면 안 된다.

캐릭터 설정에서 만든 scene은 캐릭터 배경으로만 고정되는 것이 아니라 runtime에서 캐릭터와 함께 쓰이는 scene resource다. 따라서 scene은 base/parts와 같은 단순 이미지처럼 보이더라도 실제로는 배치 정보를 가진 조합 데이터로 설명되어야 한다.

### 무대 조합 설정 화면

무대 조합 설정 화면은 scene resource를 만드는 화면이다.

이 화면의 핵심은 캐릭터 slot과 scene layer를 같은 좌표계에서 배치하는 것이다.

필수 표시:

- scene canvas 영역
- character slot
- background layer
- prop layer
- foreground/effect layer
- layer depth
- fit / overflow

무대 조합 설정 화면의 preview는 runtime 결과와 같은 의미의 저장값을 사용해야 한다.

사용자가 설정한 layer x/y/width/height, character slot, depth, fit, overflow는 runtime에서 다른 의미로 재해석되면 안 된다.

### 매핑 설정 화면

매핑 설정은 재료를 runtime 실행 흐름에 연결하는 화면이다.

이 화면의 주인공은 목록이 아니라 작업판이다.

작업판은 다음 흐름을 시각적으로 보여줘야 한다.

```txt
Runtime/Profile
-> Condition
-> Character
-> Event
-> Action Flow
-> Resource
```

카드덱은 작업판을 보조한다.

카드는 기본적으로 작고 가벼워야 한다. 긴 설명, id, 상세 파라미터는 hover 또는 상세 패널에서 보여준다.

연결 세트와 feature set은 접힌 카드 하나로만 끝나면 안 된다. 사용자가 펼쳤을 때 실제 포함된 연결 흐름을 확인할 수 있어야 한다.

매핑 저장 시에는 profile id 또는 mapping id가 명확해야 한다. Host는 이 id를 기준으로 runtime을 시작할 수 있어야 한다.

### 메뉴 설정 화면

메뉴 설정은 menu resource를 만드는 화면이다.

메뉴 설정 화면은 캐릭터를 직접 연결하지 않는다. 메뉴는 재료이고, 어느 캐릭터/이벤트에서 열지는 mapping이 결정한다.

필수 흐름:

```txt
시작 재료
-> 메뉴 기본 정보
-> 항목 편집
-> 메뉴 트리
-> 저장 JSON
```

메뉴 트리는 한눈에 보여야 한다.

항목 편집은 현재 선택한 메뉴 항목만 다룬다.

상위 항목 추가, 하위 항목 추가, 항목 삭제는 항목 편집 영역에 둔다.

저장/새 메뉴/삭제 같은 메뉴 전체 조작은 화면 우측 상단 또는 별도 저장 섹션에 둔다.

저장 JSON은 readonly preview다. 사용자가 직접 JSON을 수정하게 만드는 것을 기본 흐름으로 두지 않는다.

### 런타임 테스트 화면

런타임 테스트 화면은 기능 시연과 회귀 확인을 위한 화면이다.

테스트 화면은 한눈에 현재 상태를 확인할 수 있어야 한다.

필수 표시:

- 현재 character
- 현재 surface/expression
- 현재 scene
- speech layout
- feature/mapping profile
- 최근 event log
- runtime state

이벤트 로그는 내용이 늘어나도 주변 레이아웃을 흔들면 안 된다.

테스트 버튼은 기능별로 묶되, 실제 사용자 흐름을 검증할 수 있는 smoke test도 제공한다.

### DB / Adapter 설정 화면

DB 설정 화면은 runtime 기능 화면이 아니라 저장소 연결 검증 화면이다.

통신 테스트와 SQL/schema 테스트를 분리한다.

DB 초기화 버튼은 위험 작업이다. 최소 두 번 확인한다.

- 실행 여부 확인
- 기존 데이터 초기화 위험 확인

브라우저 화면에 DB secret을 저장하거나 runtime으로 넘기지 않는다.

## 패키지와 배포 기준

### 패키지 구성

NPM/GitHub dependency로 설치될 때 runtime import가 가능해야 한다.

필수:

- `dist` 생성
- OS 독립 build/postbuild
- public export 정리
- devtools HTML 산출물 포함
- demo asset export 또는 init guide 제공

### Host 통합

Host는 Nanika devtools route를 자동으로 얻지 않는다.

Host가 선택할 수 있는 방식:

- runtime만 import해서 사용
- devtools HTML을 별도 개발 서버로 사용
- host route에서 devtools를 proxy 또는 정적 제공
- host 전용 관리자 페이지로 통합

## 검증 기준

### Runtime UI 변경

다음을 확인한다.

- 캐릭터와 무대 조합이 같은 좌표계로 움직이는지
- background가 의도한 영역을 채우는지
- prop/foreground가 character slot 기준과 맞는지
- speech layout 변경 시 scene viewport 관계가 깨지지 않는지
- speech hidden 시 캐릭터/무대 조합이 떨어지지 않는지
- embed mode에서 mount 밖으로 나가지 않는지

### Devtools UI 변경

다음을 확인한다.

- 글자가 영역 밖으로 나가지 않는지
- 버튼 위치가 화면 흐름과 맞는지
- 저장 버튼이 사용자의 작업 완료 지점 근처에 있는지
- 미리보기와 실제 runtime 결과가 크게 다르지 않은지
- 생성/수정/삭제가 같은 데이터 계약을 사용하는지

### Data 변경

다음을 확인한다.

- file mode와 DB mode가 같은 scope/id/value 계약을 쓰는지
- seed SQL과 schema가 서로 맞는지
- 기본 Rine 데이터가 누락되지 않았는지
- host secret이 browser/runtime으로 노출되지 않는지

## 관련 문서

- `docs/nanika-runtime-layout-contract.md`: 런타임 레이아웃과 임베드 불변조건
- `docs/runtime-embed-guide.md`: host embed 연동 가이드
- `docs/nanika-integration-and-usage-guide.md`: 설치와 사용 가이드
- `docs/nanika-data-adapter.md`: file/DB adapter 계약
- `docs/feature-connection-model.md`: mapping, feature set, action flow 개념
- `docs/nanika-postgres/README.supabase.md`: PostgreSQL/Supabase 사용 가이드

## 변경 원칙

이 문서의 기준과 충돌하는 수정이 필요하면 먼저 설계 변경으로 기록한다.

UI 버그를 고치기 위해 runtime 불변조건을 깨지 않는다.

같은 문제가 반복되면 새 패치 전에 다음을 정리한다.

- 현재 증상
- 이전 가설
- 깨진 불변조건
- 수정할 최소 범위
- 검증할 DOM rect 또는 화면 상태
