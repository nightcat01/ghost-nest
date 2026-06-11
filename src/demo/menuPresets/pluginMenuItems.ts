import type { ManagementMenuItem } from "../../core/types.js";

/**
 * Creates demo menu items that call RuntimePlugin examples.
 */
export function createPluginMenuItems(): ManagementMenuItem[] {
  return [
    {
      id: "draw-sample-result",
      label: "샘플 결과 실행",
      description: "외부 기능 결과를 받아 말풍선과 표정으로 보여주는 예시예요.",
      actions: [
        { type: "call_plugin", pluginId: "sample_result" },
        { type: "log", label: "management.draw_sample_result" },
      ],
    },
    {
      id: "weather",
      label: "날씨",
      description: "날씨 기능을 호출해서 결과를 캐릭터가 설명해요.",
      actions: [
        { type: "call_plugin", pluginId: "weather" },
        { type: "log", label: "management.weather" },
      ],
    },
    {
      id: "minigame",
      label: "가위바위보",
      description: "메뉴 depth 안에서 미니게임 선택지를 보여주는 예시예요.",
      children: [
        {
          id: "minigame-scissors",
          label: "가위",
          actions: [
            { type: "call_plugin", pluginId: "minigame_가위" },
            { type: "log", label: "management.minigame.scissors" },
          ],
        },
        {
          id: "minigame-rock",
          label: "바위",
          actions: [
            { type: "call_plugin", pluginId: "minigame_바위" },
            { type: "log", label: "management.minigame.rock" },
          ],
        },
        {
          id: "minigame-paper",
          label: "보",
          actions: [
            { type: "call_plugin", pluginId: "minigame_보" },
            { type: "log", label: "management.minigame.paper" },
          ],
        },
      ],
    },
    {
      id: "timer-3m",
      label: "3분 타이머",
      description: "3분 뒤 알림과 대사를 실행하는 타이머 예시예요.",
      actions: [
        { type: "call_plugin", pluginId: "timer" },
        {
          type: "start_timer",
          timer: "cup_ramen",
          duration: 180000,
          actions: [
            { type: "show_notification", title: "타이머 완료", message: "3분이 지났어요!" },
            { type: "play_animation", animation: "jump", duration: 500 },
            { type: "speak_text", text: "3분이 지났어요! 얼른 확인해보세요." },
          ],
        },
        { type: "log", label: "management.start_timer" },
      ],
    },
  ];
}
