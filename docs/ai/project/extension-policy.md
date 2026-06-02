# GhostNest Extension Policy

이 문서는 GhostNest 확장과 플러그인 배치 기준이다.

## core/runtime에 둘 것

- 실행 규격
- 공통 타입
- 이벤트/액션 실행
- 렌더링에 필요한 최소 기능
- controls와 userPreferences
- 플러그인이 만든 결과를 실행하기 위한 최소 hook

## plugin/devtools에 둘 것

- 캐릭터 설정 화면
- asset generator
- mapping editor
- graph editor
- Mermaid/JSON export UI
- action/event/capability catalog
- preset/registry 조립 도구
- 개발자 전용 화면
- React Flow, Cytoscape 같은 무거운 시각 편집 라이브러리

## demo에 둘 것

- 샘플 메뉴
- 샘플 플러그인
- 예시 rule
- 예시 캐릭터 연결
- Rine 기반 실사용 예시 세트
- 캐릭터 미지정 템플릿 세트
- 외부 사이트 임베드 예시

## 사용자/개발자 구분

- 사용자는 허용된 UI 설정과 사용자 기능만 쓴다.
- 개발자는 캐릭터, 플러그인, 액션, 매핑, preset을 조립한다.
- 개발자 도구는 외부 사이트 사용자에게 노출되지 않는 경계에 둔다.

## 판단 기준

런타임 실행에 꼭 필요하지 않은 편집 편의 기능은 core/runtime에 넣지 않는다.

개발자가 연결하기 쉽게 만드는 도구는 plugin/devtools로 둔다.

사용자 런타임 bundle에는 개발자 편집기와 무거운 시각화 라이브러리를 포함하지 않는다.

그래프 편집기나 매핑 시각화가 필요하면 별도 플러그인 entry로 로드하고, runtime에는 그 결과물인 action/rule/preset만 전달한다.

데모는 제품 규격이 아니라 사용 예시다. 데모에 필요한 캐릭터, 메뉴, 템플릿 세트, 외부 사이트 예시는 core/runtime 요구사항으로 승격하지 않는다.
