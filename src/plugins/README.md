# 샘플 런타임 플러그인

`src/plugins`는 데모 프리셋에서 사용하는 샘플 `RuntimePlugin` 구현과 플러그인별 개발 도구를 모아둔 영역이다.

플러그인은 API 호출, DB 조회, AI 응답, 미니게임, 상점, 서비스 전용 도구 같은 외부 기능을 감싸는 경계다. GhostNest는 `call_plugin` 액션으로 플러그인을 호출하고, 반환된 `PluginResult`를 대사와 표정으로 표현한다.

개발자 도구도 특정 기능을 편집하기 위한 플러그인 소유 UI라면 해당 플러그인 아래의 `devtools/`에 둔다. 최상위 `src/devtools`는 여러 플러그인이 공유하는 API client, DOM helper 같은 공통 유틸만 남기는 방향을 따른다.

## 현재 샘플

| 플러그인 | 역할 |
| --- | --- |
| [fortune](./fortune/README.md) | 로컬 더미 운세 결과 반환 |
| [weather](./weather/README.md) | 공개 날씨 API 호출 예시 |
| [systemInfo](./systemInfo/README.md) | 가능한 경우 브라우저/시스템 정보 조회 |
| [timer](./timer/README.md) | 타이머 안내 메시지 반환, 실제 예약은 액션 매핑에서 처리 |
| [minigame](./minigame/README.md) | 가위바위보 플러그인 variant 생성 |
| [menuSettings](./menuSettings/README.md) | 메뉴 재료 생성/편집 devtools |

## 서비스 코드 기준

실제 서비스에서는 API key, DB credential, 비즈니스 로직을 GhostNest 코어 안에 넣지 않는다.

권장 흐름은 다음과 같다.

1. 서비스 호출을 앱 또는 adapter 계층에 구현한다.
2. 결과를 `RuntimePlugin`으로 감싼다.
3. `src/ghost/nanika.config.ts`에 등록한다.
4. `src/ghost/actions.ts`에서 `{ type: "call_plugin", pluginId: "..." }`로 호출한다.

운영 secret은 데모 플러그인 파일에 넣지 않는다.
