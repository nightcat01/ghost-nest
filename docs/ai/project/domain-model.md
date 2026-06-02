# GhostNest Domain Model

이 문서는 GhostNest 전용 도메인 용어를 정리한다.

## Character

나니카로 표시할 캐릭터 단위다.

포함 요소:

- profile
- lines
- assets
- expressions
- surfaces
- scenes
- hit areas

## Expression

대사나 상태에 연결되는 표정 이름이다.

단일 이미지 또는 여러 이미지 후보를 가질 수 있다.

## Surface

실제 렌더링에 가까운 캐릭터 상태 단위다.

이미지 하나, scene visual, layer 조합을 포함할 수 있다.

## Scene

배경, 소품, FX, 캐릭터 슬롯처럼 여러 시각 요소를 위치와 크기와 함께 묶은 조합이다.

이미지처럼 선택될 수 있지만 실제로는 이미지 그룹이다.

## Layer

눈, 입, 장식, 소품 같은 부분 이미지 또는 프레임 애니메이션 단위다.

## Action

나니카가 수행하는 최소 행동 명령이다.

예:

- speak
- surface
- call_plugin
- navigate
- change_speech_layout

## Plugin

외부 API, DB, AI, 미니게임, 서비스 기능을 감싸는 실행 단위다.

나니카는 `call_plugin` 액션으로 호출한다.

## Feature Set

사용자가 만든 기능 연결 묶음이다.

코드 확장인 Plugin과 구분한다.

캐릭터 재료, 대사, scene/layer, UI, plugin capability, action flow를 조립해 preset에 포함할 수 있는 설정 단위다.

Feature Set은 재사용 가능하지만 무한 중첩되면 안 된다.

## Mapping

이벤트와 조건을 액션 배열에 연결하는 화면 친화적 구조다.

런타임에서는 `RuntimeRule`로 변환된다.

사용자 화면에서는 `기능 연결`로 표현한다.

포함 요소:

- 적용 대상
- 실행 조건
- 실행 흐름
- 저장/적용 상태

## Action Flow

Mapping 안에서 실행할 동작의 순서와 묶음을 표현한다.

단일 action 배열뿐 아니라 제한된 범위의 순차, 동시, 랜덤 그룹을 포함할 수 있다.

그룹 깊이와 action 수는 제한해야 한다.

## Preset

캐릭터, 플러그인, mapping/rule, 런타임 옵션을 하나의 실행 단위로 묶은 것이다.

Preset은 배포와 초기화 단위다.

런타임 중 다른 action에서 preset 자체를 직접 호출하지 않는다.

## Registry

개발자 도구 화면이 사용할 캐릭터, 기능, 이벤트, 액션, 매핑 목록을 한 곳에서 모아 제공하는 입구다.
