# Nanika Runtime Layout Contract

이 문서는 Nanika 런타임에서 캐릭터, 무대 조합, 말풍선, 임베드 영역이 어떤 기준으로 배치되어야 하는지 정의한다.

이 문서의 목적은 특정 화면 하나를 맞추는 것이 아니라, 런타임 배치가 반복해서 깨지지 않도록 불변조건과 검증 기준을 고정하는 것이다.

## 핵심 결론

Nanika에서 `캐릭터 + 파츠 + 무대 조합`은 하나의 시각 덩어리다.

임베드 영역이 작아지거나 말풍선 배치가 바뀌어도 캐릭터와 무대 조합은 서로 떨어져서는 안 된다. 전체 덩어리가 같은 기준점에서 함께 작아지거나, 같은 기준점에서 함께 이동해야 한다.

따라서 런타임 배치 문제를 고칠 때는 `캐릭터 크기`, `scene layer 위치`, `말풍선 높이`, `bottom 값` 같은 개별 증상부터 고치지 않는다. 먼저 캐릭터와 무대 조합이 같은 좌표계를 쓰는지 확인한다.

## 용어

### Runtime Mount

호스트 앱이 Nanika를 넣어주는 최상위 영역이다.

예:

- 제품 페이지의 특정 div
- 데모 페이지의 임베드 박스
- 전체 화면 런타임 영역

호스트는 이 영역의 위치, 크기, z-index, overflow를 책임진다.

### Runtime Stage

Nanika가 mount 내부에 만드는 실제 런타임 stage다.

Stage는 두 방식으로 동작할 수 있다.

- `floating`: 화면 또는 컨테이너 안의 특정 위치에 떠 있는 캐릭터 런타임
- `fill`: host가 제공한 mount 영역 전체를 사용하는 임베드 런타임

### Scene Viewport

캐릭터, 파츠, 무대 조합이 함께 들어가는 단일 시각 좌표계다.

Scene viewport는 다음 요소의 기준이다.

- 캐릭터 base 이미지
- 캐릭터 파츠 이미지
- 무대 조합 background / prop / foreground / effect layer
- character slot
- clipping 영역

### Speech Area

말풍선, 대사창, 메뉴 UI가 표시되는 영역이다.

Speech area는 scene viewport와 별도의 책임을 가진다. Speech layout은 scene viewport의 좌표계를 바꾸면 안 된다.

## 절대 불변조건

### 1. 캐릭터와 무대 조합은 같은 좌표계를 써야 한다

캐릭터 sprite와 scene layer는 같은 `scene-viewport` 안에서 해석되어야 한다.

허용:

- 임베드 영역이 작아서 캐릭터와 무대 조합이 함께 축소됨
- 하단 대사창이 실제 공간을 차지해서 scene viewport 전체 높이가 줄어듦
- 무대 조합의 특정 layer가 `overflow: hidden`으로 잘림

금지:

- 캐릭터는 하단 기준으로 움직이고 무대 조합은 중앙 기준으로 움직임
- 무대 조합을 켰다는 이유로 캐릭터 위치가 별도 계산으로 바뀜
- 말풍선 크기 변경 때문에 캐릭터와 무대 조합의 기준 폭이 달라짐
- scene이 있을 때와 없을 때 캐릭터가 viewport 밖으로 빠짐

### 2. 무대 조합은 캐릭터를 밀어내거나 캐릭터 배치 계산을 바꾸면 안 된다

무대 조합은 캐릭터와 같은 좌표계에 추가되는 layer 그룹이다.

무대 조합이 추가되어도 다음은 유지되어야 한다.

- 캐릭터의 기준 좌표계
- 캐릭터 파츠의 base 기준 위치
- character placement 또는 character slot의 의미
- speech layout의 의미

### 3. 말풍선은 캐릭터 + 무대 조합 좌표계를 흔들면 안 된다

말풍선 layout은 표시 방식만 결정한다.

- 기본 말풍선: speech가 실제 공간을 차지할 수 있다.
- 하단 대사창: speech가 실제 하단 공간을 차지할 수 있다.
- 겹치는 대사창: speech는 overlay로 떠야 하며 scene viewport 크기를 줄이면 안 된다.
- 말풍선 숨김: speech가 없어져도 캐릭터와 무대 조합 관계는 변하면 안 된다.

특히 `speechBalloonSize`, `speechStageWidth`, `speechDialogueWidth` 같은 설정이 캐릭터+무대조합 덩어리의 기준 폭을 줄이면 안 된다.

### 4. 임베드 모드는 mount 영역을 기준으로 계산한다

임베드 모드의 가장 큰 기준은 host가 제공한 mount 영역이다.

`stageMode: "fill"`에서는 Nanika가 mount 영역 내부에서 동작해야 한다. 화면 전체나 문서 body를 기준으로 계산하면 안 된다.

임베드 영역이 작으면:

- scene viewport가 비율을 유지하며 줄어들 수 있다.
- 캐릭터와 무대 조합이 함께 줄어들 수 있다.
- 말풍선이 별도 영역으로 공간을 차지할 수 있다.

하지만 다음은 안 된다.

- 캐릭터와 무대 조합이 서로 다른 기준으로 줄어듦
- scene viewport만 줄고 캐릭터가 밖으로 빠짐
- 대사창이 mount 밖으로 나감
- 메뉴 UI hover 때문에 stage 높이가 흔들림

### 5. 편집 화면과 런타임은 같은 저장값을 같은 의미로 해석한다

무대 조합 설정 화면에서 저장한 값은 런타임에서 같은 의미로 보여야 한다.

비교해야 할 값:

- scene canvas width / height / aspect ratio
- character slot x / y / width / height
- layer x / y / width / height
- depth
- role
- fit
- overflow

편집 화면과 런타임이 완전히 같은 UI일 필요는 없다. 하지만 같은 저장값의 시각 의미는 같아야 한다.

## 배치 책임 분리

## Host 책임

Host 앱은 Nanika 바깥 영역을 책임진다.

- mount 위치와 크기
- mount overflow
- page z-index
- host theme token
- public asset URL 제공
- runtime profile 또는 mapping 선택

Host CSS는 Nanika 내부 좌표계를 직접 덮어쓰면 안 된다.

## Nanika Runtime 책임

Nanika runtime은 mount 내부를 책임진다.

- runtime stage 생성
- scene viewport 계산
- character sprite 배치
- parts 배치
- scene layer 배치
- speech layout 적용
- management menu 배치
- runtime ready / hide 상태

## Devtools 책임

Devtools는 데이터를 만들고 검증하는 도구다.

- 캐릭터 생성
- 표정/상태/파츠/무대 조합 생성
- 히트박스 설정
- 매핑 설정
- 메뉴 설정

Devtools CSS가 런타임 동작의 숨은 전제가 되면 안 된다.

## Scene Viewport 규칙

### 기본 규칙

`scene-viewport`는 캐릭터와 무대 조합의 공통 부모 박스다.

런타임에서 다음 요소는 scene viewport 안에 있어야 한다.

- `.character-sprite`
- `.scene-layer-root-back`
- `.scene-layer-root-front`
- `.scene-composition-layer`

### Character Slot이 있는 경우

무대 조합에 character slot이 있으면 캐릭터는 해당 slot의 x/y/width/height를 기준으로 배치된다.

이 경우 generic `bottom-center`, `bottom-right` 같은 placement는 character slot보다 우선하면 안 된다.

### Character Slot이 없는 경우

scene이 없거나 character slot이 없는 경우에만 runtime placement fallback을 사용한다.

fallback의 기본값은 `bottom-center`를 권장한다.

### Scene Viewport와 이미지 비율

scene viewport는 저장된 canvas 비율을 기준으로 mount 내부에서 계산한다.

비율 때문에 남는 공간이 생길 수 있다. 하지만 viewport 안의 캐릭터와 무대 조합은 서로 같은 기준으로 렌더링되어야 한다.

## Speech Layout 규칙

### 기본 말풍선

기본 말풍선은 scene 위나 옆에 표시될 수 있다.

다만 캐릭터와 무대 조합이 분리되면 안 된다.

### 하단 대사창

하단 대사창은 실제 하단 공간을 차지할 수 있다.

이 경우 scene viewport가 줄어들 수 있지만, 캐릭터와 무대 조합은 줄어든 viewport 안에서 함께 움직여야 한다.

### 겹치는 대사창

겹치는 대사창은 overlay다.

겹치는 대사창은 scene viewport의 크기나 기준점을 바꾸면 안 된다.

### 말풍선 숨김

말풍선이 숨겨져도 scene viewport와 캐릭터+무대 조합 관계는 바뀌면 안 된다.

말풍선 숨김은 speech DOM 표시만 변경한다.

## 임베드 모드 규칙

### Fill Stage

`data-stage-mode="fill"` 상태에서는 runtime stage가 mount 내부 전체를 사용한다.

금지되는 stage inline style:

- `left`
- `right`
- `top`
- `bottom`
- `transform`

위 값은 floating stage에서만 의미가 있다.

### Embed Size Calculation

임베드에서는 다음 순서로 계산한다.

1. mount rect 확인
2. speech layout이 실제 공간을 차지하는지 확인
3. scene viewport에 사용할 available rect 계산
4. saved scene canvas ratio 적용
5. character slot과 scene layers를 같은 viewport 기준으로 배치
6. speech를 별도 규칙으로 배치

## 검증 기준

런타임 배치 관련 수정은 최소한 다음 조합을 확인한다.

| 구분 | scene 없음 | scene 있음 |
| --- | --- | --- |
| 기본 말풍선 | 확인 | 확인 |
| 하단 대사창 | 확인 | 확인 |
| 겹치는 대사창 | 확인 | 확인 |
| 말풍선 숨김 | 확인 | 확인 |
| 메뉴 UI 열림 | 확인 | 확인 |

각 조합에서 확인할 DOM rect:

- mount
- runtime stage
- scene viewport
- character sprite
- character base image
- scene layer root back
- scene layer root front
- scene composition layer
- speech balloon
- action menu

각 조합에서 확인할 상태:

- 캐릭터와 무대 조합이 같은 viewport 기준으로 움직이는가
- 겹치는 대사창이 scene viewport를 줄이지 않는가
- 하단/상단 대사창에서만 speech가 실제 공간을 차지하는가
- speech width 변경이 scene viewport width를 줄이지 않는가
- 말풍선 숨김 상태에서도 scene viewport와 캐릭터 위치가 흔들리지 않는가
- scene이 있을 때 캐릭터가 viewport 밖으로 빠지지 않는가
- scene이 없을 때 기존 캐릭터 배치가 깨지지 않는가

## Rework Stop Rule

같은 배치 문제가 2회 이상 반복되면 패치 전에 아래를 먼저 작성한다.

- 최신 증상
- 이전 가설
- 이전 가설과 최신 증상의 충돌점
- 이번에 지켜야 할 불변조건
- 이번 검증에서 비교할 DOM rect

같은 배치 문제가 3회 이상 반복되면 사용자와 원인 가설을 다시 맞추기 전에는 파일을 수정하지 않는다.

## 금지되는 해결 방식

- 편집 화면 CSS class를 런타임 DOM에 그대로 붙여서 맞추기
- host CSS로 Nanika 내부 layout selector를 덮어쓰기
- 말풍선 크기 문제를 character sprite 크기 변경으로 해결하기
- 무대 조합 문제를 scene layer의 개별 left/top 보정으로만 해결하기
- build/check 통과만으로 시각 검증 완료라고 보고하기
- 한 화면만 맞고 다른 speech layout을 검증하지 않는 것

## 완료 기준

이 계약에 관련된 수정은 다음 조건을 만족해야 완료로 본다.

- 캐릭터와 무대 조합이 같은 scene viewport 기준으로 렌더링된다.
- 기본/하단/겹침/숨김 speech layout에서 캐릭터와 무대 조합이 분리되지 않는다.
- 편집 화면과 런타임이 같은 저장값을 같은 의미로 해석한다.
- 임베드 모드에서 mount 영역 밖으로 대사창, 캐릭터, 무대 조합이 새지 않는다.
- 브라우저 또는 DOM rect 검증 결과를 보고에 포함한다.
## Regression Lock: Character Slot Rendering

The character slot rendering rule must not be changed casually.

When a scene has a `character` layer with percent placement, the runtime character base image must be rendered with the same visual rule as the stage composition editor preview:

- the character slot is the clipping box
- the base image is placed from the top-left of the slot
- the base image keeps its natural ratio by using the slot width as the primary fit size
- overflowing image height is clipped by the character slot
- character parts use the same calculated image frame as the base image

Do not switch this path back to a generic `contain` fit only to solve a scene layer issue. If background, prop, or speech layout has a problem, debug that layer separately while preserving this character slot contract.
