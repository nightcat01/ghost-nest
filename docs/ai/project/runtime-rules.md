# GhostNest Runtime Rules

GhostNest 런타임은 다음 흐름을 기준으로 동작한다.

```txt
event -> rule -> action -> runtime/plugin/adapter -> character output
```

## Event

클릭, 우클릭, hover, idle, 외부 호출 같은 입력이다.

## Rule

이벤트가 발생했을 때 조건을 확인하고 액션 배열을 실행한다.

Rule은 실행 가능한 최종 형태이고, 사용자 화면에서는 `실행 규칙`으로 표현한다.

## Action

나니카가 수행하는 공통 명령이다.

액션은 가능한 작고 조합 가능해야 한다.

## Action Flow

사용자 편집 화면에서는 여러 Action을 실행 흐름으로 조립한다.

실행 흐름은 다음 모드를 가질 수 있다.

- 순서대로 실행
- 동시에 실행
- 랜덤으로 하나 실행

단, 무한 중첩 구조는 허용하지 않는다.

초기 제한 기준:

- 기능 연결 1개당 실행 단계 최대 8개
- 그룹 깊이 최대 2단계
- 한 그룹 안 action 최대 6개
- 랜덤 후보 최대 8개
- 동시에 실행할 action 최대 5개
- 전체 action 총합 최대 24개

## Feature Set

Feature Set은 여러 mapping/action flow를 묶어 preset에 포함할 수 있는 설정 단위다.

Feature Set은 재사용할 수 있지만 순환 참조를 허용하지 않는다.

저장 전과 실행 중 모두 순환 검사를 수행해야 한다.

Feature Set은 다음 두 종류로 나눌 수 있다.

- 캐릭터 전용 세트: 특정 캐릭터 설정의 expression, scene, surface, layer, dialogue, hit area를 직접 참조한다.
- 캐릭터 미지정 템플릿 세트: 이벤트와 action flow는 유지하되 캐릭터 리소스는 의미 기반 requirement로 표현한다.

캐릭터 미지정 템플릿 세트를 실제 캐릭터에 적용할 때는 호환성 검사를 수행한다.

- 필요한 expression이 있는가
- 필요한 scene/surface/layer가 있는가
- 필요한 dialogue category가 있는가
- 필요한 hit area가 있는가
- 특정 캐릭터에만 있는 리소스를 참조하지 않는가

호환되지 않는 항목은 실행 전에 "사용 가능 / 일부 사용 불가 / 사용 불가" 상태로 표시한다.

## Plugin

외부 기능 실행 경계다.

API, DB, AI, 게임, 상점 같은 기능은 런타임 코어가 아니라 plugin 또는 adapter로 감싼다.

## Output

최종 결과는 대사, 표정, surface, layer animation, 메뉴, UI, 알림 등으로 표현한다.

## 원칙

- 외부 기능은 core/runtime에 직접 넣지 않는다.
- 새로운 행동이 여러 곳에서 재사용될 수 있으면 RuntimeAction 후보로 본다.
- 특정 서비스 의존성이 있으면 RuntimePlugin 후보로 본다.
- 그래프 편집기, Mermaid 시각화, 설정 생성 UI는 RuntimeAction 후보가 아니라 plugin/devtools 후보로 본다.
- 대사 생성 방식은 DialogueEngine으로 분리한다.
- 저장소는 StorageAdapter로 분리한다.
- Preset은 배포/초기화 단위이며 action에서 직접 호출하지 않는다.
- Runtime 중 재사용 가능한 묶음은 Preset이 아니라 Feature Set으로 분리한다.
- `emit_event`와 Feature Set 호출은 실행 깊이, 반복 실행, 순환 참조 guard를 가져야 한다.
- 실행 로그는 rule id, feature set id, action index를 추적할 수 있어야 한다.
