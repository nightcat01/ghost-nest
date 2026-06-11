# 데모 메뉴 프리셋

데모 관리 메뉴를 기능군별로 나눈 preset 문서다.

## 프리셋

| 파일 | 역할 |
| --- | --- |
| `dialogueMenuItems.ts` | 대사 출력, JSON DialogueScript, 선택지 예시 |
| `pluginMenuItems.ts` | 샘플 결과, 날씨, 미니게임, 타이머 같은 plugin 호출 예시 |
| `uiMenuItems.ts` | 말풍선 테마, 글자 크기, 메뉴 표시 방식 설정 |
| `characterMenuItems.ts` | 점프, 입모양 테스트, 숨기기 같은 캐릭터 표현 예시 |
| `developerMenuItems.ts` | 시스템 정보, 히트박스 에디터 같은 개발자 도구 |

## 사용 방식

`demoManagementMenu.ts`가 이 preset들을 조합한다.

```ts
createDemoManagementMenuItems(character, {
  includeDeveloperTools: true,
});
```

서비스에서 필요 없는 기능군은 빼고, 필요한 기능군만 가져와 조합하면 된다.

사용자에게 노출할 메뉴와 개발자 도구 메뉴는 분리해서 가져갈 수 있다.

```ts
createDemoUserMenuItems(character);
createDemoDeveloperMenuItems();
```

사용자 메뉴는 허용된 기능 실행과 개인 UI 설정에 집중하고, 개발자 메뉴는 diagnostics나 에셋/매핑 편집 진입점처럼 운영 사용자가 만지지 않아야 하는 도구를 담는다.

## 분리 기준

항목 하나마다 파일을 만들기보다 기능군별로 나눈다.

특정 기능군이 커지거나, 독립 샘플로 설명해야 할 만큼 복잡해지면 그때 하위 폴더로 한 번 더 분리한다.
