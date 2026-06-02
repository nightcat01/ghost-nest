# AI Workflow Harness

이 폴더는 AI가 작업을 역할별로 나누어 수행하기 위한 기본 A2A 지침을 둔다.

`AGENTS.md`는 항상 적용되는 공통 개발 규칙이고, 이 폴더의 문서는 작업 성격에 따라 추가로 참조하는 역할별 하네스다.

## 기본 구조

| 경로 | 역할 |
| --- | --- |
| `common/a2a-workflow.md` | 위험도 분류, 역할 참여 기준, escalation 규칙 |
| `common/risk-levels.md` | 공용 위험도 기준과 승격 조건 |
| `common/boundary-principles.md` | 책임 경계와 공통 영역 오염 방지 원칙 |
| `common/review-principles.md` | 리뷰 역할의 공용 판단 기준 |
| `common/ui-check-principles.md` | UI 안정성 검수 기준 |
| `common/data-safety-principles.md` | 저장, 삭제, 생성 작업의 안전 기준 |
| `common/verification-principles.md` | 검증 실행과 실패 보고 기준 |
| `common/quality-gates.md` | 기능, UI, 데이터 흐름의 공용 완료 기준 |
| `common/self-a2a-failure-modes.md` | self A2A의 role drift, context rot, rubber-stamp review 방지 기준 |
| `roles/planner.md` | 작업 범위와 단계 분해 |
| `roles/worker.md` | 실제 구현 수행 |
| `roles/reviewer.md` | 구조, 회귀, 중복 위험 검토 |
| `roles/ux-checker.md` | 사용자 흐름과 화면 안정성 검토 |
| `roles/tester.md` | 검증 명령과 재현 확인 |
| `roles/boundary-checker.md` | 변경 영역과 책임 경계 확인 |
| `roles/mapping-designer.md` | 이벤트, 기능, 액션 매핑 구조 검토 |
| `roles/data-safety-checker.md` | 저장, 삭제, 생성, 자동 반영 안전성 검토 |
| `project/project-boundary.md` | GhostNest 책임 영역 경계 |
| `project/domain-model.md` | GhostNest 도메인 용어와 포함 관계 |
| `project/runtime-rules.md` | GhostNest 런타임 실행 흐름 |
| `project/ui-rules.md` | GhostNest 캐릭터/말풍선/메뉴 UI 기준 |
| `project/asset-safety.md` | GhostNest 캐릭터 에셋 저장 안전 기준 |
| `project/extension-policy.md` | GhostNest 확장/플러그인 배치 기준 |

제품 설계 문서:

| 경로 | 역할 |
| --- | --- |
| `../feature-connection-model.md` | 나니카 기능 연결, Feature Set, Action Flow, Preset 제한 설계 |

## 사용 원칙

- 모든 작업은 `AGENTS.md`를 우선 따른다.
- 역할별 문서는 필요한 역할만 추가로 참조한다.
- `common/`은 다른 프로젝트로 복사 가능한 공용 원칙이다.
- `project/`는 GhostNest 전용 판단 기준이며 다른 프로젝트에서는 새로 작성한다.
- 하나의 역할은 다른 역할의 책임을 대신하지 않는다.
- 작업 중 영향 범위가 커지면 `common/a2a-workflow.md` 기준으로 위험도를 승격한다.
- 완료 보고 전 `common/quality-gates.md` 기준으로 기능, UI, 데이터 흐름을 분리해 확인한다.
- 역할별 결과는 최종 구현 판단을 돕는 입력이며, 최종 책임은 현재 작업을 수행하는 AI 하네스에 있다.
