import type { PluginResult, RuntimePlugin } from "../../core/types.js";

const sampleResults = [
  {
    title: "정리 완료",
    message: "작은 정리를 하나 끝냈어요. 다음 단계로 넘어가도 좋아요.",
    expression: "happy",
  },
  {
    title: "확인 필요",
    message: "결정하기 전에 입력값과 연결 상태를 한 번 더 확인해보세요.",
    expression: "thinking",
  },
  {
    title: "주의",
    message: "새 기능을 연결할 때는 저장 대상과 실행 조건을 같이 확인하는 게 좋아요.",
    expression: "surprised",
  },
  {
    title: "대기",
    message: "지금은 결과를 기다리는 중이에요. 완료되면 제가 짧게 알려드릴게요.",
    expression: "thinking",
  },
] satisfies [PluginResult, ...PluginResult[]];

export const sampleResultPlugin: RuntimePlugin = {
  id: "sample_result",
  name: "샘플 결과",
  description: "외부 기능이 완료됐다고 가정한 샘플 결과를 캐릭터 말풍선으로 보여줍니다.",
  execute() {
    const index = Math.floor(Math.random() * sampleResults.length);
    return sampleResults[index] ?? sampleResults[0];
  },
};

export function drawSampleResult() {
  return sampleResultPlugin.execute();
}
