# 데모 프리셋

`src/demo`는 GhostNest 기능을 어떻게 매핑하는지 보여주는 샘플 프리셋 영역이다.

이 디렉터리는 개발자가 주로 수정하는 표면이 아니다. 실제 서비스 조립 지점은 `src/ghost`에 둔다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `demoPlugins.ts` | 샘플 결과, 날씨, 타이머, 시스템 정보, 미니게임 샘플 플러그인 등록 |
| `demoManagementMenu.ts` | 여러 메뉴 프리셋을 조합해서 데모 관리 메뉴 생성 |
| `demoRules.ts` | 런타임 이벤트를 액션 배열에 매핑하는 데모 rule |
| [menuPresets/](./menuPresets/README.md) | 데모 메뉴 항목을 기능군별로 분리한 영역 |

## 메뉴 프리셋

| 파일 | 역할 |
| --- | --- |
| `menuPresets/dialogueMenuItems.ts` | 대사와 DialogueScript 예시 |
| `menuPresets/pluginMenuItems.ts` | 플러그인, 중첩 메뉴, 미니게임, 타이머 예시 |
| `menuPresets/uiMenuItems.ts` | 말풍선, 글자 크기, 메뉴 표시 방식 설정 |
| `menuPresets/characterMenuItems.ts` | 캐릭터 애니메이션, 숨기기, 캐릭터 표현 예시 |
| `menuPresets/developerMenuItems.ts` | 개발자 전용 진단/편집 도구 |

메뉴 프리셋은 항목 하나마다 나누지 않고 기능군 단위로 나눈다.

특정 기능군이 커지거나 독립 샘플로 설명해야 할 만큼 복잡해졌을 때만 한 단계 더 분리한다.

일부 프리셋은 현재 캐릭터 정의를 받을 수 있다. 예를 들어 `characterMenuItems.ts`는 실제로 `mouth` 레이어나 `mouthImages`가 있는 surface를 읽어서 입모양 테스트 메뉴를 만든다.

개발자 도구는 `includeDeveloperTools` 옵션을 켰을 때 별도 `developer-tools` 메뉴로 묶인다.

```ts
createDemoManagementMenuItems(character, {
  includeDeveloperTools: true,
});
```

사용자 전용 서비스 화면을 만들 때는 이 옵션을 끄거나 데모 프리셋 대신 직접 메뉴를 조립한다.

## 사용 방식

기본 `src/ghost` 파일들은 프로젝트가 바로 동작하도록 데모 프리셋을 가져다 쓴다.

실제 서비스에서는 다음 흐름을 권장한다.

1. 데모 프리셋을 유지하고 `src/ghost`에서 서비스별 플러그인이나 메뉴 항목을 추가한다.
2. 데모 프리셋 import를 제거하고 직접 plugin, menu, rule을 정의한다.
3. 이 디렉터리에서 필요한 패턴만 가져오고, 서비스 고유 코드는 `src/demo` 밖에 둔다.

API key, 운영 DB 호출, 서비스 비즈니스 로직은 이 데모 파일에 넣지 않는다.
