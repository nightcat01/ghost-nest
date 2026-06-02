# GhostNest Project Boundary

이 문서는 GhostNest 전용 책임 경계 기준이다.

## core/runtime

런타임 실행에 반드시 필요한 것만 둔다.

- `RuntimeAction`, `RuntimeRule`, `RuntimePlugin`
- 이벤트, 액션 실행 흐름
- `controls`, `userPreferences`
- 공통 타입과 최소 어댑터
- 캐릭터 렌더링과 대사 재생

코어/런타임은 "나니카가 실제 사용자 화면에서 실행하기 위해 반드시 해석해야 하는 최소 규격"만 가진다.

## plugin/devtools

개발자 편의, 편집 화면, 조립 도구를 둔다.

- character settings
- nanika mapping
- graph editor
- Mermaid/JSON export UI
- action/event/capability catalog
- mapping/preset/registry 조립
- devtool 화면과 API
- 무거운 UI 라이브러리와 시각 편집 기능

## character data

캐릭터별 표현과 리소스를 둔다.

- profile
- lines
- expressions
- surfaces
- scenes
- layers
- hit areas

## demo preset

샘플과 기본 조립 예시를 둔다.

- demo menu preset
- sample plugins
- default rules
- 예시 UI 설정
- Rine 전용 예시 세트
- 캐릭터 미지정 템플릿 세트
- 외부 사이트 적용 예시

## docs/config

설명, 방향성, 실행 설정을 둔다.

- 개발자 가이드
- AI harness
- extension config
- package/build 설정

## 판단 기준

편집 UI와 설명 데이터는 core/runtime에 넣지 않는다.

런타임이 실행하는 최종 규격은 core/runtime에 두고, 사람이 그 규격을 만들기 쉽게 돕는 도구는 plugin/devtools에 둔다.

코어/런타임 수정은 다음 경우에만 허용한다.

- 새 기능을 실행하기 위한 최소 타입 또는 action/rule 해석이 필요하다.
- 플러그인이 만든 결과를 runtime이 실행하려면 공통 hook이 반드시 필요하다.
- 캐릭터 렌더링, 대사 출력, 이벤트 처리처럼 실제 사용자 화면 동작에 직접 필요하다.

다음 항목은 기본적으로 core/runtime에 넣지 않는다.

- 그래프 편집기
- 캐릭터/매핑 설정 화면
- Mermaid 시각화와 export UI
- Rine 예시 데이터
- 캐릭터 미지정 템플릿 세트
- FortuneMaster 같은 외부 사이트 데모
- Comfy 같은 외부 제작 도구 연동
- 개발자 편의용 검증/복사/미리보기 UI
