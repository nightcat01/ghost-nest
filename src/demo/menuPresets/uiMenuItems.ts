import type { ManagementMenuItem } from "../../core/types.js";

const compactSpeechSize = {
  stageWidth: "min(320px, calc(var(--runtime-area-width, 320px) - 48px))",
  maxWidth: "100%",
  maxHeight: "160px",
  dialogueWidth: "min(100%, calc(var(--runtime-area-width, 420px) - 48px))",
  dialogueMaxWidth: "420px",
  dialogueHeight: "150px",
  dialogueMaxHeight: "180px",
  actionMenuMaxHeight: "96px",
};

const wideSpeechSize = {
  stageWidth: "min(560px, calc(var(--runtime-area-width, 560px) - 48px))",
  maxWidth: "100%",
  maxHeight: "min(340px, var(--floating-content-max-height, 340px))",
  dialogueWidth: "min(100%, calc(var(--runtime-area-width, 760px) - 48px))",
  dialogueMaxWidth: "760px",
  dialogueHeight: "min(34vh, 300px)",
  dialogueMaxHeight: "min(38vh, calc(var(--runtime-area-height, 720px) - var(--character-sprite-height, 390px) - 72px))",
};

const overflowTestText = [
  "긴 대사와 많은 메뉴가 들어와도 대사창은 런타임 실행 영역 안에서만 움직여야 해요.",
  "캐릭터가 위아래로 크게 밀리거나, 화면 밖으로 사라지거나, 말풍선이 끝없이 늘어나면 안 돼요.",
  "이 문장은 개발자가 overflow, scroll, max-height, width 제한을 한 번에 확인할 수 있도록 일부러 길게 만들었어요.",
].join("\n");

/**
 * Creates demo menu items for user-facing UI preferences.
 */
export function createUiMenuItems(): ManagementMenuItem[] {
  return [
    {
      id: "balloon-theme",
      label: "말풍선 테마",
      description: "말풍선 분위기를 바꿔요. 선택한 값은 새로고침 후에도 유지돼요.",
      children: [
        {
          id: "balloon-default",
          label: "기본",
          actions: [
            { type: "change_balloon", theme: "default" },
            { type: "speak_text", text: "말풍선을 기본 분위기로 돌려놓았어요." },
            { type: "log", label: "management.balloon.default" },
          ],
        },
        {
          id: "balloon-soft",
          label: "soft",
          actions: [
            { type: "change_balloon", theme: "soft" },
            { type: "speak_text", text: "말풍선 분위기를 조금 부드럽게 바꿨어요." },
            { type: "log", label: "management.balloon.soft" },
          ],
        },
        {
          id: "balloon-dark-magic",
          label: "dark magic",
          actions: [
            { type: "change_balloon", theme: "dark_magic" },
            { type: "speak_text", text: "조금 더 마법서 같은 분위기로 바꿨어요." },
            { type: "log", label: "management.balloon.dark_magic" },
          ],
        },
        {
          id: "balloon-fortune-prompt",
          label: "fortune prompt",
          actions: [
            { type: "change_balloon", theme: "fortune_prompt" },
            { type: "speak_text", text: "포춘마스터 화면에 맞춘 반투명 프롬프트 분위기로 바꿨어요." },
            { type: "log", label: "management.balloon.fortune_prompt" },
          ],
        },
      ],
    },
    {
      id: "balloon-font-size",
      label: "글꼴 크기",
      description: "말풍선 글자 크기를 바꿔요.",
      children: [
        {
          id: "balloon-font-size-small",
          label: "작게",
          actions: [
            { type: "change_balloon_font_size", size: "small" },
            { type: "speak_text", text: "글씨를 조금 작게 만들었어요." },
            { type: "log", label: "management.balloon_font_size.small" },
          ],
        },
        {
          id: "balloon-font-size-default",
          label: "기본",
          actions: [
            { type: "change_balloon_font_size", size: "default" },
            { type: "speak_text", text: "원래 글씨 크기로 돌아왔어요." },
            { type: "log", label: "management.balloon_font_size.default" },
          ],
        },
        {
          id: "balloon-font-size-large",
          label: "크게",
          actions: [
            { type: "change_balloon_font_size", size: "large" },
            { type: "speak_text", text: "글씨를 조금 크게 만들었어요." },
            { type: "log", label: "management.balloon_font_size.large" },
          ],
        },
      ],
    },
    {
      id: "speech-layout",
      label: "대사창 배치",
      description: "캐릭터 대사를 기존 말풍선처럼 띄울지, 게임식 대사창으로 띄울지 고를 수 있어요.",
      children: [
        {
          id: "speech-layout-floating",
          label: "기본 말풍선",
          actions: [
            { type: "change_speech_layout", mode: "floating", placement: "below-character" },
            { type: "speak_text", text: "대사를 기존 말풍선 방식으로 보여줄게요." },
            { type: "log", label: "management.speech_layout.floating" },
          ],
        },
        {
          id: "speech-layout-dialogue-below",
          label: "하단 대사창",
          actions: [
            { type: "change_speech_layout", mode: "dialogue-box", placement: "below-character" },
            { type: "speak_text", text: "대사를 캐릭터 아래의 대사창으로 보여줄게요." },
            { type: "log", label: "management.speech_layout.dialogue_below" },
          ],
        },
        {
          id: "speech-layout-dialogue-overlay",
          label: "겹치는 대사창",
          actions: [
            { type: "change_speech_layout", mode: "dialogue-box", placement: "overlay-bottom" },
            { type: "speak_text", text: "대사창을 캐릭터 아래쪽에 살짝 겹쳐서 보여줄게요." },
            { type: "log", label: "management.speech_layout.dialogue_overlay" },
          ],
        },
      ],
    },
    {
      id: "speech-size",
      label: "대사창 크기",
      description: "런타임 실행 영역 기준으로 말풍선과 대사창 크기 제한을 테스트해요.",
      children: [
        {
          id: "speech-size-default",
          label: "기본",
          actions: [
            { type: "set_speech_balloon_size", reset: true },
            { type: "speak_text", text: "대사창 크기를 런타임 영역 기준 기본값으로 돌렸어요." },
            { type: "log", label: "management.speech_size.default" },
          ],
        },
        {
          id: "speech-size-compact",
          label: "좁게",
          actions: [
            { type: "set_speech_balloon_size", size: compactSpeechSize },
            { type: "speak_text", text: overflowTestText },
            { type: "log", label: "management.speech_size.compact" },
          ],
        },
        {
          id: "speech-size-wide",
          label: "넓게",
          actions: [
            { type: "set_speech_balloon_size", size: wideSpeechSize },
            { type: "speak_text", text: overflowTestText },
            { type: "log", label: "management.speech_size.wide" },
          ],
        },
      ],
    },
    {
      id: "menu-ui",
      label: "메뉴 UI",
      description: "메뉴를 말풍선 안에 띄울지, 별도 패널로 띄울지 고를 수 있어요.",
      children: [
        {
          id: "menu-ui-default-balloon",
          label: "기본: 말풍선",
          actions: [
            { type: "set_management_menu_display", display: "balloon" },
            { type: "speak_text", text: "기본 메뉴를 말풍선 안에서 열도록 바꿨어요." },
            { type: "log", label: "management.menu_ui.default.balloon" },
          ],
        },
        {
          id: "menu-ui-default-panel",
          label: "기본: 패널",
          actions: [
            { type: "set_management_menu_display", display: "panel" },
            { type: "speak_text", text: "기본 메뉴를 별도 패널로 열도록 바꿨어요." },
            { type: "log", label: "management.menu_ui.default.panel" },
          ],
        },
        {
          id: "menu-ui-system-balloon",
          label: "시스템: 말풍선",
          actions: [
            { type: "set_management_menu_display", menuId: "system-tools", display: "balloon" },
            { type: "speak_text", text: "시스템 도구 메뉴를 말풍선 방식으로 바꿨어요." },
            { type: "log", label: "management.menu_ui.system.balloon" },
          ],
        },
        {
          id: "menu-ui-system-panel",
          label: "시스템: 패널",
          actions: [
            { type: "set_management_menu_display", menuId: "system-tools", display: "panel" },
            { type: "speak_text", text: "시스템 도구 메뉴를 패널 방식으로 바꿨어요." },
            { type: "log", label: "management.menu_ui.system.panel" },
          ],
        },
        {
          id: "menu-ui-reset",
          label: "UI 초기화",
          actions: [
            { type: "reset_runtime_ui" },
            { type: "speak_text", text: "메뉴와 말풍선 설정을 기본값으로 돌려둘게요." },
            { type: "log", label: "management.menu_ui.reset" },
          ],
        },
      ],
    },
  ];
}
