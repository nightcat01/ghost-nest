# Menu Settings Plugin

`menuSettings`는 나니카 관리 메뉴를 만드는 개발자 도구 플러그인이다.

메뉴는 캐릭터에 직접 귀속되지 않는 재료다. 메뉴 설정 화면은 메뉴 ID, 항목 트리, 항목별 실행 액션을 만들고 저장한다. 캐릭터, 이벤트, 조건과 메뉴를 실제로 연결하는 일은 매핑 설정이 담당한다.

## 구조

```txt
src/plugins/menuSettings/
  index.ts
  devtools/
    assetMenuSettings.ts
```

`dev-menu-settings.html`은 번들된 devtools 페이지이고, 화면 로직은 다음 산출물을 사용한다.

```txt
dist/plugins/menuSettings/devtools/assetMenuSettings.js
```

## 저장 경계

메뉴 설정 화면은 저장 위치가 파일인지 DB인지 직접 판단하지 않는다. 브라우저 UI는 `NanikaDataClient`를 통해 `menus` scope로 JSON 데이터를 보내고, 서버 또는 호스트 앱의 data adapter가 파일/DB 저장 방식을 결정한다.

기본 개발 서버에서는 메뉴가 `generated/nanika-menus.json`에 저장된다.

## 책임

- 메뉴 세트 생성, 수정, 삭제
- 메뉴 항목 트리 편집
- 항목별 실행 액션 편집
- 매핑에서 참조할 `menuId` 제공
- 메뉴 항목에서 host가 처리할 프로필 전환 요청 액션 생성

## 책임 밖

- 특정 캐릭터와 메뉴를 직접 묶기
- 특정 이벤트에서 메뉴를 열지 결정하기
- 런타임에서 메뉴를 어떤 슬롯에 고정할지 최종 결정하기
- 런타임 프로필을 직접 로드하거나 캐릭터를 직접 교체하기

위 책임은 매핑 설정과 런타임 초기화 옵션이 담당한다.

## 프로필 전환 메뉴

메뉴 항목에서 `request_profile_change` 액션을 쓰면 런타임은 `ghostnest:profile-change-request` 이벤트만 발행한다.
실제 프로필 JSON을 찾고 런타임을 다시 만드는 일은 host 앱 또는 데모 페이지가 맡는다.

```json
{
  "id": "switch-rine-home",
  "label": "리네 홈 프로필",
  "actions": [
    {
      "type": "request_profile_change",
      "profileId": "demo.home.rine",
      "reason": "menu"
    }
  ]
}
```
