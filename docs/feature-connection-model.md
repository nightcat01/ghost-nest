# Nanika Feature Connection Model

이 문서는 나니카 기능 연결 설정의 장기 설계 기준을 정리한다.

목표는 사용자가 캐릭터 설정에서 만든 재료와 런타임 기능을 직접 코딩하지 않고 조립해, 하나의 안정적인 기능 세트로 사용할 수 있게 하는 것이다.

## 사용자 기준 목표

사용자는 내부 용어를 몰라도 다음 질문에 답할 수 있어야 한다.

- 지금 나니카에 어떤 재료와 기능이 있는가?
- 무엇이 어디에 연결되어 있는가?
- 연결되지 않은 재료와 기능은 무엇인가?
- 누구에게, 언제, 어떤 동작을 실행하게 만들 수 있는가?
- 저장한 연결이 실제 런타임에 적용되었는가?

## 핵심 용어

### Preset

캐릭터, 대사, scene, 기능 세트, mapping/rule, 런타임 옵션을 묶은 배포/초기화 단위다.

Preset은 런타임 중 다른 action에서 직접 호출하지 않는다. preset을 preset에 붙이면 순환 참조와 무한 실행 위험이 커지기 때문이다.

### Feature Set

사용자가 만든 재사용 가능한 기능 묶음이다.

예:

- 상담 시작 세트
- 캐릭터 클릭 반응 세트
- idle 반응 세트
- 포춘마스터 홈 화면 세트

Feature Set은 다른 preset에 포함될 수 있지만, 중첩 깊이와 순환 참조를 제한한다.

### Mapping

대상, 실행 조건, 실행 흐름을 연결하는 사용자 친화적 설정이다.

내부적으로는 RuntimeRule로 변환될 수 있다.

### Action Flow

실행할 동작의 순서와 묶음을 표현한다.

단일 action만 나열하는 구조가 아니라, 순차/동시/랜덤 실행을 제한된 깊이 안에서 표현할 수 있어야 한다.

### Plugin

코드로 기능을 추가하는 확장 모듈이다.

사용자가 만드는 기능 세트와 런타임 플러그인은 구분한다.

## 기본 구조

```txt
Preset
├─ Character
├─ Dialogue
├─ Scene / Surface / Layer
├─ Plugin
├─ Feature Set
└─ Runtime Options

Feature Set
└─ Mapping[]

Mapping
├─ target
├─ trigger
└─ actionFlow

Action Flow
├─ action
└─ group
   ├─ sequence
   ├─ parallel
   └─ random
```

## Scene 조합과의 대응

기능 연결은 scene 조합과 같은 패턴을 따른다.

```txt
Scene
단일 이미지 -> scene layer -> scene group -> 하나의 시각 단위처럼 사용

Feature Connection
단일 action -> action step -> action group/flow -> 하나의 기능 연결처럼 사용
```

즉 편집 도구는 그룹을 만들고, 런타임은 그룹을 하나의 실행 단위처럼 사용한다.

## 기존 데이터 재사용

기능 연결 화면은 새 데이터를 많이 만들기보다 기존 데이터를 빠르게 가져와 조립해야 한다.

직접 문자열 입력보다 가능한 select/list를 우선한다.

- `surface.id`는 캐릭터 surface 목록에서 선택한다.
- `scene.id`는 캐릭터 scene 목록에서 선택한다.
- `change_expression.expression`은 expression 목록에서 선택한다.
- `play_layer_animation.layerId`는 layer 목록에서 선택한다.
- `speak.category`는 대사 카테고리 목록에서 선택한다.
- `call_plugin.pluginId`는 plugin/capability 목록에서 선택한다.

## 연결 현황 화면

기능 연결 설정의 첫 화면은 편집기가 아니라 현재 연결 지도를 보여줘야 한다.

큰 단위:

- Runtime
- Character
- Speech / Balloon
- UI / Menu
- Plugin
- Mapping / Rule
- Saved Feature Set

각 단위는 다음 상태를 구분해 보여준다.

- 연결됨
- 연결 안 됨
- 저장됨
- 실제 적용됨
- 적용되지 않음
- 위험 또는 제한 초과

## 저장과 적용 상태

저장된 연결과 실제 런타임에 적용된 연결은 다르다.

화면에서는 다음 상태를 분리한다.

- 편집 중
- 저장됨
- 적용됨
- 저장되었지만 미적용
- 현재 preset과 충돌

## 제한 규칙

무한 조합 구조를 허용하지 않는다.

초기 권장 제한:

- 기능 연결 1개당 실행 단계 최대 8개
- 그룹 깊이 최대 2단계
- 한 그룹 안 action 최대 6개
- 랜덤 후보 최대 8개
- 동시에 실행할 action 최대 5개
- 기능 연결 1개당 전체 action 총합 최대 24개
- feature set 중첩 깊이 최대 2단계

Preset 제한:

- preset은 런타임 중 직접 호출하지 않는다.
- preset 안에 feature set을 포함할 수는 있다.
- feature set 간 순환 참조는 저장 전과 실행 중 모두 막는다.

## 실행 안전 장치

런타임은 다음 guard를 가져야 한다.

- 같은 실행 체인에서 같은 rule 반복 실행 제한
- `emit_event`로 인한 이벤트 재발행 깊이 제한
- feature set 순환 참조 차단
- action group 중첩 깊이 제한
- 동시에 active timer 수 제한
- 실행 로그에 rule id, feature set id, action index 기록

## 포춘마스터 MVP 기준

다음 주말 전 실사용 목표는 완전한 빌더가 아니라 포춘마스터에 붙일 수 있는 최소 실전 연결 세트다.

필수 흐름:

- page enter 시 기본 scene/surface 표시
- character click 시 대사 출력
- character click 또는 menu click 시 surface 변경
- 대사 중 mouth layer animation 실행
- idle 시 blink/layer animation 실행
- 필요 시 neutral/idle 상태로 복귀

## UI 원칙

- 내부 용어를 그대로 노출하지 않는다.
- `Draft`는 화면에서 `저장된 연결` 또는 `편집 중인 연결`로 표현한다.
- `Rule`은 `실행 규칙`으로 표현한다.
- `Mapping`은 `기능 연결`로 표현한다.
- 사용자는 `누구에게 / 언제 / 무엇을 / 어떤 순서로`만 고르면 된다.
- 설명은 카드 안에 길게 넣지 않고 hover/focus/click 도움말로 분리한다.
- 연결 지도에서 필요한 항목을 고르면 매핑 편집기로 자연스럽게 진입해야 한다.

