# A2A Workflow

## Common/Project Separation Rule

Common harness documents must stay project-agnostic.

- Do not add product names, repository-specific paths, domain object names, UI page names, generated file names, or project-only workflows to `docs/ai/common/*` or generic `docs/ai/roles/*`.
- Put project-specific nouns, data models, screen names, execution names, asset names, and save/load details in `docs/ai/project/*`.
- When a rule is useful everywhere, describe it as a general invariant. When it needs examples from one project, move those examples to the project harness.
- Before changing harness files, classify each new rule as `common`, `role`, or `project`. If the same paragraph contains both general and project-specific rules, split it.

## User Path Coverage Rule

For normal or risky work, especially UI, settings, mapping, workflow, save/delete, or generated-data changes, the A2A flow must verify the user's actual path, not only the internal implementation.

- Planner defines the latest user-facing path before implementation starts.
- Worker implements against that path and records any assumptions.
- Reviewer checks whether the implementation answers the latest user complaint rather than an older or narrower symptom.
- UX Checker verifies discoverability from the user's starting point when a screen or interaction is involved.
- Tester runs or explicitly marks the concrete path as unverified.
- Final reports separate `verified paths` from `unverified paths`.

If a path cannot be verified because tooling is unavailable, report it as a remaining risk instead of treating static checks as completion.

이 문서는 역할 기반 AI 작업 흐름의 공통 운영 기준이다.

## 목표

하나의 AI가 모든 역할을 동시에 수행하면서 생기는 자기 정당화, context drift, UX 누락, 구조 경계 침범을 줄인다.

작업은 필요한 역할만 참여시키고, 위험도가 올라갈 때만 검토 역할을 추가한다.

## 위험도 분류

### trivial

작고 영향 범위가 명확한 작업이다.

예시:

- 오타 수정
- 문구 변경
- 작은 CSS spacing 수정
- 명백한 타입 오류 수정
- 단일 문서의 작은 보강

참여 역할:

- Worker
- Tester light

### normal

단일 기능 또는 단일 화면 안에서 영향이 제한되는 작업이다.

예시:

- 단일 옵션 추가
- 단일 내부 도구 또는 관리 화면 보강
- 기존 액션 사용처 추가
- 작은 API 호출 경로 추가
- 문서 구조 추가

참여 역할:

- Planner
- Worker
- Reviewer
- Tester

### risky

공통 구조, 런타임 동작, 저장/삭제, 사용자 흐름에 영향을 줄 수 있는 작업이다.

예시:

- 공통 실행 계층, core, service layer 변경
- 공통 UI 또는 레이아웃 변경
- 저장, 삭제, 파일 생성, 자동 반영
- 외부 임베드 영향
- 모바일/데스크톱 레이아웃 영향
- 기존 사용자 흐름 변경
- 도메인 모델, 렌더링 리소스, 설정 데이터 구조 변경

참여 역할:

- Planner
- Worker
- Reviewer
- Tester
- 필요한 특화 역할

## 특화 역할 추가 기준

| 상황 | 추가 역할 |
| --- | --- |
| 영역 경계가 애매하거나 공통 실행 계층으로 번질 수 있음 | Boundary Checker |
| UI, 메뉴, 오버레이, 반응형 레이아웃 영향 | UX Checker |
| 이벤트, 플러그인, 액션, 설정 매핑 영향 | Mapping Designer |
| 저장, 삭제, 파일 생성, 자동 반영, generated 파일 영향 | Data Safety Checker |

## Escalation 기준

작업 중 다음 상황이 발견되면 즉시 위험도를 올리고 필요한 역할을 추가한다.

- 처음 예상보다 수정 파일이 늘어남
- 공통 실행 계층, core, service layer 변경이 필요해짐
- 공통 UI 규칙 또는 레이아웃에 영향이 생김
- 저장/삭제/생성 동작이 포함됨
- 기존 사용자 흐름이 바뀜
- 빌드나 타입은 통과하지만 화면 결과가 어색함
- 사용자가 작업 종료 지점에서 저장, 삭제, 다음 이동 같은 완료 액션을 찾기 어려움
- 반복 조작 중 깜빡임, layout shift, 스크롤 역행이 발생함
- 기존 데이터 또는 사용자가 만든 설정을 덮어쓸 가능성이 있음

## 역할 참여 원칙

- Worker는 모든 실행에 참여한다.
- Tester light는 trivial 작업의 종료 체크리스트로 취급한다.
- Planner는 normal 이상에서 참여한다.
- Reviewer는 normal 이상에서 참여한다.
- UX Checker는 UI 영향이 있을 때만 참여한다.
- Tester full은 normal 이상 또는 risky 작업에서 참여한다.

## 실행 게이트

하네스 문서는 참고 자료가 아니라 단계 전환 조건으로 사용한다.

대화가 설계, 방향성, 개념 정리, 가능성 검토 단계라면 바로 소스를 수정하지 않는다.

소스 수정은 다음 중 하나가 명확할 때 시작한다.

- 사용자가 구현, 수정, 적용, 진행을 명시했다.
- 이미 합의된 작업 목록의 실행 단계에 들어왔다.
- 버그 재현과 수정 요청이 명확하고, 추가 설계 확인이 필요하지 않다.

소스 수정 전에는 작업을 큰 단위와 작은 단위로 나눈다.

- 큰 단위: 사용자가 이해할 수 있는 목표 묶음이다.
- 작은 단위: 실제 파일 수정, 검증, 데이터 확인이 가능한 실행 조각이다.
- 구현은 작은 단위 기준으로 진행한다.
- 보고는 큰 단위 기준의 위치와 작은 단위 완료 결과를 함께 남긴다.

normal 이상 작업에서는 구현 전에 반드시 다음 3줄을 내부 기준으로 확정한다.

- 위험도: trivial, normal, risky 중 무엇인가
- 참여 역할: Worker 외에 어떤 역할이 필요한가
- 완료 조건: 어떤 사용자 시나리오 또는 시스템 상태가 유지되어야 하는가

UI 작업에서는 구현 전에 최소 1개의 UX 불변조건을 적는다.

예시:

- hover 전후 내부 스크롤 컨테이너의 `scrollTop`이 의도치 않게 바뀌지 않아야 한다.
- 긴 텍스트가 들어와도 부모 패널 높이가 의도치 않게 접히거나 펼쳐지지 않아야 한다.
- 저장 후 선택 목록과 미리보기가 같은 데이터를 가리켜야 한다.

이 불변조건은 완료 보고에서 검증 결과와 함께 다시 확인한다.

## 반복 실패 게이트

같은 문제를 두 번 이상 수정하거나, 사용자가 "아직 아니다", "다시 확인", "구현이 잘못됐다", "확인이 안 된다"에 가까운 피드백을 주면 즉시 rot checkpoint를 수행한다.

반복 실패 게이트에서는 추가 수정을 바로 하지 않고 다음을 먼저 확인한다.

- 원래 재현 시나리오를 정확히 문장으로 썼는가
- 이전 수정이 어떤 가설에 근거했는가
- 그 가설이 사용자 피드백과 충돌하는가
- 관련 DOM, 상태, 저장, 이벤트 흐름 중 실제 원인이 어디에 있는가
- 다음 수정의 성공/실패를 어떻게 관찰할 것인가

이 게이트를 통과하지 못하면 코드를 더 수정하지 않고 미검증 리스크로 남긴다.

## 컨펌 없는 순차 진행

사용자가 "컨펌 없이 순차적으로 진행"을 요청하면 매 단계마다 승인을 기다리지는 않는다.

대신 단계 종료 지점마다 짧은 진행 보고를 남겨 self A2A의 자기 정당화와 검증 누락을 줄인다.

컨펌 없음은 조용히 끝까지 밀어붙이라는 뜻이 아니다.

별도의 지시가 없는 한, 한 번 시작한 큰 단위는 그 안의 작은 단위까지 마무리한다.

단, 다음 상황에서는 큰 단위 진행 중이어도 멈추고 escalation 보고를 남긴다.

- 사용자 의도와 충돌하는 새 요구가 발견됨
- 데이터 삭제, 계정/권한, 비용, 외부 전송처럼 되돌리기 어려운 영향이 생김
- 처음 범위를 넘어서는 구조 변경이 필요함
- 검증 실패가 다음 작은 단위의 전제를 무너뜨림
- 같은 실패가 반복되어 rot checkpoint가 필요함

작업자는 다음 원칙을 따른다.

- 큰 단계는 유지하되 구현은 작은 조각으로 나눈다.
- 각 단계의 완료는 전체 완료로 확대하지 않는다.
- 단계 보고는 승인 요청이 아니라 작업 경계, 검증 근거, 남은 위험을 남기는 장치다.
- 미검증 항목을 다음 단계의 전제로 삼지 않는다.
- 검증할 수 없는 항목은 남은 리스크로 적고, 해결된 것처럼 말하지 않는다.

단계 종료 보고에는 다음 항목을 포함한다.

- 완료한 것: 실제 변경 또는 확인한 내용
- 검증한 것: 실행한 명령, API 응답, 화면 확인, 데이터 확인
- 단계 상태: 전체 단계 중 완료/진행 중/남은 단계를 짧게 표시
- 남은 단계: 큰 단계 목록이 있다면 생략하지 않는다
- 남은 리스크: 아직 확인하지 못한 화면, 시나리오, 데이터 상태
- 다음 단계 판단: 다음 단계에서 반드시 확인할 것 또는 진행해도 되는 이유

보고는 사용자 컨펌을 요구하기 위한 것이 아니라 작업 경계와 미검증 항목을 남기기 위한 것이다.

다음 경우에는 컨펌 없는 진행 중이어도 escalation 보고를 먼저 남긴다.

- 단계 목표가 바뀌거나 새 설계가 필요해짐
- 저장/삭제/생성 범위가 처음보다 커짐
- 공통 실행 계층 또는 공통 UI에 새 영향이 생김
- 이전 단계에서 미검증으로 남긴 항목이 다음 단계의 전제가 됨
- 같은 실패를 두 번 이상 반복함

## 장기 기능 작업 운영

여러 단계에 걸친 UI, 런타임, 데이터 모델 작업은 normal이 아니라 risky에 가깝게 취급한다.

특히 다음 작업은 Planner, Worker, Reviewer, Tester 외에 필요한 특화 역할을 함께 적용한다.

- 기능 연결 또는 자동화 설정
- 도메인 설정 편집기
- initial configuration bundle, reusable feature bundle, mapping, action flow 같은 조립형 설정 변경
- 외부 임베드 또는 외부 사이트 적용
- 저장/적용/내보내기 구조 변경

장기 기능 작업에서는 각 단계마다 다음을 확인한다.

- 사용자 목표가 바뀌지 않았는가
- 내부 용어가 사용자 화면에 그대로 노출되지 않았는가
- 현재 구현이 장기 모델을 막는 임시 구조를 만들지 않았는가
- 제한, 순환 참조, 저장/적용 상태 구분이 고려되었는가
- 화면 검증과 데이터 검증을 분리했는가

## Self A2A 안정성 점검

normal 이상 작업, 긴 작업, 재개된 작업, 반복 수정 작업에서는 `self-a2a-failure-modes.md`를 함께 확인한다.

완료 보고 전에는 `quality-gates.md`를 확인해 기능 구현, UI 안정성, 데이터 흐름 검증을 분리해서 판단한다.

특히 다음 문제를 의식적으로 점검한다.

- 역할이 섞여 Worker가 Reviewer나 Tester 결론까지 대신 내리고 있지 않은가
- 앞 단계 결론을 반복하면서 검토가 약해지고 있지 않은가
- 오래된 대화나 이전 파일 상태를 현재 사실처럼 취급하고 있지 않은가
- 검증하지 않은 내용을 통과한 것처럼 말하고 있지 않은가

## 결과 기록

각 단계 결과는 다음을 남긴다.

- 어떤 역할 기준을 적용했는가
- 완료한 것은 무엇인가
- 검증한 것은 무엇인가
- 전체 단계 중 어디까지 왔고 남은 단계는 무엇인가
- 어떤 위험이 발견되었는가
- 남은 리스크는 무엇인가
- 다음 단계에서 확인할 것은 무엇인가

전체 작업이 실제로 끝났다면 `quality-gates.md`의 최종 완료 보고 기준에 따라 최종 범위, 주요 변경 파일, 검증, 화면 확인 여부, 남은 리스크, 다음 작업을 보고한다.

단계 일부만 끝난 경우에는 최종 완료 보고로 표현하지 않는다.

응답이 중간에 종료되는 경우에도 "이번 응답에서 어디까지 했고, 전체에서 무엇이 남았는지"를 반드시 남긴다.

특히 장기 작업에서는 구현 결과만 보고하지 않는다. 다음 정보를 누락하면 보고 실패로 본다.

- 전체 큰 단계 목록 또는 현재 알고 있는 남은 단계
- 완료한 단계와 완료하지 않은 단계의 구분
- 다음에 바로 이어갈 단계
- 미검증 항목과 실패한 검증
- 전체 완료가 아닌 경우 "부분 완료"라는 상태
