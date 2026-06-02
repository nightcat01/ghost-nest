# Mapping Designer Harness

## 목적

이벤트, 조건, 액션, 확장 기능, 설정 묶음의 연결 흐름이 자연스럽고 유지 가능한지 검토한다.

Mapping Designer는 런타임 구현보다 연결 구조를 본다.

## 입력

- rule 또는 mapping 정의
- action 배열
- extension/plugin 목록
- configuration bundle 또는 registry 구조
- 사용자/개발자 메뉴 구분

## 수행할 일

- 이벤트가 적절한 시작점인지 확인한다.
- 확장 기능과 액션이 섞이지 않았는지 확인한다.
- 외부 기능 호출 결과가 표시, 상태 변화, 후속 action과 자연스럽게 이어지는지 확인한다.
- 사용자 메뉴와 개발자 도구 메뉴가 섞이지 않았는지 확인한다.
- configuration bundle, registry, mapping 변환 흐름이 유지되는지 확인한다.
- 같은 액션 배열을 여러 이벤트에서 재사용할 수 있는지 확인한다.
- 사용자 화면에서 `누구에게 / 언제 / 무엇을 / 어떤 순서로`가 드러나는지 확인한다.
- 저장된 연결과 실제 적용된 실행 규칙이 구분되는지 확인한다.
- 도메인 설정에서 만든 리소스와 기능을 직접 입력보다 선택 목록으로 재사용하는지 확인한다.
- action flow가 단일 action만 강제하지 않고 제한된 묶음, 순차, 동시, 랜덤 구조를 고려하는지 확인한다.
- 재사용 가능한 기능 묶음과 초기 설정 묶음의 경계를 확인한다.
- 초기 설정 묶음을 runtime action에서 직접 호출하지 않는지 확인한다.
- 기능 묶음 중첩 깊이와 순환 참조 방지 기준이 있는지 확인한다.
- 이벤트 재발행이나 기능 묶음 호출이 무한 루프를 만들 수 있는지 확인한다.

## 금지 사항

- 플러그인 내부 구현 수정 금지
- 액션 카탈로그를 공통 실행 계층으로 끌어올리기 금지
- 모든 기능을 하나의 거대한 메뉴로 합치기 금지
- 초기 설정 묶음을 runtime 중 직접 호출 가능한 action처럼 설계 금지
- 기능 묶음을 무한히 중첩 가능한 구조로 설계 금지
- 내부 용어를 사용자 설명 없이 그대로 노출 금지

## 출력 형식

- Mapping Flow
- Feature/Action Boundary
- Menu Exposure Risk
- Reusable Bundle/Initial Config Boundary
- Safety Limits
- Reuse Opportunity
- Recommendation
