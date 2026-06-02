# Nanika Mapping Plugin

`nanikaMapping`은 개발자가 캐릭터, 플러그인 기능, 이벤트, 액션을 연결하기 쉽게 만드는 개발자용 조립 도구다.

이 플러그인은 런타임 코어를 직접 확장하지 않는다. 최종적으로 `createGhostRuntime`이 받을 수 있는 `plugins`, `rules`, `options` 형태를 만들어주는 보조 계층이다.

## 포함 항목

| 파일 | 역할 |
| --- | --- |
| `actionCatalog.ts` | 매핑 편집기에 보여줄 기본 액션 목록과 입력값 |
| `eventCatalog.ts` | rule trigger로 사용할 이벤트 목록 |
| `capabilityCatalog.ts` | 등록된 `RuntimePlugin`을 기능 목록으로 변환 |
| `characterCatalog.ts` | 캐릭터 정의를 화면 표시용 요약으로 변환 |
| `mapping.ts` | 화면 친화적인 mapping을 `RuntimeRule`로 변환 |
| `preset.ts` | 캐릭터, 기능, 매핑, 런타임 옵션을 실행 단위로 조립 |
| `registry.ts` | 화면이 읽을 캐릭터, 기능, 이벤트, 액션, 매핑 목록을 한 곳에서 제공 |

## 경계

- 런타임 실행 규격과 action 처리 자체는 `src/core`, `src/runtime`에 둔다.
- 액션/이벤트/기능을 사람이 고르고 연결하기 위한 설명 데이터와 조립 헬퍼는 이 플러그인에 둔다.
- 매핑 편집 UI를 만들 때는 이 플러그인의 catalog와 mapping 헬퍼를 사용한다.
- UI는 여러 카탈로그 파일을 직접 읽기보다 `createNanikaMappingRegistry`를 통해 목록을 받는다.

## Feature Set 적용

저장된 기능 연결을 하나의 재사용 세트로 묶은 뒤 외부 프로젝트에서 runtime rule로 펼칠 수 있다.

```ts
import { createRuntimeRulesFromFeatureSets } from "ghost-nest";

const result = createRuntimeRulesFromFeatureSets(featureSets, mappings, ["fortune.home"]);

const rules = result.rules;
```

`warnings`가 있으면 feature set 안에 존재하지 않는 mapping id가 들어간 상태다.
