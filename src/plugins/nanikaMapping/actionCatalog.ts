import type { BuiltinRuntimeAction, RuntimeControlOptions } from "../../core/types.js";

export type RuntimeActionType = BuiltinRuntimeAction["type"];

export type RuntimeActionCatalogCategory =
  | "speech"
  | "character"
  | "plugin"
  | "ui"
  | "flow"
  | "io";

export type RuntimeActionParameterType =
  | "string"
  | "number"
  | "boolean"
  | "unknown"
  | "size-options"
  | "action-array"
  | "menu-items"
  | "script"
  | "event-payload";

export type RuntimeActionParameterCatalogItem = {
  name: string;
  type: RuntimeActionParameterType;
  required?: boolean;
  description: string;
};

export type RuntimeActionCatalogItem = {
  type: RuntimeActionType;
  category: RuntimeActionCatalogCategory;
  label: string;
  description: string;
  parameters: RuntimeActionParameterCatalogItem[];
  requiredControls?: Array<keyof RuntimeControlOptions>;
};

/**
 * Lists built-in runtime actions in a shape that editors can render and map.
 */
export const runtimeActionCatalog = [
  {
    type: "speak",
    category: "speech",
    label: "대사 카테고리 말하기",
    description: "캐릭터 대사 카테고리에서 대사를 골라 출력합니다.",
    requiredControls: ["speech"],
    parameters: [
      { name: "category", type: "string", required: true, description: "대사를 가져올 DialogueCategory입니다." },
    ],
  },
  {
    type: "speak_text",
    category: "speech",
    label: "고정 문장 말하기",
    description: "지정한 문장을 바로 말풍선에 출력합니다.",
    requiredControls: ["speech"],
    parameters: [
      { name: "text", type: "string", required: true, description: "출력할 문장입니다." },
    ],
  },
  {
    type: "speak_script",
    category: "speech",
    label: "대사 스크립트 실행",
    description: "DialogueScript 토큰 배열을 실행합니다.",
    requiredControls: ["speech"],
    parameters: [
      { name: "text", type: "string", required: true, description: "fallback 또는 요약 문장입니다." },
      { name: "script", type: "script", required: true, description: "실행할 DialogueScript입니다." },
    ],
  },
  {
    type: "change_expression",
    category: "character",
    label: "표정 변경",
    description: "현재 캐릭터 expression을 변경합니다.",
    parameters: [
      { name: "expression", type: "string", required: true, description: "변경할 expression id입니다." },
      { name: "clearTouchedPart", type: "boolean", description: "마지막 터치 부위 상태를 비울지 여부입니다." },
    ],
  },
  {
    type: "surface",
    category: "character",
    label: "캐릭터 상태 변경",
    description: "캐릭터가 화면에 보여줄 상태를 변경합니다.",
    parameters: [
      { name: "id", type: "string", required: true, description: "변경할 캐릭터 상태 id입니다." },
      { name: "startIdleLayers", type: "boolean", description: "상태에 연결된 대기 파츠 애니메이션을 시작할지 여부입니다." },
    ],
  },
  {
    type: "scene",
    category: "character",
    label: "무대 조합 변경",
    description: "런타임 배경, 전경, 환경 FX 같은 무대 조합을 변경합니다.",
    parameters: [
      { name: "id", type: "string", required: true, description: "변경할 무대 조합 id입니다." },
    ],
  },
  {
    type: "scene_overlay",
    category: "character",
    label: "무대 오버레이 켜기/끄기",
    description: "기본 무대 위에 무대 조합을 제한된 오버레이로 겹치거나 제거합니다. 기본 동시 제한은 2개입니다.",
    parameters: [
      { name: "id", type: "string", required: true, description: "겹쳐 표시할 무대 조합 id입니다." },
      { name: "slot", type: "string", description: "같은 slot은 새 오버레이로 교체됩니다. 예: weather, emotion, foreground" },
      { name: "active", type: "boolean", description: "false이면 해당 slot 또는 id의 오버레이를 제거합니다." },
      { name: "duration", type: "number", description: "자동 제거까지의 시간(ms)입니다." },
    ],
  },
  {
    type: "set_touched_part",
    category: "character",
    label: "터치 부위 기록",
    description: "마지막으로 반응한 캐릭터 부위를 저장하거나 비웁니다.",
    parameters: [
      { name: "part", type: "string", required: true, description: "head, face, body 또는 null입니다." },
    ],
  },
  {
    type: "toggle_hidden",
    category: "character",
    label: "표시 토글",
    description: "캐릭터 표시/숨김 상태를 전환합니다.",
    parameters: [],
  },
  {
    type: "request_character_change",
    category: "character",
    label: "캐릭터 변경 요청",
    description: "호스트 앱에 캐릭터 교체 요청 이벤트를 보냅니다. 실제 교체는 앱이 런타임을 다시 생성해서 처리합니다.",
    parameters: [
      { name: "characterId", type: "string", description: "현재 캐릭터 또는 교체 기준으로 전달할 character id입니다." },
      { name: "reason", type: "string", description: "요청 출처를 구분하기 위한 값입니다. 예: management_menu" },
    ],
  },
  {
    type: "call_plugin",
    category: "plugin",
    label: "플러그인 호출",
    description: "등록된 RuntimePlugin을 실행합니다.",
    requiredControls: ["plugins"],
    parameters: [
      { name: "pluginId", type: "string", required: true, description: "실행할 plugin id입니다." },
    ],
  },
  {
    type: "log",
    category: "io",
    label: "로그 추가",
    description: "진단 로그에 실행 기록을 남깁니다.",
    parameters: [
      { name: "label", type: "string", required: true, description: "기록할 로그 라벨입니다." },
    ],
  },
  {
    type: "touch_interaction",
    category: "flow",
    label: "상호작용 시각 갱신",
    description: "idle과 random prompt 기준이 되는 마지막 상호작용 시각을 갱신합니다.",
    parameters: [],
  },
  {
    type: "mark_prompted",
    category: "flow",
    label: "랜덤 발화 시각 갱신",
    description: "마지막 random prompt 실행 시각을 갱신합니다.",
    parameters: [],
  },
  {
    type: "run_sequence",
    category: "flow",
    label: "순서대로 묶음 실행",
    description: "여러 액션을 하나의 묶음으로 순서대로 실행합니다.",
    parameters: [
      { name: "actions", type: "action-array", required: true, description: "순서대로 실행할 액션 배열입니다." },
    ],
  },
  {
    type: "run_parallel",
    category: "flow",
    label: "동시에 묶음 실행",
    description: "여러 액션을 동시에 시작합니다. 화면 상태가 충돌하지 않는 가벼운 액션에 사용합니다.",
    parameters: [
      { name: "actions", type: "action-array", required: true, description: "동시에 실행할 액션 배열입니다." },
    ],
  },
  {
    type: "run_random",
    category: "flow",
    label: "랜덤으로 하나 실행",
    description: "여러 액션 후보 중 하나를 골라 실행합니다.",
    parameters: [
      { name: "actions", type: "action-array", required: true, description: "랜덤 후보 액션 배열입니다." },
    ],
  },
  {
    type: "play_animation",
    category: "character",
    label: "CSS 애니메이션 재생",
    description: "캐릭터 sprite에 CSS animation 상태를 적용합니다.",
    parameters: [
      { name: "animation", type: "string", required: true, description: "재생할 animation id입니다." },
      { name: "duration", type: "number", description: "자동 해제까지의 시간(ms)입니다." },
    ],
  },
  {
    type: "play_layer_animation",
    category: "character",
    label: "파츠 애니메이션 재생",
    description: "특정 파츠 애니메이션을 켜거나 끕니다.",
    parameters: [
      { name: "layerId", type: "string", required: true, description: "대상 파츠 id입니다." },
      { name: "duration", type: "number", description: "자동 중지까지의 시간(ms)입니다." },
      { name: "active", type: "boolean", description: "명시적으로 켜거나 끌지 여부입니다." },
    ],
  },
  {
    type: "open_ui",
    category: "ui",
    label: "UI 열기",
    description: "data-runtime-ui 값이 일치하는 UI를 엽니다.",
    parameters: [
      { name: "target", type: "string", required: true, description: "열 UI의 target id입니다." },
    ],
  },
  {
    type: "close_ui",
    category: "ui",
    label: "UI 닫기",
    description: "data-runtime-ui 값이 일치하는 UI를 닫습니다.",
    parameters: [
      { name: "target", type: "string", required: true, description: "닫을 UI의 target id입니다." },
    ],
  },
  {
    type: "navigate",
    category: "io",
    label: "페이지 이동",
    description: "지정한 route로 이동합니다.",
    parameters: [
      { name: "route", type: "string", required: true, description: "이동할 route 또는 URL입니다." },
    ],
  },
  {
    type: "set_state",
    category: "flow",
    label: "상태 변경",
    description: "캐릭터 runtime mode를 변경합니다.",
    parameters: [
      { name: "state", type: "string", required: true, description: "변경할 runtime mode입니다." },
    ],
  },
  {
    type: "emit_event",
    category: "flow",
    label: "이벤트 발생",
    description: "다른 RuntimeEvent를 발생시켜 rule을 이어 실행합니다.",
    parameters: [
      { name: "event", type: "string", required: true, description: "발생시킬 이벤트 이름입니다." },
      { name: "payload", type: "event-payload", description: "이벤트에 전달할 payload입니다." },
    ],
  },
  {
    type: "play_sound",
    category: "io",
    label: "사운드 재생",
    description: "지정한 사운드 파일을 재생합니다.",
    parameters: [
      { name: "sound", type: "string", required: true, description: "재생할 사운드 URL입니다." },
      { name: "volume", type: "number", description: "0부터 1 사이의 볼륨입니다." },
    ],
  },
  {
    type: "save_data",
    category: "io",
    label: "데이터 저장",
    description: "StorageAdapter에 값을 저장합니다.",
    requiredControls: ["persistence"],
    parameters: [
      { name: "key", type: "string", required: true, description: "저장 key입니다." },
      { name: "value", type: "unknown", required: true, description: "저장할 값입니다." },
    ],
  },
  {
    type: "load_data",
    category: "io",
    label: "데이터 불러오기",
    description: "StorageAdapter에서 값을 불러옵니다.",
    requiredControls: ["persistence"],
    parameters: [
      { name: "key", type: "string", required: true, description: "불러올 key입니다." },
      { name: "saveTo", type: "string", description: "state.data에 저장할 key입니다." },
      { name: "speak", type: "boolean", description: "불러온 값을 말풍선으로 출력할지 여부입니다." },
    ],
  },
  {
    type: "show_notification",
    category: "io",
    label: "알림 표시",
    description: "브라우저 알림 또는 말풍선 fallback을 표시합니다.",
    parameters: [
      { name: "title", type: "string", required: true, description: "알림 제목입니다." },
      { name: "message", type: "string", required: true, description: "알림 내용입니다." },
    ],
  },
  {
    type: "start_timer",
    category: "flow",
    label: "타이머 시작",
    description: "일정 시간 뒤 액션 배열을 실행합니다.",
    parameters: [
      { name: "timer", type: "string", required: true, description: "타이머 id입니다." },
      { name: "duration", type: "number", required: true, description: "대기 시간(ms)입니다." },
      { name: "actions", type: "action-array", required: true, description: "시간이 지난 뒤 실행할 액션 배열입니다." },
    ],
  },
  {
    type: "stop_timer",
    category: "flow",
    label: "타이머 중지",
    description: "대기 중인 타이머를 중지합니다.",
    parameters: [
      { name: "timer", type: "string", required: true, description: "중지할 타이머 id입니다." },
    ],
  },
  {
    type: "move_character",
    category: "character",
    label: "캐릭터 위치 이동",
    description: "캐릭터 스테이지 위치를 저장 가능한 사용자 설정으로 이동합니다.",
    parameters: [
      { name: "x", type: "number", required: true, description: "x 좌표(px)입니다." },
      { name: "y", type: "number", required: true, description: "y 좌표(px)입니다." },
    ],
  },
  {
    type: "set_character_placement",
    category: "character",
    label: "캐릭터 위치 프리셋",
    description: "런타임 영역 안에서 캐릭터를 9분할 위치 중 하나에 배치합니다.",
    parameters: [
      { name: "placement", type: "string", required: true, description: "top-left, middle-center, bottom-right 같은 9분할 위치입니다." },
      { name: "offsetX", type: "number", description: "좌우 가장자리에서 떨어질 거리(px)입니다. 가운데 정렬이면 보정값으로만 사용합니다." },
      { name: "offsetY", type: "number", description: "상하 가장자리에서 떨어질 거리(px)입니다. 가운데 정렬이면 보정값으로만 사용합니다." },
    ],
  },
  {
    type: "change_balloon",
    category: "ui",
    label: "말풍선 테마 변경",
    description: "말풍선 테마를 변경합니다.",
    parameters: [
      { name: "theme", type: "string", required: true, description: "적용할 테마 id입니다." },
    ],
  },
  {
    type: "change_balloon_font_size",
    category: "ui",
    label: "말풍선 글자 크기 변경",
    description: "말풍선과 메뉴 글자 크기를 변경합니다.",
    parameters: [
      { name: "size", type: "string", required: true, description: "small, default, large 같은 크기 id입니다." },
    ],
  },
  {
    type: "change_speech_layout",
    category: "ui",
    label: "대사창 배치 변경",
    description: "대사 UI를 말풍선 또는 하단 대사창 방식으로 변경합니다.",
    parameters: [
      { name: "mode", type: "string", description: "floating 또는 dialogue-box입니다." },
      { name: "placement", type: "string", description: "below-character 또는 overlay-bottom입니다." },
      { name: "overlayAnchor", type: "string", description: "overlay-bottom에서 left, right, center 중 말풍선 정렬을 고릅니다." },
    ],
  },
  {
    type: "set_speech_balloon_size",
    category: "ui",
    label: "대사창 크기 변경",
    description: "런타임 영역을 기준으로 말풍선/대사창의 너비와 높이 제한을 변경합니다.",
    parameters: [
      { name: "size", type: "size-options", description: "SpeechBalloonSizeOptions 일부 값입니다." },
      { name: "reset", type: "boolean", description: "true이면 저장된 크기 설정을 기본값으로 되돌립니다." },
    ],
  },
  {
    type: "open_management_menu",
    category: "ui",
    label: "관리 메뉴 열기",
    description: "액션 기반 관리 메뉴를 엽니다.",
    requiredControls: ["managementMenu"],
    parameters: [
      { name: "menuId", type: "string", description: "메뉴별 표시 설정에 사용할 id입니다." },
      { name: "title", type: "string", description: "메뉴 제목입니다." },
      { name: "items", type: "menu-items", required: true, description: "표시할 메뉴 항목 배열입니다." },
    ],
  },
  {
    type: "set_management_menu_display",
    category: "ui",
    label: "관리 메뉴 표시 방식 변경",
    description: "관리 메뉴를 말풍선 또는 패널 중 어디에 표시할지 정합니다.",
    requiredControls: ["managementMenu"],
    parameters: [
      { name: "display", type: "string", required: true, description: "balloon 또는 panel입니다." },
      { name: "menuId", type: "string", description: "특정 메뉴에만 적용할 id입니다." },
    ],
  },
  {
    type: "reset_runtime_ui",
    category: "ui",
    label: "런타임 UI 초기화",
    description: "사용자가 바꾼 메뉴와 말풍선 관련 UI 설정을 초기화합니다.",
    parameters: [],
  },
  {
    type: "close_management_menu",
    category: "ui",
    label: "관리 메뉴 닫기",
    description: "열려 있는 관리 메뉴를 닫습니다.",
    requiredControls: ["managementMenu"],
    parameters: [],
  },
] as const satisfies readonly RuntimeActionCatalogItem[];

/**
 * Finds catalog metadata for a built-in runtime action type.
 */
export function getRuntimeActionCatalogItem(type: RuntimeActionType) {
  return runtimeActionCatalog.find((item) => item.type === type);
}
