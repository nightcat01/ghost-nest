# Nanika Dialogue Overlay A2A Request

## Source Project

- 요청 출처: Fortune Master `/new` 원프레임 테스트 화면
- 연동 방식: `ghost-nest` npm package import 후 `createGhostRuntimeFromPreset` 사용
- 관련 런타임 프리셋: `runtimeSpeechPresets.dialogueOverlay`
- 관련 UI: 모바일 상단 캐릭터 영역, 하단 화면 교체 흐름

## Problem

Fortune Master에서 Nanika를 상단 고정 캐릭터 영역에 붙였을 때 `dialogueOverlay` 대사창이 캐릭터를 과하게 가린다.

현재 Fortune Master 쪽 CSS로 위치를 줄이거나 옮길 수는 있지만, 이 문제는 개별 임베드 화면에서 임시 보정하기보다 GhostNest 런타임 프리셋 또는 레이아웃 옵션으로 해결하는 편이 맞다.

## Desired Outcome

GhostNest에서 다음 중 하나 이상을 공식 지원해주면 좋다.

- `dialogueOverlay`보다 캐릭터를 덜 가리는 compact overlay 프리셋
- 대사창이 캐릭터 하단 전체를 덮지 않고 좌/우 일부에만 걸치는 side overlay 배치
- 캐릭터와 대사창의 겹침 정도를 runtime option으로 조정하는 옵션
- 모바일 원프레임 앱에서 권장할 Fortune-style runtime embed preset

## Requirements

- 캐릭터 전신 또는 주요 상반신이 대사창에 완전히 가려지지 않아야 한다.
- 대사창은 캐릭터를 밀어내지 않고 overlay로 떠야 한다.
- 대사창 width, height, max-height는 런타임 영역 안에서 제한되어야 한다.
- 작은 모바일 폭에서도 캐릭터, 대사창, 하단 앱 화면이 서로 밀려나지 않아야 한다.
- hover 설명 기능은 preset/profile 단위에서 확실히 끌 수 있어야 한다.
- 기존 `dialogueOverlay` 사용처가 깨지지 않도록 새 preset 또는 optional option 형태를 우선 검토한다.

## Non-goals

- Fortune Master 전용 CSS hardcoding을 GhostNest core에 넣지 않는다.
- 특정 캐릭터인 Miyako, Rine 기준의 이미지 크기에만 맞춘 분기를 만들지 않는다.
- loading 화면에 Nanika를 강제로 붙이는 방향은 제외한다.
- devtools 관리 메뉴나 mapping editor UI를 사용자 앱에 노출하지 않는다.

## Reproduction Context

Fortune Master에서는 다음 형태로 런타임을 붙이고 있다.

- `speechLayout: runtimeSpeechPresets.dialogueOverlay.layout`
- `speechBalloonSize: runtimeSpeechPresets.dialogueOverlay.size` 기반
- `controls.commandButtons: false`
- `controls.commandHoverDescription: false`
- `controls.areaHoverDescription: false`
- `controls.managementMenu: false`
- `controls.persistence: false`
- `controls.devtools: false`
- 캐릭터 영역 높이: 모바일 화면 상단 약 38%, `min-height: 260px`
- 화면 구성: 상단 Nanika fixed 영역 + 하단 메뉴/선택/결과 교체 영역

## Suggested Design Direction

새 preset 후보:

- `runtimeSpeechPresets.dialogueOverlayCompact`
- `runtimeSpeechPresets.sideOverlay`
- `runtimeSpeechPresets.fortuneEmbed`

새 option 후보:

- `speechLayout.overlayAnchor: "left" | "right" | "center"`
- `speechLayout.overlapRatio?: number`
- `speechLayout.avoidSpriteFocusArea?: boolean`
- `speechBalloonSize.dialogueWidth`를 stage width 전체가 아닌 compact width로 제한

구현은 기존 `dialogueOverlay`를 바꾸기보다 새 preset 추가를 우선 검토한다.

## Harness

위험도: risky

참조 역할:

- `docs/ai/roles/planner.md`
- `docs/ai/roles/worker.md`
- `docs/ai/roles/reviewer.md`
- `docs/ai/roles/tester.md`
- `docs/ai/roles/ux-checker.md`
- `docs/ai/roles/mapping-designer.md`
- `docs/ai/project/runtime-rules.md`
- `docs/ai/project/ui-rules.md`

검증 기준:

- `npm run check`
- `npm run build`
- `dev-fortune-embed.html` 또는 동일한 runtime embed 데모에서 실제 화면 확인
- 좁은 모바일 폭에서 캐릭터와 대사창 겹침 확인
- 기존 `dialogueOverlay` 사용처 회귀 확인
- hover description off 상태에서 hover 대사 또는 설명이 발생하지 않는지 확인

## Acceptance Criteria

- Fortune-style embed에서 대사창이 캐릭터를 완전히 가리지 않는다.
- 캐릭터 hover 설명 기능이 꺼진 상태에서 hover 대사가 나오지 않는다.
- 새 preset 또는 option은 기존 preset과 호환된다.
- 문서에 추천 사용 예시가 추가된다.
- UI 검증 결과가 남는다.

