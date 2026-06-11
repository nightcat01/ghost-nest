import type { RuntimeEventCatalogItem } from "./eventCatalog.js";

export const hostEventCatalog = [
  {
    event: "page:open",
    label: "페이지 진입",
    description: "호스트 앱에서 특정 페이지나 화면이 열렸을 때 runtime.emit으로 전달하는 이벤트 예시입니다.",
    payloadFields: [
      { name: "page", description: "열린 페이지 또는 화면 id입니다." },
    ],
  },
  {
    event: "feature:selected",
    label: "기능 선택",
    description: "사용자가 호스트 앱의 카드, 메뉴, 기능 버튼을 선택했을 때 전달하는 이벤트 예시입니다.",
    payloadFields: [
      { name: "feature", description: "선택된 기능 id입니다." },
    ],
  },
  {
    event: "feature:completed",
    label: "기능 완료",
    description: "호스트 앱의 샘플 결과, 선택지, 결제, 조회 같은 기능이 완료된 뒤 결과를 전달하는 이벤트 예시입니다.",
    payloadFields: [
      { name: "feature", description: "완료된 기능 id입니다." },
      { name: "result", description: "나니카가 말풍선으로 해석할 결과 요약입니다." },
    ],
  },
  {
    event: "choice:selected",
    label: "항목 선택",
    description: "호스트 앱에서 사용자가 카드나 선택지를 골랐을 때 나니카에 전달하는 이벤트 예시입니다.",
    payloadFields: [
      { name: "choice", description: "선택한 항목 id입니다." },
    ],
  },
] as const satisfies readonly RuntimeEventCatalogItem[];
