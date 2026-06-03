import {
  createNanikaMappingRegistry,
  createRuntimeRuleFromMapping,
  defaultNanikaCommonKeys,
} from "../plugins/nanikaMapping/index.js";
import { nanikaPreset } from "../ghost/preset.js";
import { createDevtoolsApiPath, readApiJson, type DevApiResponse } from "./assetApi.js";
import { requireElement } from "./assetShared.js";
import type { RuntimeAction, RuntimeControlOptions, RuntimeRule } from "../core/types.js";
import type {
  NanikaMapping,
  NanikaFeatureSet,
  CharacterResourceCatalogOption,
  RuntimeActionCatalogCategory,
  RuntimeActionCatalogItem,
  RuntimeActionParameterCatalogItem,
} from "../plugins/nanikaMapping/index.js";

type NanikaMappingsResponse = DevApiResponse & {
  mappings?: NanikaMapping[];
  mapping?: NanikaMapping;
  deletedId?: string;
  path?: string;
};

type NanikaFeatureSetsResponse = DevApiResponse & {
  featureSets?: NanikaFeatureSet[];
  featureSet?: NanikaFeatureSet;
  deletedId?: string;
  path?: string;
};

type DraftMappingResult = {
  mapping: NanikaMapping | null;
  runtimeRule: RuntimeRule | null;
  warnings: string[];
  errors: string[];
};

type MappingScopeId = "runtime" | "character" | "speech" | "ui" | "plugin" | "page" | "data" | "custom";

type StepOption = {
  id: string;
  title: string;
  description: string;
  meta?: string[];
};

type ActionCategoryOption = {
  id: RuntimeActionCatalogCategory;
  title: string;
  description: string;
};

type ParameterOption = CharacterResourceCatalogOption;

type MappingTargetOption = {
  scope: MappingScopeId;
  id: string;
  label: string;
  description: string;
};

type MermaidMenuItem = {
  id?: string;
  label?: string;
  actions?: RuntimeAction[];
  children?: MermaidMenuItem[];
};

type MaterialStatus = "connected" | "reusable" | "required-missing" | "unused";

type MaterialItem = {
  id: string;
  label: string;
  description: string;
  group: string;
  status: MaterialStatus;
  usageCount: number;
};

type FlowBoardNode = {
  id: string;
  title: string;
  description: string;
  meta?: string[];
  variant?: string;
};

type FlowBoardColumn = {
  title: string;
  description: string;
  nodes: FlowBoardNode[];
};

type MermaidRelationMode = "execution" | "reference";

type GraphNodeKind =
  | "runtime"
  | "character"
  | "config"
  | "resource-group"
  | "resource"
  | "event"
  | "mapping"
  | "action"
  | "feature-set";

type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  title: string;
  description: string;
  meta?: string[];
  status?: "ready" | "warning" | "missing";
};

type GraphColumn = {
  id: string;
  title: string;
  description: string;
  nodes: GraphNode[];
};

type FeatureCompatibility = {
  status: "ready" | "partial" | "missing";
  available: number;
  missing: string[];
};

type DetailSource = "대상" | "이벤트" | "실행 영역" | "액션";
type MappingView = "overview" | "create" | "saved" | "feature-sets" | "catalog";
type CatalogView = "summary" | "flow" | "material" | "list" | "graph";

type EditorSelection =
  | { type: "empty" }
  | { type: "character" }
  | { type: "draft" }
  | { type: "mapping"; mapping: RuntimeRule | NanikaMapping; source: "applied" | "saved" }
  | { type: "feature-set"; featureSet: NanikaFeatureSet }
  | { type: "catalog"; title: string; description: string; meta?: string[] };

type CanvasNodeKind =
  | "runtime"
  | "character"
  | "config"
  | "resource-group"
  | "target"
  | "event"
  | "mapping"
  | "action"
  | "group"
  | "resource"
  | "feature-set"
  | "catalog"
  | "missing";

type CanvasNode = {
  id: string;
  kind: CanvasNodeKind;
  resourceKind?: NanikaResourceKind;
  sourceId?: string;
  title: string;
  description: string;
  x: number;
  y: number;
  meta?: string[];
};

type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  relation?: "executes" | "contains" | "references";
};

type CanvasGraph = {
  title: string;
  description: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

type CanvasNodePosition = {
  x: number;
  y: number;
};

type CanvasState = {
  positions: Record<string, CanvasNodePosition>;
  removedNodeIds: string[];
  extraNodes: CanvasNode[];
  extraEdges: CanvasEdge[];
};

type PaletteCategoryId = "characters" | "saved" | "events" | "actions" | "feature-sets" | "resources";

type PaletteItem = {
  id: string;
  kind: CanvasNodeKind;
  resourceKind?: NanikaResourceKind;
  title: string;
  description: string;
  meta?: string[];
};

type NanikaResourceKind = "expression" | "surface" | "scene" | "layer" | "dialogue" | "hitArea";

type PaletteCategory = {
  id: PaletteCategoryId;
  label: string;
};

type ResourceGroupPaletteItem = PaletteItem & {
  kind: "resource-group";
  resourceKind: NanikaResourceKind;
  options: readonly ParameterOption[];
};

type RuntimeProfileOverviewCard = {
  id: string;
  name: string;
  description: string;
  match: string;
  characterId: string;
  initial: string[];
  featureSetIds: string[];
  controls: string[];
};

const registry = createNanikaMappingRegistry(nanikaPreset);
const canvasStateStorageKey = "ghostNest.nanikaMapping.canvasState.v1";
const jsonParameterTypes = new Set([
  "unknown",
  "size-options",
  "action-array",
  "menu-items",
  "script",
  "event-payload",
]);

const scopeOptions: Array<StepOption & { id: MappingScopeId }> = [
  {
    id: "runtime",
    title: "런타임",
    description: "나니카가 시작되거나 내부 타이머/상태가 움직일 때 반응합니다.",
  },
  {
    id: "character",
    title: "캐릭터",
    description: "캐릭터 클릭, 터치, idle 같은 캐릭터 중심 입력에 반응합니다.",
  },
  {
    id: "speech",
    title: "대사",
    description: "대사 버튼, 랜덤 발화, 말풍선 흐름과 연결합니다.",
  },
  {
    id: "ui",
    title: "UI",
    description: "메뉴, hover, 화면 요소 조작 같은 UI 입력에 반응합니다.",
  },
  {
    id: "plugin",
    title: "플러그인",
    description: "플러그인 기능을 호출하거나 기능 실행 결과와 연결합니다.",
  },
  {
    id: "page",
    title: "페이지",
    description: "페이지 진입, 라우팅, 외부 화면 이벤트와 연결합니다.",
  },
  {
    id: "data",
    title: "데이터",
    description: "저장, 로드, 사용자 상태 같은 데이터 흐름과 연결합니다.",
  },
  {
    id: "custom",
    title: "직접 입력",
    description: "카탈로그에 없는 host event나 확장 이벤트를 나중에 연결할 때 사용합니다.",
  },
];

const actionCategoryOptions: ActionCategoryOption[] = [
  { id: "speech", title: "대사", description: "말풍선에 대사를 출력하거나 스크립트를 실행합니다." },
  { id: "character", title: "캐릭터", description: "표정, 캐릭터 상태, 파츠 움직임, 무대 조합을 바꿉니다." },
  { id: "plugin", title: "플러그인", description: "등록된 플러그인 기능을 호출합니다." },
  { id: "ui", title: "UI", description: "말풍선, 메뉴, 런타임 UI 설정을 바꿉니다." },
  { id: "flow", title: "흐름", description: "상태 변경, 타이머, 이벤트 재발행 같은 제어 흐름입니다." },
  { id: "io", title: "입출력", description: "로그, 이동, 사운드, 알림, 저장소 액션입니다." },
];

const requiredEventNames = new Set([
  "runtime:ready",
  "character:click",
  "character:idle",
  "character:randomPrompt",
  "command:line",
]);

const materialStatusLabelMap: Record<MaterialStatus, string> = {
  connected: "사용 중",
  reusable: "재사용 재료",
  "required-missing": "필수 누락",
  unused: "선택 기능",
};

const materialStatusDescriptionMap: Record<MaterialStatus, string> = {
  connected: "현재 연결에서 사용 중입니다.",
  reusable: "여러 연결에서 반복해서 사용할 수 있는 재료입니다.",
  "required-missing": "기본 사용 흐름에 필요하지만 아직 연결되지 않았습니다.",
  unused: "필요할 때 연결할 수 있는 선택 기능입니다.",
};

const eventLabelMap: Record<string, string> = {
  "runtime:ready": "나니카 시작",
  "character:click": "캐릭터 클릭",
  "character:double_click": "캐릭터 더블 클릭",
  "character:touch": "캐릭터 영역 터치",
  "character:right_click": "캐릭터 우클릭",
  "area:hover": "화면 영역 hover",
  "character:randomPrompt": "랜덤 발화",
  "character:idle": "Idle 반응",
  "command:hover": "명령 버튼 hover",
  "command:line": "대사 버튼",
  "command:hide": "숨김 버튼",
};

const actionLabelMap: Record<string, string> = {
  speak: "대사 카테고리 말하기",
  speak_text: "고정 문장 말하기",
  speak_script: "대사 스크립트 실행",
  change_expression: "표정 변경",
  surface: "캐릭터 상태 변경",
  scene: "무대 조합 변경",
  scene_overlay: "무대 오버레이 켜기/끄기",
  set_touched_part: "터치 부위 기록",
  toggle_hidden: "표시 전환",
  call_plugin: "플러그인 호출",
  log: "로그 추가",
  touch_interaction: "상호작용 시각 갱신",
  mark_prompted: "랜덤 발화 시각 갱신",
  run_sequence: "순서대로 묶음 실행",
  run_parallel: "동시에 묶음 실행",
  run_random: "랜덤으로 하나 실행",
  play_animation: "CSS 애니메이션 재생",
  play_layer_animation: "파츠 애니메이션 재생",
  open_ui: "UI 열기",
  close_ui: "UI 닫기",
  navigate: "페이지 이동",
  set_state: "상태 변경",
  emit_event: "이벤트 발생",
  play_sound: "사운드 재생",
  save_data: "데이터 저장",
  load_data: "데이터 불러오기",
  show_notification: "알림 표시",
  start_timer: "타이머 시작",
  stop_timer: "타이머 중지",
  move_character: "캐릭터 위치 이동",
  change_balloon: "말풍선 테마 변경",
  change_balloon_font_size: "말풍선 글자 크기 변경",
  change_speech_layout: "대사창 배치 변경",
  set_speech_balloon_size: "대사창 크기 변경",
  open_management_menu: "관리 메뉴 열기",
  set_management_menu_display: "관리 메뉴 표시 방식 변경",
  reset_runtime_ui: "런타임 UI 초기화",
  close_management_menu: "관리 메뉴 닫기",
};

const actionGroupDescriptions: Record<"run_sequence" | "run_parallel" | "run_random", {
  summary: string;
  status: string;
}> = {
  run_sequence: {
    summary: "묶음 안의 액션을 위에서 아래 순서대로 실행합니다.",
    status: "현재 액션 플로우를 순서대로 실행하는 묶음으로 만들었어요.",
  },
  run_parallel: {
    summary: "묶음 안의 액션을 가능한 한 동시에 실행합니다.",
    status: "현재 액션 플로우를 동시에 실행하는 묶음으로 만들었어요.",
  },
  run_random: {
    summary: "묶음 안의 액션 중 하나만 랜덤으로 골라 실행합니다.",
    status: "현재 액션 플로우를 랜덤으로 하나만 실행하는 묶음으로 만들었어요.",
  },
};

const parameterLabelMap: Record<string, string> = {
  category: "대사 묶음",
  expression: "표정 이미지",
  id: "변경 대상",
  layerId: "파츠",
  pluginId: "플러그인",
  part: "터치 영역",
  theme: "말풍선 테마",
  mode: "대사창 방식",
  placement: "대사창 위치",
  display: "표시 방식",
  state: "상태",
  event: "이벤트",
  target: "UI 대상",
};

const balloonThemeOptions: ParameterOption[] = [
  { id: "default", label: "기본", description: "기본 말풍선 테마" },
  { id: "soft", label: "밝고 부드러운 말풍선", description: "저장 키: soft" },
  { id: "dark", label: "어두운 배경용 말풍선", description: "저장 키: dark" },
  { id: "fortune-master", label: "포춘마스터 말풍선", description: "저장 키: fortune-master / 포춘마스터 화면에 맞춘 반투명 말풍선 테마" },
];

const speechLayoutOptions: ParameterOption[] = [
  { id: "floating", label: "말풍선", description: "캐릭터 주변에 떠 있는 말풍선" },
  { id: "dialogue-box", label: "하단 대사창", description: "미연시/RPG처럼 하단에 고정되는 대사창" },
];

const speechPlacementOptions: ParameterOption[] = [
  { id: "below-character", label: "캐릭터 아래", description: "캐릭터 영역 아래에 대사창을 배치합니다." },
  { id: "overlay-bottom", label: "하단 오버레이", description: "캐릭터 영역 위 하단에 겹쳐 배치합니다." },
];

const managementMenuDisplayOptions: ParameterOption[] = [
  { id: "balloon", label: "말풍선 안", description: "관리 메뉴를 말풍선 안에 표시합니다." },
  { id: "panel", label: "별도 패널", description: "관리 메뉴를 별도 패널로 표시합니다." },
];

const genericFeatureRequirements = [
  { kind: "expression", id: "neutral", label: "기본 표정", required: true },
  { kind: "expression", id: "happy", label: "기쁜 표정", required: true },
  { kind: "expression", id: "thinking", label: "생각하는 표정", required: true },
  { kind: "expression", id: "surprised", label: "놀란 표정", required: true },
  { kind: "scene", id: "rine-demo-scene", label: "기본 무대", required: false },
  { kind: "dialogue", id: "onMount", label: "시작 대사", required: true },
  { kind: "dialogue", id: "onClick", label: "클릭 대사", required: true },
  { kind: "dialogue", id: "onIdle", label: "대기 대사", required: true },
  { kind: "dialogue", id: "onRandomPrompt", label: "랜덤 발화 대사", required: true },
  { kind: "hitArea", id: "head", label: "머리 터치 영역", required: false },
  { kind: "hitArea", id: "face", label: "얼굴 터치 영역", required: false },
  { kind: "hitArea", id: "body", label: "몸 터치 영역", required: false },
] satisfies NonNullable<NanikaFeatureSet["requirements"]>;

const runtimeProfileOverviewCards: RuntimeProfileOverviewCard[] = [
  {
    id: "fortune.home.rine",
    name: "포춘마스터 홈",
    description: "홈 화면에서 리네를 안내 캐릭터로 시작하는 런타임 프로필입니다.",
    match: "pageId: home",
    characterId: "rine",
    initial: ["surface: 0", "scene: desk-room-default"],
    featureSetIds: ["fortune-home-core"],
    controls: ["hover", "drag", "managementMenu"],
  },
  {
    id: "fortune.zodiac.rine",
    name: "포춘마스터 별자리",
    description: "별자리 선택 화면에서 다른 시작 상태와 대사를 쓰는 런타임 프로필입니다.",
    match: "pageId: zodiac",
    characterId: "rine",
    initial: ["surface: 8", "scene: desk-room-default"],
    featureSetIds: ["fortune-zodiac-core"],
    controls: ["hover off", "drag off", "managementMenu off"],
  },
];

const runtimeStateOptions: ParameterOption[] = [
  { id: "idle", label: "대기 상태", description: "저장 키: idle" },
  { id: "speaking", label: "말하는 중", description: "저장 키: speaking" },
  { id: "thinking", label: "생각하는 중", description: "저장 키: thinking" },
  { id: "hidden", label: "숨김 상태", description: "저장 키: hidden" },
];

const maxActionFlowSteps = 8;
const mappingTargetSeparator = "::";

function createMappingTargetValue(scope: string, id: string) {
  return `${scope}${mappingTargetSeparator}${id}`;
}

const targetOptions: MappingTargetOption[] = [
  {
    scope: "runtime",
    id: registry.preset.id,
    label: `런타임: ${registry.preset.name}`,
    description: "나니카 런타임 전체에 연결합니다.",
  },
  {
    scope: "character",
    id: registry.character.id,
    label: `캐릭터: ${registry.character.name}`,
    description: "현재 캐릭터의 입력과 상태에 연결합니다.",
  },
  {
    scope: "speech",
    id: "speech",
    label: "대사 / 말풍선",
    description: "대사 출력과 말풍선 UI에 연결합니다.",
  },
  {
    scope: "ui",
    id: "ui",
    label: "UI / 메뉴",
    description: "메뉴, 버튼, 화면 UI에 연결합니다.",
  },
  ...registry.capabilities.map((capability): MappingTargetOption => ({
    scope: "plugin",
    id: capability.action.pluginId,
    label: `기능: ${capability.name}`,
    description: capability.description ?? capability.id,
  })),
];

let selectedScope: MappingScopeId | null = null;
let selectedEvent: string | null = null;
let selectedActionCategory: RuntimeActionCatalogCategory | null = null;
let selectedActionType: string | null = null;
let draftActionFlow: RuntimeAction[] = [];
let savedMappings: NanikaMapping[] = [];
let savedMappingsLoaded = false;
let savedFeatureSets: NanikaFeatureSet[] = [];
let selectedSnippetFeatureSetIds = new Set<string>();
let mappingGraphZoom = 1;
let mappingGraphExpanded = false;
let activeView: MappingView = "overview";
let editorSelection: EditorSelection = { type: "character" };
let selectedPaletteCategory: PaletteCategoryId = "resources";
let activeCatalogView: CatalogView = "summary";
let editorReadOnly = false;
let editorCanvasZoom = 1;
let emptyEditorTitle = "선택된 항목 없음";
let emptyEditorDescription = "카드를 선택하면 이 영역이 공통 편집 캔버스처럼 바뀝니다. 다음 단계에서는 이 재료를 드래그해서 연결하는 방식으로 확장할 수 있습니다.";
let emptyEditorMeta = ["대기 중"];
let currentEditorGraph: CanvasGraph | null = null;
let currentEditorGraphKey = "empty";
let selectedCanvasNodeId: string | null = null;
let pendingConnectionNodeId: string | null = null;
let selectedCanvasNodeForPopover: CanvasNode | null = null;
const canvasStateByKey = new Map<string, CanvasState>();

function loadCanvasStatesFromStorage() {
  try {
    const raw = window.localStorage.getItem(canvasStateStorageKey);
    if (!raw) {
      return;
    }

    const entries = JSON.parse(raw) as Array<[string, CanvasState]>;
    if (!Array.isArray(entries)) {
      return;
    }

    entries.forEach(([key, state]) => {
      if (typeof key === "string" && state && typeof state === "object") {
        canvasStateByKey.set(key, {
          positions: state.positions ?? {},
          removedNodeIds: state.removedNodeIds ?? [],
          extraNodes: state.extraNodes ?? [],
          extraEdges: state.extraEdges ?? [],
        });
      }
    });
  } catch {
    canvasStateByKey.clear();
  }
}

function saveCanvasStatesToStorage() {
  window.localStorage.setItem(
    canvasStateStorageKey,
    JSON.stringify(Array.from(canvasStateByKey.entries())),
  );
}
let lastDraftResult: DraftMappingResult = {
  mapping: null,
  runtimeRule: null,
  warnings: [],
  errors: ["시작 영역을 선택하세요."],
};

const summary = requireElement(document.querySelector<HTMLElement>("#mappingSummary"), "#mappingSummary");
const runtimeProfileOverview = requireElement(document.querySelector<HTMLElement>("#runtimeProfileOverview"), "#runtimeProfileOverview");
const connectionMap = requireElement(document.querySelector<HTMLElement>("#connectionMap"), "#connectionMap");
const mappingFlowBoard = requireElement(document.querySelector<HTMLElement>("#mappingFlowBoard"), "#mappingFlowBoard");
const materialMap = requireElement(document.querySelector<HTMLElement>("#materialMap"), "#materialMap");
const catalogMaterialMap = requireElement(document.querySelector<HTMLElement>("#catalogMaterialMap"), "#catalogMaterialMap");
const characterList = requireElement(document.querySelector<HTMLElement>("#characterList"), "#characterList");
const capabilityList = requireElement(document.querySelector<HTMLElement>("#capabilityList"), "#capabilityList");
const eventList = requireElement(document.querySelector<HTMLElement>("#eventList"), "#eventList");
const actionList = requireElement(document.querySelector<HTMLElement>("#actionList"), "#actionList");
const mappingList = requireElement(document.querySelector<HTMLElement>("#mappingList"), "#mappingList");
const mappingCoverage = requireElement(document.querySelector<HTMLElement>("#mappingCoverage"), "#mappingCoverage");
const mappingGraphPanel = requireElement(document.querySelector<HTMLElement>("#mappingGraphPanel"), "#mappingGraphPanel");
const mappingGraphViewport = requireElement(document.querySelector<HTMLElement>("#mappingGraphViewport"), "#mappingGraphViewport");
const mappingGraphToggleButton = requireElement(document.querySelector<HTMLButtonElement>("#mappingGraphToggleButton"), "#mappingGraphToggleButton");
const mappingGraphZoomOutButton = requireElement(document.querySelector<HTMLButtonElement>("#mappingGraphZoomOutButton"), "#mappingGraphZoomOutButton");
const mappingGraphZoomInButton = requireElement(document.querySelector<HTMLButtonElement>("#mappingGraphZoomInButton"), "#mappingGraphZoomInButton");
const mappingGraphResetButton = requireElement(document.querySelector<HTMLButtonElement>("#mappingGraphResetButton"), "#mappingGraphResetButton");
const mappingMermaidPreview = requireElement(document.querySelector<HTMLPreElement>("#mappingMermaidPreview"), "#mappingMermaidPreview");
const copyMermaidButton = requireElement(document.querySelector<HTMLButtonElement>("#copyMermaidButton"), "#copyMermaidButton");
const savedMappingList = requireElement(document.querySelector<HTMLElement>("#savedMappingList"), "#savedMappingList");
const savedFlowBoard = requireElement(document.querySelector<HTMLElement>("#savedFlowBoard"), "#savedFlowBoard");
const savedMappingStatus = requireElement(document.querySelector<HTMLElement>("#savedMappingStatus"), "#savedMappingStatus");
const mappingSnippetPreview = requireElement(document.querySelector<HTMLPreElement>("#mappingSnippetPreview"), "#mappingSnippetPreview");
const mappingSnippetHelp = requireElement(document.querySelector<HTMLElement>("#mappingSnippetHelp"), "#mappingSnippetHelp");
const snippetFeatureSetPicker = requireElement(document.querySelector<HTMLElement>("#snippetFeatureSetPicker"), "#snippetFeatureSetPicker");
const draftScopeOptions = requireElement(document.querySelector<HTMLElement>("#draftScopeOptions"), "#draftScopeOptions");
const draftEventOptions = requireElement(document.querySelector<HTMLElement>("#draftEventOptions"), "#draftEventOptions");
const draftActionCategoryOptions = requireElement(document.querySelector<HTMLElement>("#draftActionCategoryOptions"), "#draftActionCategoryOptions");
const draftActionOptions = requireElement(document.querySelector<HTMLElement>("#draftActionOptions"), "#draftActionOptions");
const draftMappingIdInput = requireElement(document.querySelector<HTMLInputElement>("#draftMappingIdInput"), "#draftMappingIdInput");
const draftMappingNameInput = requireElement(document.querySelector<HTMLInputElement>("#draftMappingNameInput"), "#draftMappingNameInput");
const draftTargetSelect = requireElement(document.querySelector<HTMLSelectElement>("#draftTargetSelect"), "#draftTargetSelect");
const draftEventHelp = requireElement(document.querySelector<HTMLElement>("#draftEventHelp"), "#draftEventHelp");
const draftActionHelp = requireElement(document.querySelector<HTMLElement>("#draftActionHelp"), "#draftActionHelp");
const draftActionParameters = requireElement(document.querySelector<HTMLElement>("#draftActionParameters"), "#draftActionParameters");
const draftActionFlowList = requireElement(document.querySelector<HTMLElement>("#draftActionFlowList"), "#draftActionFlowList");
const draftFlowPreview = requireElement(document.querySelector<HTMLElement>("#draftFlowPreview"), "#draftFlowPreview");
const mappingDetailPanel = requireElement(document.querySelector<HTMLElement>("#mappingDetailPanel"), "#mappingDetailPanel");
const draftMappingPreview = requireElement(document.querySelector<HTMLPreElement>("#draftMappingPreview"), "#draftMappingPreview");
const draftMappingStatus = requireElement(document.querySelector<HTMLElement>("#draftMappingStatus"), "#draftMappingStatus");
const saveDraftMappingButton = requireElement(document.querySelector<HTMLButtonElement>("#saveDraftMappingButton"), "#saveDraftMappingButton");
const copyDraftMappingButton = requireElement(document.querySelector<HTMLButtonElement>("#copyDraftMappingButton"), "#copyDraftMappingButton");
const copyRuntimeRuleButton = requireElement(document.querySelector<HTMLButtonElement>("#copyRuntimeRuleButton"), "#copyRuntimeRuleButton");
const addSelectedActionButton = requireElement(document.querySelector<HTMLButtonElement>("#addSelectedActionButton"), "#addSelectedActionButton");
const wrapSequenceButton = requireElement(document.querySelector<HTMLButtonElement>("#wrapSequenceButton"), "#wrapSequenceButton");
const wrapParallelButton = requireElement(document.querySelector<HTMLButtonElement>("#wrapParallelButton"), "#wrapParallelButton");
const wrapRandomButton = requireElement(document.querySelector<HTMLButtonElement>("#wrapRandomButton"), "#wrapRandomButton");
const copyMappingSnippetButton = requireElement(document.querySelector<HTMLButtonElement>("#copyMappingSnippetButton"), "#copyMappingSnippetButton");
const refreshSavedMappingsButton = requireElement(document.querySelector<HTMLButtonElement>("#refreshSavedMappingsButton"), "#refreshSavedMappingsButton");
const saveFeatureSetButton = requireElement(document.querySelector<HTMLButtonElement>("#saveFeatureSetButton"), "#saveFeatureSetButton");
const refreshFeatureSetsButton = requireElement(document.querySelector<HTMLButtonElement>("#refreshFeatureSetsButton"), "#refreshFeatureSetsButton");
const featureSetIdInput = requireElement(document.querySelector<HTMLInputElement>("#featureSetIdInput"), "#featureSetIdInput");
const featureSetNameInput = requireElement(document.querySelector<HTMLInputElement>("#featureSetNameInput"), "#featureSetNameInput");
const featureSetPreview = requireElement(document.querySelector<HTMLElement>("#featureSetPreview"), "#featureSetPreview");
const featureSetMappingPicker = requireElement(document.querySelector<HTMLElement>("#featureSetMappingPicker"), "#featureSetMappingPicker");
const featureSetFlowBoard = requireElement(document.querySelector<HTMLElement>("#featureSetFlowBoard"), "#featureSetFlowBoard");
const featureSetStatus = requireElement(document.querySelector<HTMLElement>("#featureSetStatus"), "#featureSetStatus");
const featureSetList = requireElement(document.querySelector<HTMLElement>("#featureSetList"), "#featureSetList");
const mappingPaletteTabs = requireElement(document.querySelector<HTMLElement>("#mappingPaletteTabs"), "#mappingPaletteTabs");
const mappingPaletteDeck = requireElement(document.querySelector<HTMLElement>("#mappingPaletteDeck"), "#mappingPaletteDeck");
const mappingEditorHelp = requireElement(document.querySelector<HTMLElement>("#mappingEditorHelp"), "#mappingEditorHelp");
const mappingEditorStats = requireElement(document.querySelector<HTMLElement>("#mappingEditorStats"), "#mappingEditorStats");
const mappingEditorCanvas = requireElement(document.querySelector<HTMLElement>("#mappingEditorCanvas"), "#mappingEditorCanvas");
const mappingEditorDetail = requireElement(document.querySelector<HTMLElement>("#mappingEditorDetail"), "#mappingEditorDetail");
const editorLoadDraftButton = requireElement(document.querySelector<HTMLButtonElement>("#editorLoadDraftButton"), "#editorLoadDraftButton");
const editorAddToFeatureSetButton = requireElement(document.querySelector<HTMLButtonElement>("#editorAddToFeatureSetButton"), "#editorAddToFeatureSetButton");
const editorSaveButton = requireElement(document.querySelector<HTMLButtonElement>("#editorSaveButton"), "#editorSaveButton");
const editorZoomOutButton = requireElement(document.querySelector<HTMLButtonElement>("#editorZoomOutButton"), "#editorZoomOutButton");
const editorZoomInButton = requireElement(document.querySelector<HTMLButtonElement>("#editorZoomInButton"), "#editorZoomInButton");
const editorZoomResetButton = requireElement(document.querySelector<HTMLButtonElement>("#editorZoomResetButton"), "#editorZoomResetButton");
const editorCopyGraphButton = requireElement(document.querySelector<HTMLButtonElement>("#editorCopyGraphButton"), "#editorCopyGraphButton");
const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view-target]"));
const editorModeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-editor-mode-target]"));
const viewSections = Array.from(document.querySelectorAll<HTMLElement>(".nanika-view-section"));
const catalogButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-catalog-target]"));
const catalogSections = Array.from(document.querySelectorAll<HTMLElement>("[data-catalog-section]"));

function getReadableEventLabel(event: string) {
  return eventLabelMap[event] ?? event;
}

function getReadableActionLabel(actionType: string) {
  return actionLabelMap[actionType] ?? actionType;
}

function getReadableParameterLabel(parameterName: string) {
  return parameterLabelMap[parameterName] ?? parameterName;
}

function getSelectedTargetOption(): MappingTargetOption | undefined {
  return targetOptions.find((target) => createMappingTargetValue(target.scope, target.id) === draftTargetSelect.value);
}

function getParameterOptions(actionType: string, parameterName: string): ParameterOption[] {
  const { characterResources } = registry;

  if (actionType === "speak" && parameterName === "category") {
    return characterResources.dialogueCategories;
  }

  if (actionType === "change_expression" && parameterName === "expression") {
    return characterResources.expressions;
  }

  if (actionType === "surface" && parameterName === "id") {
    return characterResources.surfaces;
  }

  if ((actionType === "scene" || actionType === "scene_overlay") && parameterName === "id") {
    return characterResources.scenes;
  }

  if (actionType === "play_layer_animation" && parameterName === "layerId") {
    return characterResources.layers;
  }

  if (actionType === "set_touched_part" && parameterName === "part") {
    return characterResources.touchParts;
  }

  if (actionType === "call_plugin" && parameterName === "pluginId") {
    return registry.capabilities.map((capability) => ({
      id: capability.action.pluginId,
      label: capability.name,
      description: capability.description ?? capability.id,
    }));
  }

  if (actionType === "change_balloon" && parameterName === "theme") {
    return balloonThemeOptions;
  }

  if (actionType === "change_speech_layout" && parameterName === "mode") {
    return speechLayoutOptions;
  }

  if (actionType === "change_speech_layout" && parameterName === "placement") {
    return speechPlacementOptions;
  }

  if (actionType === "set_management_menu_display" && parameterName === "display") {
    return managementMenuDisplayOptions;
  }

  if (actionType === "set_state" && parameterName === "state") {
    return runtimeStateOptions;
  }

  if (actionType === "emit_event" && parameterName === "event") {
    return registry.events.map((event) => ({
      id: event.event,
      label: getReadableEventLabel(event.event),
      description: event.description,
    }));
  }

  return [];
}

function getEventScope(event: string): MappingScopeId {
  if (event.startsWith("runtime:")) {
    return "runtime";
  }

  if (event === "character:randomPrompt" || event === "command:line") {
    return "speech";
  }

  if (event.startsWith("character:")) {
    return "character";
  }

  if (event.startsWith("command:") || event === "area:hover") {
    return "ui";
  }

  if (event.startsWith("page:") || event.startsWith("route:")) {
    return "page";
  }

  if (event.startsWith("data:")) {
    return "data";
  }

  return "custom";
}

function setEditorMode(view: MappingView) {
  activeView = view;
  editorModeButtons.forEach((button) => {
    button.dataset.active = button.dataset.editorModeTarget === view ? "true" : "false";
  });

  if (view === "create") {
    emptyEditorTitle = "새 연결 만들기";
    emptyEditorDescription = "작업판을 비우고 새 연결 흐름을 준비합니다. 대상, 이벤트, 액션을 고르면 이 캔버스에 연결이 그려집니다.";
    emptyEditorMeta = ["새 연결"];
    selectEditorDraft();
  } else if (view === "saved") {
    selectedPaletteCategory = "saved";
    emptyEditorTitle = "저장 연결";
    emptyEditorDescription = "왼쪽 카드 덱에서 저장된 연결을 고르면 작업판에 불러옵니다. 불러온 연결은 새 연결로 복사하거나 기능 묶음에 추가할 수 있습니다.";
    emptyEditorMeta = ["저장된 연결 선택"];
    setEditorSelection({ type: "empty" });
  } else if (view === "feature-sets") {
    selectedPaletteCategory = "feature-sets";
    emptyEditorTitle = "기능 묶음";
    emptyEditorDescription = "왼쪽 카드 덱에서 기능 묶음을 고르면 포함된 연결을 작업판에서 확인합니다. 저장 연결을 묶음에 추가할 수도 있습니다.";
    emptyEditorMeta = ["기능 묶음 선택"];
    setEditorSelection({ type: "empty" });
  } else if (view === "catalog") {
    renderEditorCanvas();
  } else {
    selectCharacterInEditor(false);
  }
}

function setActiveView(view: MappingView) {
  if (view !== "overview" && view !== "catalog") {
    setEditorMode(view);
    return;
  }

  activeView = view;
  viewButtons.forEach((button) => {
    button.dataset.active = button.dataset.viewTarget === view ? "true" : "false";
  });

  viewSections.forEach((section) => {
    section.hidden = view !== "catalog" || section.dataset.view !== "catalog";
  });
  renderCatalogView();

  if (view === "overview") {
    const editorPanel = mappingEditorCanvas.closest<HTMLElement>(".nanika-editor-panel");
    if (editorPanel) {
      editorPanel.hidden = false;
    }
    setEditorMode("overview");
  } else {
    renderEditorCanvas();
  }
}

function renderCatalogView() {
  const editorPanel = mappingEditorCanvas.closest<HTMLElement>(".nanika-editor-panel");
  if (editorPanel) {
    editorPanel.hidden = activeView === "catalog" && activeCatalogView !== "list";
  }

  catalogButtons.forEach((button) => {
    button.dataset.active = button.dataset.catalogTarget === activeCatalogView ? "true" : "false";
  });

  catalogSections.forEach((section) => {
    section.hidden = activeView !== "catalog" || section.dataset.catalogSection !== activeCatalogView;
  });
}

function syncCatalogEditorState() {
  if (activeView !== "catalog") {
    return;
  }

  editorReadOnly = true;
  selectedCanvasNodeForPopover = null;
  pendingConnectionNodeId = null;
  renderEditorCanvas();
}

function initViewNavigation() {
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.viewTarget as MappingView | undefined;

      if (!nextView) {
        return;
      }

      setActiveView(nextView);
    });
  });

  editorModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.editorModeTarget as MappingView | undefined;

      if (!nextMode) {
        return;
      }

      setActiveView("overview");
      setEditorMode(nextMode);
    });
  });

  catalogButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.catalogTarget as CatalogView | undefined;

      if (!nextView) {
        return;
      }

      activeCatalogView = nextView;
      renderCatalogView();
      syncCatalogEditorState();
    });
  });

  setActiveView("overview");
}

function createCard(title: string, description: string, meta: string[] = []) {
  const card = document.createElement("article");
  card.className = "nanika-mapping-card";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const body = document.createElement("p");
  body.textContent = description;

  card.append(heading, body);

  if (meta.length > 0) {
    const metaList = document.createElement("div");
    metaList.className = "nanika-mapping-meta";

    meta.forEach((item) => {
      const pill = document.createElement("span");
      pill.textContent = item;
      metaList.append(pill);
    });

    card.append(metaList);
  }

  return card;
}

function createPaletteCard(title: string, description: string, meta: string[] = []) {
  const card = createCard(title, description, meta);
  card.dataset.palette = "true";
  const controls = document.createElement("div");
  controls.className = "asset-lab-button-row";
  controls.append(createActionButton("편집기에서 보기", () => selectCatalogInEditor(title, description, meta)));
  card.append(controls);

  return card;
}

function createFlowNode(title: string, subtitle?: string, variant = "default") {
  const node = document.createElement("div");
  node.className = "nanika-result-flow-node";
  node.dataset.variant = variant;

  const strong = document.createElement("strong");
  strong.textContent = title;
  node.append(strong);

  if (subtitle) {
    const small = document.createElement("small");
    small.textContent = subtitle;
    node.append(small);
  }

  return node;
}

function createMaterialNode(item: MaterialItem) {
  const node = createFlowNode(item.label, `${materialStatusLabelMap[item.status]} · ${item.usageCount}곳`, item.status);

  node.title = `${item.description}\n${materialStatusDescriptionMap[item.status]}`;

  return node;
}

function createFlowArrow() {
  const arrow = document.createElement("span");
  arrow.className = "nanika-result-flow-arrow";
  arrow.textContent = "→";

  return arrow;
}

function createFlowBoardNode(node: FlowBoardNode) {
  const element = document.createElement("article");
  element.className = "nanika-flow-board-node";
  element.dataset.variant = node.variant ?? "default";

  const title = document.createElement("strong");
  title.textContent = node.title;

  const description = document.createElement("p");
  description.textContent = node.description;

  element.append(title, description);

  if (node.meta && node.meta.length > 0) {
    const meta = document.createElement("div");
    meta.className = "nanika-mapping-meta";
    node.meta.forEach((item) => {
      const pill = document.createElement("span");
      pill.textContent = item;
      meta.append(pill);
    });
    element.append(meta);
  }

  return element;
}

function createFlowBoardColumn(column: FlowBoardColumn) {
  const section = document.createElement("section");
  section.className = "nanika-flow-board-column";

  const header = document.createElement("div");
  header.className = "nanika-flow-board-heading";

  const title = document.createElement("h3");
  title.textContent = column.title;

  const description = document.createElement("p");
  description.textContent = column.description;

  header.append(title, description);

  const nodes = document.createElement("div");
  nodes.className = "nanika-flow-board-nodes";
  nodes.replaceChildren(
    ...(column.nodes.length > 0
      ? column.nodes.map(createFlowBoardNode)
      : [createFlowBoardNode({
        id: `${column.title}:empty`,
        title: "항목 없음",
        description: "아직 이 단계에 표시할 항목이 없습니다.",
        variant: "missing",
      })]),
  );

  section.append(header, nodes);

  return section;
}

function renderFlowBoard(target: HTMLElement, columns: FlowBoardColumn[]) {
  target.replaceChildren(...columns.map(createFlowBoardColumn));
}

function createProfileOverviewCard(profile: RuntimeProfileOverviewCard) {
  const card = document.createElement("article");
  const heading = document.createElement("h3");
  const description = document.createElement("p");
  const meta = document.createElement("div");
  const knownFeatureSetIds = new Set(savedFeatureSets.map((featureSet) => featureSet.id));
  const featureStatus = profile.featureSetIds.length === 0
    ? "feature set 없음"
    : profile.featureSetIds.every((featureSetId) => knownFeatureSetIds.has(featureSetId))
      ? "feature set 저장됨"
      : "feature set 초안/코드 기준";

  card.className = "nanika-runtime-profile-card";
  card.dataset.profileId = profile.id;
  heading.textContent = profile.name;
  description.textContent = profile.description;
  meta.className = "nanika-mapping-meta";
  [
    profile.id,
    profile.match,
    `character: ${profile.characterId}`,
    ...profile.initial,
    featureStatus,
    `common keys: ${defaultNanikaCommonKeys.length}`,
    ...profile.controls.map((control) => `control: ${control}`),
  ].forEach((item) => {
    const pill = document.createElement("span");

    pill.textContent = item;
    meta.append(pill);
  });
  card.append(heading, description, meta);

  return card;
}

function renderRuntimeProfileOverview() {
  runtimeProfileOverview.replaceChildren(...runtimeProfileOverviewCards.map(createProfileOverviewCard));
}

function createEditorMeta(meta: readonly string[] = []) {
  const metaList = document.createElement("div");
  metaList.className = "nanika-mapping-meta";
  meta.forEach((item) => {
    const pill = document.createElement("span");
    pill.textContent = item;
    metaList.append(pill);
  });

  return metaList;
}

function createEditorSummary(title: string, description: string, meta: readonly string[] = []) {
  const summaryPanel = document.createElement("div");
  summaryPanel.className = "nanika-editor-summary";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const body = document.createElement("p");
  body.textContent = description;

  summaryPanel.append(heading, body);
  if (meta.length > 0) {
    summaryPanel.append(createEditorMeta(meta));
  }

  return summaryPanel;
}

function createCanvasNode(
  id: string,
  kind: CanvasNodeKind,
  title: string,
  description: string,
  x: number,
  y: number,
  meta: string[] = [],
  resourceKind?: NanikaResourceKind,
): CanvasNode {
  return {
    id,
    kind,
    ...(resourceKind ? { resourceKind } : {}),
    title,
    description,
    x,
    y,
    meta,
  };
}

function createActionCanvasNodes(
  action: RuntimeAction,
  index: number,
  parentId: string,
  graph: CanvasGraph,
  baseX: number,
  baseY: number,
  prefix: string,
) {
  const record = action as Record<string, unknown>;
  const nestedActions = Array.isArray(record.actions) ? record.actions as RuntimeAction[] : [];
  const nodeId = `${prefix}:action:${index}:${action.type}`;
  const kind: CanvasNodeKind = nestedActions.length > 0 ? "group" : "action";

  graph.nodes.push(createCanvasNode(
    nodeId,
    kind,
    `${index + 1}. ${getReadableActionLabel(action.type)}`,
    nestedActions.length > 0 ? `${nestedActions.length}개 액션을 포함합니다.` : formatAction(action),
    baseX,
    baseY,
    [action.type],
  ));
  graph.edges.push({
    id: `${parentId}->${nodeId}`,
    from: parentId,
    to: nodeId,
    relation: "executes",
  });

  nestedActions.forEach((nestedAction, nestedIndex) => {
    createActionCanvasNodes(
      nestedAction,
      nestedIndex,
      nodeId,
      graph,
      baseX + 230,
      baseY + (nestedIndex * 116),
      `${prefix}:${index}`,
    );
  });

  return nodeId;
}

function createMappingCanvasGraph(mapping: RuntimeRule | NanikaMapping, source: "applied" | "saved" | "draft" = "applied"): CanvasGraph {
  const mappingName = (mapping as NanikaMapping).name ?? mapping.id;
  const targetId = "target";
  const eventId = "event";
  const mappingId = "mapping";
  const graph: CanvasGraph = {
    title: mappingName,
    description: `${getReadableEventLabel(mapping.event)} 이벤트에서 ${countNestedActions(mapping.actions)}개 액션을 실행합니다.`,
    nodes: [
      createCanvasNode(targetId, "target", getMappingTargetLabel(mapping), source === "saved" ? "저장된 연결 대상" : "실행 대상", 24, 96, [source]),
      createCanvasNode(eventId, "event", getReadableEventLabel(mapping.event), mapping.event, 260, 96, [`event: ${mapping.event}`]),
      createCanvasNode(mappingId, "mapping", mappingName, mapping.id, 496, 96, [`id: ${mapping.id}`]),
    ],
    edges: [
      { id: "target->event", from: targetId, to: eventId, relation: "executes" },
      { id: "event->mapping", from: eventId, to: mappingId, relation: "executes" },
    ],
  };

  let previousId = mappingId;
  mapping.actions.forEach((action, index) => {
    previousId = createActionCanvasNodes(
      action,
      index,
      previousId,
      graph,
      732 + (index * 230),
      96,
      `mapping:${mapping.id}`,
    );
  });

  return graph;
}

function removeActionsFromMappingCanvas(
  actions: readonly RuntimeAction[],
  removedNodeIds: ReadonlySet<string>,
  prefix: string,
): RuntimeAction[] {
  return actions.flatMap((action, index) => {
    const nodeId = `${prefix}:action:${index}:${action.type}`;

    if (removedNodeIds.has(nodeId)) {
      return [];
    }

    const actionRecord = action as RuntimeAction & { actions?: RuntimeAction[] };
    if (!Array.isArray(actionRecord.actions)) {
      return [cloneRuntimeAction(action)];
    }

    const nestedActions = removeActionsFromMappingCanvas(
      actionRecord.actions,
      removedNodeIds,
      `${prefix}:${index}`,
    );

    if (nestedActions.length === 0) {
      return [];
    }

    return [{
      ...cloneRuntimeAction(action),
      actions: nestedActions,
    } as RuntimeAction];
  });
}

function getCanvasNodeSourceId(node: CanvasNode) {
  if (node.sourceId) {
    return node.sourceId;
  }

  const keyMeta = node.meta?.find((item) => item.startsWith("key: "));
  if (keyMeta) {
    return keyMeta.slice("key: ".length);
  }

  const parts = node.id.split(":");
  if (parts[0] === "palette") {
    const hasResourceKind = getCanvasNodeResourceKind(node) !== null;
    const sourceIndex = hasResourceKind ? 3 : 2;

    return parts[sourceIndex] ?? node.id;
  }

  const [, ...rest] = node.id.split(":");

  return rest.length > 0 ? rest.join(":") : node.id;
}

function getConnectedResourceForAction(graph: CanvasGraph, actionNode: CanvasNode) {
  const resourceNodeIds = graph.edges
    .filter((edge) => edge.relation === "references" && (edge.from === actionNode.id || edge.to === actionNode.id))
    .map((edge) => edge.from === actionNode.id ? edge.to : edge.from);

  return resourceNodeIds
    .map((nodeId) => graph.nodes.find((node) => node.id === nodeId))
    .find((node): node is CanvasNode => Boolean(node && node.kind === "resource")) ?? null;
}

function applyResourceToCanvasAction(action: Record<string, unknown>, resourceNode: CanvasNode | null) {
  if (!resourceNode) {
    return;
  }

  const resourceId = getCanvasNodeSourceId(resourceNode);

  if (resourceNode.resourceKind === "dialogue" && action.type === "speak") {
    action.category = resourceId;
  }

  if (resourceNode.resourceKind === "expression" && action.type === "change_expression") {
    action.expression = resourceId;
  }

  if (resourceNode.resourceKind === "surface" && action.type === "surface") {
    action.id = resourceId;
  }

  if (resourceNode.resourceKind === "scene" && (action.type === "scene" || action.type === "scene_overlay")) {
    action.id = resourceId;
  }

  if (resourceNode.resourceKind === "layer" && action.type === "play_layer_animation") {
    action.layerId = resourceId;
  }

  if (resourceNode.resourceKind === "hitArea" && action.type === "set_touched_part") {
    action.part = resourceId;
  }
}

function createRuntimeActionFromCanvasNode(graph: CanvasGraph, node: CanvasNode, visited = new Set<string>()): RuntimeAction | null {
  if (visited.has(node.id)) {
    return null;
  }
  visited.add(node.id);

  const actionType = getCanvasNodeActionType(node) ?? node.sourceId;
  if (!actionType) {
    return null;
  }

  if (actionType === "run_sequence" || actionType === "run_parallel" || actionType === "run_random") {
    const childActions = graph.edges
      .filter((edge) => edge.relation === "executes" && edge.from === node.id)
      .map((edge) => graph.nodes.find((candidate) => candidate.id === edge.to))
      .filter((candidate): candidate is CanvasNode => Boolean(candidate && (candidate.kind === "action" || candidate.kind === "group")))
      .sort((a, b) => (a.x - b.x) || (a.y - b.y))
      .map((childNode) => createRuntimeActionFromCanvasNode(graph, childNode, new Set(visited)))
      .filter((action): action is RuntimeAction => Boolean(action));

    return childActions.length > 0 ? createActionGroup(actionType, childActions) : null;
  }

  const action = { type: actionType } as Record<string, unknown>;
  applyResourceToCanvasAction(action, getConnectedResourceForAction(graph, node));

  const catalogItem = registry.actions.find((item) => item.type === actionType);
  const missingRequired = catalogItem?.parameters.some((parameter) => "required" in parameter && parameter.required === true && action[parameter.name] === undefined) ?? false;

  return missingRequired ? null : action as RuntimeAction;
}

function createAdditionalActionsFromCanvasState(graph: CanvasGraph, state: CanvasState) {
  const extraNodeIds = new Set(state.extraNodes.map((node) => node.id));

  return graph.edges
    .filter((edge) => edge.relation === "executes" && edge.from === "mapping" && extraNodeIds.has(edge.to))
    .map((edge) => graph.nodes.find((node) => node.id === edge.to))
    .filter((node): node is CanvasNode => Boolean(node && (node.kind === "action" || node.kind === "group")))
    .sort((a, b) => (a.x - b.x) || (a.y - b.y))
    .map((node) => createRuntimeActionFromCanvasNode(graph, node))
    .filter((action): action is RuntimeAction => Boolean(action));
}

function createMappingFromCanvasState(mapping: NanikaMapping): NanikaMapping {
  const graph = currentEditorGraph ?? createMappingCanvasGraph(mapping, "saved");
  const state = getCanvasState(getEditorGraphKey(editorSelection));
  const removedNodeIds = new Set(state.removedNodeIds);
  const keptActions = removeActionsFromMappingCanvas(
    mapping.actions,
    removedNodeIds,
    `mapping:${mapping.id}`,
  );
  const additionalActions = createAdditionalActionsFromCanvasState(graph, state);

  return {
    ...mapping,
    actions: [...keptActions, ...additionalActions],
  };
}

function createCharacterCanvasGraph(): CanvasGraph {
  const configuredMappings = getConfiguredMappings();
  const usage = collectActionUsage(configuredMappings.flatMap((rule) => rule.actions));
  const graph: CanvasGraph = {
    title: `${registry.character.name} 연결 작업판`,
    description: "런타임에서 실제 캐릭터로 들어오고, 캐릭터 재료와 별도 무대 조합 재료로 이어집니다.",
    nodes: [
      createCanvasNode("runtime", "runtime", "나니카 실행", registry.preset.name, 32, 220, [
        `preset: ${registry.preset.id}`,
        `rules: ${configuredMappings.length}`,
        `source: ${getConfiguredMappingSourceLabel()}`,
      ]),
      createCanvasNode("character", "character", registry.character.name, registry.character.description, 292, 220, [
        `id: ${registry.character.id}`,
        `기본 표정: ${registry.character.defaultExpression}`,
      ]),
    ],
    edges: [{
      id: "runtime->character",
      from: "runtime",
      to: "character",
      relation: "contains",
      label: "실행",
    }],
  };

  const groups = getCharacterResourceGroupPaletteItems();
  let groupY = 40;
  groups.forEach((group) => {
    const groupId = `group:${group.id}`;
    const optionCount = Math.min(group.options.length, 8);
    const optionRows = Math.max(1, Math.ceil(optionCount / 2));
    const optionGapY = 176;
    const optionGapX = 276;
    const blockHeight = Math.max(188, optionRows * optionGapY + (group.options.length > 8 ? 188 : 56));
    graph.nodes.push(createCanvasNode(
      groupId,
      "resource-group",
      group.title,
      group.description,
      552,
      groupY,
      [`${group.options.length}개`, `${group.options.filter((option) => (usage.get(`${group.resourceKind}:${option.id}`) ?? 0) > 0).length}개 사용 중`],
      group.resourceKind,
    ));
    graph.edges.push({
      id: `character->${groupId}`,
      from: "character",
      to: groupId,
      relation: "references",
      label: "재료",
    });

    group.options.slice(0, 8).forEach((option, optionIndex) => {
      const usageCount = usage.get(`${group.resourceKind}:${option.id}`) ?? 0;
      const nodeId = `${group.id}:${option.id}`;
      graph.nodes.push(createCanvasNode(
        nodeId,
        "resource",
        option.label,
        option.description ?? option.id,
        836 + ((optionIndex % 2) * optionGapX),
        groupY + ((Math.floor(optionIndex / 2)) * optionGapY),
        [`key: ${option.id}`, usageCount > 0 ? `사용 ${usageCount}` : "미연결"],
        group.resourceKind,
      ));
      graph.edges.push({
        id: `${groupId}->${nodeId}`,
        from: groupId,
        to: nodeId,
        relation: usageCount > 0 ? "executes" : "references",
        label: usageCount > 0 ? "사용" : "보유",
      });
    });

    if (group.options.length > 8) {
      const moreId = `${group.id}:more`;
      graph.nodes.push(createCanvasNode(
        moreId,
        "catalog",
        `+${group.options.length - 8}개 더 있음`,
        "카탈로그에서 전체 목록을 확인합니다.",
        1112,
        groupY + (optionRows * optionGapY) + 40,
        [group.title],
      ));
      graph.edges.push({
        id: `${groupId}->${moreId}`,
        from: groupId,
        to: moreId,
        relation: "references",
      });
    }

    groupY += blockHeight;
  });

  return graph;
}

function createFeatureSetCanvasGraph(featureSet: NanikaFeatureSet): CanvasGraph {
  const mappingById = new Map(savedMappings.map((mapping) => [mapping.id, mapping]));
  const rootId = "feature-set";
  const graph: CanvasGraph = {
    title: featureSet.name ?? featureSet.id,
    description: `${featureSet.mappingIds.length}개 연결을 포함합니다.`,
    nodes: [
      createCanvasNode(rootId, "feature-set", featureSet.name ?? featureSet.id, "기능 묶음", 24, 88, [
        featureSet.mode === "character-template" ? "캐릭터 미지정 템플릿" : "캐릭터 전용 묶음",
      ]),
    ],
    edges: [],
  };

  featureSet.mappingIds.forEach((mappingId, index) => {
    const mapping = mappingById.get(mappingId);
    const nodeId = `mapping:${mappingId}`;
    graph.nodes.push(createCanvasNode(
      nodeId,
      mapping ? "mapping" : "missing",
      mapping?.name ?? mappingId,
      mapping ? `${getReadableEventLabel(mapping.event)} · 액션 ${countNestedActions(mapping.actions)}개` : "저장된 연결 목록에 없습니다.",
      280 + ((index % 3) * 238),
      72 + (Math.floor(index / 3) * 132),
      mapping ? [mapping.event] : ["누락"],
    ));
    graph.edges.push({
      id: `${rootId}->${nodeId}`,
      from: rootId,
      to: nodeId,
      relation: "contains",
      label: "포함",
    });
  });

  return graph;
}

function createCatalogCanvasGraph(title: string, description: string, meta: string[] = []): CanvasGraph {
  return {
    title,
    description,
    nodes: [
      createCanvasNode("catalog", "catalog", title, description, 40, 92, meta.length > 0 ? meta : ["카탈로그 재료"]),
    ],
    edges: [],
  };
}

function getCanvasState(key: string): CanvasState {
  const existing = canvasStateByKey.get(key);

  if (existing) {
    return existing;
  }

  const next: CanvasState = {
    positions: {},
    removedNodeIds: [],
    extraNodes: [],
    extraEdges: [],
  };
  canvasStateByKey.set(key, next);

  return next;
}

function applyCanvasState(key: string, graph: CanvasGraph) {
  const state = getCanvasState(key);
  const removedNodeIds = new Set(state.removedNodeIds);
  graph.nodes = graph.nodes.filter((node) => !removedNodeIds.has(node.id));
  graph.edges = graph.edges.filter((edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to));
  graph.nodes.forEach((node) => {
    const position = state.positions[node.id];
    if (position) {
      node.x = position.x;
      node.y = position.y;
    }
  });
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  state.extraNodes.forEach((node) => {
    if (!nodeIds.has(node.id)) {
      graph.nodes.push({ ...node });
      nodeIds.add(node.id);
    }
  });
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  state.extraEdges.forEach((edge) => {
    if (!edgeIds.has(edge.id)) {
      graph.edges.push({ ...edge });
      edgeIds.add(edge.id);
    }
  });

  return graph;
}

function getEditorGraphKey(selection: EditorSelection) {
  if (selection.type === "mapping") {
    return `${selection.source}:mapping:${selection.mapping.id}`;
  }

  if (selection.type === "feature-set") {
    return `feature-set:${selection.featureSet.id}`;
  }

  if (selection.type === "catalog") {
    return `catalog:${selection.title}`;
  }

  return selection.type;
}

function setCurrentEditorGraph(key: string, graph: CanvasGraph) {
  const previousSelectedNodeId = selectedCanvasNodeId;
  currentEditorGraphKey = key;
  currentEditorGraph = applyCanvasState(key, graph);
  selectedCanvasNodeId = currentEditorGraph.nodes.some((node) => node.id === previousSelectedNodeId)
    ? previousSelectedNodeId
    : null;
  selectedCanvasNodeForPopover = null;
  pendingConnectionNodeId = null;
}

function getCanvasSize(graph: CanvasGraph) {
  const maxX = Math.max(680, ...graph.nodes.map((node) => node.x + 210));
  const maxY = Math.max(260, ...graph.nodes.map((node) => node.y + 100));

  return {
    width: maxX + 48,
    height: maxY + 48,
  };
}

function getEditorSummaryStats(graph: CanvasGraph | null): Array<[string, string]> {
  const resources = registry.characterResources;
  const usage = collectActionUsage(getConfiguredMappings().flatMap((rule) => rule.actions));

  if (!graph) {
    return [
      ["노드", "0"],
      ["연결", "0"],
      ["확대", `${Math.round(editorCanvasZoom * 100)}%`],
    ];
  }

  if (editorSelection.type === "character") {
    const countUsed = (kind: string, options: readonly ParameterOption[]) => options.filter((option) => (usage.get(`${kind}:${option.id}`) ?? 0) > 0).length;

    return [
      ["표정", `${countUsed("expression", resources.expressions)} / ${resources.expressions.length}`],
      ["상태", `${countUsed("surface", resources.surfaces)} / ${resources.surfaces.length}`],
      ["무대 조합", `${countUsed("scene", resources.scenes)} / ${resources.scenes.length}`],
      ["파츠", `${countUsed("layer", resources.layers)} / ${resources.layers.length}`],
      ["대사", `${countUsed("dialogue", resources.dialogueCategories)} / ${resources.dialogueCategories.length}`],
      ["터치", `${countUsed("hitArea", resources.touchParts)} / ${resources.touchParts.length}`],
      ["확대", `${Math.round(editorCanvasZoom * 100)}%`],
    ];
  }

  const actionCount = graph.nodes.filter((node) => node.kind === "action" || node.kind === "group").length;
  return [
    ["노드", String(graph.nodes.length)],
    ["연결", String(graph.edges.length)],
    ["액션", String(actionCount)],
    ["확대", `${Math.round(editorCanvasZoom * 100)}%`],
  ];
}

function renderEditorStats() {
  mappingEditorStats.replaceChildren(...getEditorSummaryStats(currentEditorGraph).map(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const text = document.createElement("b");
    text.textContent = value;
    item.append(strong, text);
    return item;
  }));
}

function renderCanvasGraph(graph: CanvasGraph, options: { readonly?: boolean } = {}) {
  const isReadonly = options.readonly ?? false;
  const viewport = document.createElement("div");
  viewport.className = "nanika-paint-viewport";

  const board = document.createElement("div");
  board.className = "nanika-paint-canvas";
  board.dataset.graphTitle = graph.title;
  board.dataset.readonly = isReadonly ? "true" : "false";
  if (!isReadonly) {
    board.addEventListener("dragover", (event) => {
      event.preventDefault();
      board.dataset.dropReady = "true";
    });
    board.addEventListener("dragleave", () => {
      delete board.dataset.dropReady;
    });
    board.addEventListener("drop", (event) => {
      event.preventDefault();
      delete board.dataset.dropReady;
      handlePaletteDrop(event, board);
    });
  }

  const size = getCanvasSize(graph);
  viewport.style.width = `${Math.round(size.width * editorCanvasZoom)}px`;
  viewport.style.height = `${Math.round(size.height * editorCanvasZoom)}px`;
  board.style.width = `${size.width}px`;
  board.style.height = `${size.height}px`;
  board.style.transform = `scale(${editorCanvasZoom})`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("nanika-paint-edges");
  svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "nanika-paint-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  markerPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(markerPath);
  defs.append(marker);

  const nodeElements = new Map<string, HTMLElement>();

  function updateEdges() {
    svg.replaceChildren(defs);
    graph.edges.forEach((edge) => {
      const from = graph.nodes.find((node) => node.id === edge.from);
      const to = graph.nodes.find((node) => node.id === edge.to);

      if (!from || !to) {
        return;
      }

      const fromX = from.x + 184;
      const fromY = from.y + 38;
      const toX = to.x;
      const toY = to.y + 38;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${fromX} ${fromY} C ${fromX + 60} ${fromY}, ${toX - 60} ${toY}, ${toX} ${toY}`);
      path.setAttribute("data-relation", edge.relation ?? "executes");
      path.setAttribute("marker-end", "url(#nanika-paint-arrow)");
      svg.append(path);

      if (edge.label) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String((fromX + toX) / 2));
        text.setAttribute("y", String(((fromY + toY) / 2) - 8));
        text.textContent = edge.label;
        svg.append(text);
      }
    });
  }

  function removeCanvasNode(node: CanvasNode) {
    const state = getCanvasState(currentEditorGraphKey);
    if (!state.removedNodeIds.includes(node.id)) {
      state.removedNodeIds.push(node.id);
    }
    state.extraNodes = state.extraNodes.filter((item) => item.id !== node.id);
    state.extraEdges = state.extraEdges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    if (currentEditorGraph) {
      currentEditorGraph.nodes = currentEditorGraph.nodes.filter((item) => item.id !== node.id);
      currentEditorGraph.edges = currentEditorGraph.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    }
    selectedCanvasNodeId = null;
    selectedCanvasNodeForPopover = null;
    pendingConnectionNodeId = pendingConnectionNodeId === node.id ? null : pendingConnectionNodeId;
    renderEditorCanvas();
  }

  function editCanvasNode(node: CanvasNode) {
    if (node.kind === "mapping" && editorSelection.type === "mapping") {
      loadMappingIntoDraft(editorSelection.mapping as NanikaMapping);
      setEditorMode("create");
      return;
    }

    if (node.kind === "feature-set" && editorSelection.type === "feature-set") {
      loadFeatureSetIntoForm(editorSelection.featureSet);
      setEditorMode("feature-sets");
      return;
    }

    mappingEditorDetail.replaceChildren(createEditorSummary(
      "직접 수정 보류",
      "이 카드의 값 수정은 아직 원본 카탈로그나 전용 설정 화면에서 처리합니다.",
      [`종류: ${node.kind}`],
    ));
  }

  function startCanvasConnection(node: CanvasNode) {
    pendingConnectionNodeId = node.id;
    selectedPaletteCategory = getPreferredPaletteCategoryForKind(node.kind);
    selectedCanvasNodeForPopover = node;
    renderEditorPalette();
    renderCanvasPopover(nodeElements, node);
  }

  function renderCanvasPopover(nodes: Map<string, HTMLElement>, node: CanvasNode) {
    board.querySelector(".nanika-node-popover")?.remove();
    const popover = document.createElement("div");
    popover.className = "nanika-node-popover";
    popover.style.left = `${Math.min(size.width - 224, node.x + 196)}px`;
    popover.style.top = `${Math.max(16, node.y)}px`;

    const title = document.createElement("strong");
    title.textContent = node.title;
    const body = document.createElement("p");
    body.textContent = pendingConnectionNodeId === node.id
      ? "연결할 수 있는 카드만 오른쪽 카드덱에 표시됩니다."
      : node.description;

    const actions = document.createElement("div");
    actions.className = "asset-lab-button-row";
    const connectButton = createActionButton("연결 시작", () => startCanvasConnection(node));
    const editButton = createActionButton("수정", () => editCanvasNode(node));
    const deleteButton = createActionButton("삭제", () => removeCanvasNode(node));
    deleteButton.title = "현재 작업판에서 이 카드를 제거합니다. 원본 파일은 삭제하지 않습니다.";
    const closeButton = createActionButton("닫기", () => {
      selectedCanvasNodeForPopover = null;
      pendingConnectionNodeId = null;
      renderEditorPalette();
      popover.remove();
      nodes.get(node.id)?.setAttribute("data-selected", "false");
    });
    actions.append(connectButton, editButton, deleteButton, closeButton);
    popover.append(title, body, actions);
    board.append(popover);
  }

  function selectCanvasNode(node: CanvasNode) {
    selectedCanvasNodeId = node.id;
    selectedCanvasNodeForPopover = node;
    nodeElements.forEach((element) => {
      element.dataset.selected = "false";
    });
    nodeElements.get(node.id)?.setAttribute("data-selected", "true");
    if (pendingConnectionNodeId && pendingConnectionNodeId !== node.id) {
      const relation = currentEditorGraph?.nodes.find((item) => item.id === pendingConnectionNodeId);
      if (relation && getCanvasRelation(relation.kind, node.kind)) {
        connectPendingNodeTo(node.id);
        return;
      }
    }
    renderCanvasPopover(nodeElements, node);
  }

  function moveNode(node: CanvasNode, x: number, y: number) {
    node.x = Math.max(16, Math.min(size.width - 210, x));
    node.y = Math.max(16, Math.min(size.height - 96, y));
    const element = nodeElements.get(node.id);
    if (element) {
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
    }
    getCanvasState(currentEditorGraphKey).positions[node.id] = { x: node.x, y: node.y };
    updateEdges();
  }

  graph.nodes.forEach((node) => {
    const element = document.createElement(isReadonly ? "article" : "button");
    element.className = "nanika-paint-node";
    if (element instanceof HTMLButtonElement) {
      element.type = "button";
    }
    element.dataset.kind = node.kind;
    element.dataset.nodeId = node.id;
    element.dataset.selected = "false";
    element.dataset.readonly = isReadonly ? "true" : "false";
    const resourceKind = getCanvasNodeResourceKind(node);
    if (resourceKind) {
      element.dataset.resourceKind = resourceKind;
    }
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;

    const title = document.createElement("strong");
    title.textContent = node.title;
    const description = document.createElement("span");
    description.textContent = node.description;
    element.append(title, description);

    if (node.meta && node.meta.length > 0) {
      element.append(createEditorMeta(node.meta.slice(0, 3)));
    }

    if (!isReadonly) {
      let pointerStart: { id: number; x: number; y: number; nodeX: number; nodeY: number; moved: boolean } | null = null;
      element.addEventListener("pointerdown", (rawEvent) => {
        const event = rawEvent as PointerEvent;
        pointerStart = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          nodeX: node.x,
          nodeY: node.y,
          moved: false,
        };
        element.setPointerCapture(event.pointerId);
        selectCanvasNode(node);
      });
      element.addEventListener("pointermove", (rawEvent) => {
        const event = rawEvent as PointerEvent;
        if (!pointerStart) {
          return;
        }

        const dx = event.clientX - pointerStart.x;
        const dy = event.clientY - pointerStart.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          pointerStart.moved = true;
        }
        moveNode(node, pointerStart.nodeX + (dx / editorCanvasZoom), pointerStart.nodeY + (dy / editorCanvasZoom));
      });
      element.addEventListener("pointerup", (rawEvent) => {
        const event = rawEvent as PointerEvent;
        if (pointerStart?.id === event.pointerId) {
          element.releasePointerCapture(event.pointerId);
          pointerStart = null;
        }
      });
      element.addEventListener("click", () => selectCanvasNode(node));
    }

    nodeElements.set(node.id, element);
    board.append(element);
  });

  board.prepend(svg);
  updateEdges();
  const selectedNode = graph.nodes.find((node) => node.id === selectedCanvasNodeId);
  if (selectedNode && !isReadonly) {
    selectCanvasNode(selectedNode);
  }

  viewport.append(board);
  return viewport;
}

function renderCanvasNodeDetail(node: CanvasNode) {
  const detail = createEditorSummary(
    node.title,
    pendingConnectionNodeId === node.id ? "이 카드에서 연결을 시작했습니다. 연결할 다른 카드를 선택하세요." : node.description,
    [
      `종류: ${node.kind}`,
      ...(node.meta ?? []),
      ...getAllowedCanvasNextSteps(node.kind),
    ],
  );
  const controls = document.createElement("div");
  controls.className = "asset-lab-button-row";
  controls.append(createActionButton("연결 시작 취소", () => {
    pendingConnectionNodeId = null;
    renderEditorCanvas();
  }));
  detail.append(controls);
  mappingEditorDetail.replaceChildren(detail);
}

function getAllowedCanvasNextSteps(kind: CanvasNodeKind) {
  if (kind === "runtime") {
    return ["연결 가능: 실제 캐릭터 카드"];
  }

  if (kind === "character") {
    return ["연결 가능: 캐릭터 재료 묶음", "연결 가능: 캐릭터 이벤트"];
  }

  if (kind === "resource-group") {
    return ["연결 가능: 표정, 캐릭터 상태, 무대 조합, 파츠 같은 개별 재료"];
  }

  if (kind === "resource") {
    return ["참조 가능: 액션 카드", "카탈로그에서 원본 재료를 확인합니다."];
  }

  if (kind === "target") {
    return ["연결 가능: 이벤트 카드"];
  }

  if (kind === "event") {
    return ["연결 가능: 매핑 카드"];
  }

  if (kind === "mapping" || kind === "group") {
    return ["연결 가능: 액션 카드", "묶기 가능: 순서/동시/랜덤"];
  }

  if (kind === "action") {
    return ["수정 가능: 액션 파라미터", "참조 가능: 대사, 무대 조합, 캐릭터 상태, 파츠"];
  }

  if (kind === "feature-set") {
    return ["포함 가능: 저장된 연결", "중첩 제한: 기능 묶음 직접 포함은 보류"];
  }

  return ["편집기 카드 덱에서 연결 위치를 선택해야 합니다."];
}

function getPreferredPaletteCategoryForKind(kind: CanvasNodeKind): PaletteCategoryId {
  if (kind === "runtime") {
    return "characters";
  }

  if (kind === "character") {
    return "resources";
  }

  if (kind === "event" || kind === "feature-set") {
    return "saved";
  }

  if (kind === "mapping" || kind === "group") {
    return "actions";
  }

  if (kind === "action" || kind === "resource-group") {
    return "resources";
  }

  return "actions";
}

function getActionResourceKind(actionType: string): NanikaResourceKind | null {
  if (actionType === "speak") {
    return "dialogue";
  }

  if (actionType === "change_expression") {
    return "expression";
  }

  if (actionType === "surface") {
    return "surface";
  }

  if (actionType === "scene" || actionType === "scene_overlay") {
    return "scene";
  }

  if (actionType === "play_layer_animation") {
    return "layer";
  }

  if (actionType === "set_touched_part") {
    return "hitArea";
  }

  return null;
}

function getResourceKindFromNodeId(nodeId: string): NanikaResourceKind | null {
  const [prefix, groupId] = nodeId.split(":");
  const id = prefix === "group" ? groupId : prefix;

  if (id === "expressions" || id === "expression") {
    return "expression";
  }

  if (id === "surfaces" || id === "surface") {
    return "surface";
  }

  if (id === "scenes" || id === "scene") {
    return "scene";
  }

  if (id === "layers" || id === "layer") {
    return "layer";
  }

  if (id === "dialogues" || id === "dialogue") {
    return "dialogue";
  }

  if (id === "hit-areas" || id === "hitArea") {
    return "hitArea";
  }

  return null;
}

function getCanvasNodeResourceKind(node: CanvasNode): NanikaResourceKind | null {
  return node.resourceKind ?? getResourceKindFromNodeId(node.id);
}

function getCanvasNodeActionType(node: CanvasNode) {
  return node.meta?.find((item) => registry.actions.some((action) => action.type === item)) ?? null;
}

function getPendingConnectionSourceNode() {
  if (!pendingConnectionNodeId || !currentEditorGraph) {
    return null;
  }

  return currentEditorGraph.nodes.find((node) => node.id === pendingConnectionNodeId) ?? null;
}

function getCanvasRelation(from: CanvasNodeKind, to: CanvasNodeKind): CanvasEdge["relation"] | null {
  if (from === "runtime" && to === "character") {
    return "contains";
  }

  if (from === "character" && (to === "resource-group" || to === "event")) {
    return "references";
  }

  if (from === "resource-group" && to === "resource") {
    return "references";
  }

  if (from === "resource" && to === "action") {
    return "references";
  }

  if (from === "target" && to === "event") {
    return "executes";
  }

  if (from === "event" && to === "mapping") {
    return "executes";
  }

  if ((from === "mapping" || from === "group") && (to === "action" || to === "group")) {
    return "executes";
  }

  if (from === "feature-set" && to === "mapping") {
    return "contains";
  }

  if (from === "action" && (to === "resource" || to === "catalog")) {
    return "references";
  }

  return null;
}

function connectPendingNodeTo(targetNodeId: string) {
  if (!currentEditorGraph || !pendingConnectionNodeId || pendingConnectionNodeId === targetNodeId) {
    return;
  }

  const from = currentEditorGraph.nodes.find((node) => node.id === pendingConnectionNodeId);
  const to = currentEditorGraph.nodes.find((node) => node.id === targetNodeId);

  if (!from || !to) {
    return;
  }

  const relation = getCanvasRelation(from.kind, to.kind);
  if (!relation) {
    mappingEditorDetail.replaceChildren(createEditorSummary(
      "연결할 수 없는 카드",
      `${from.title} 카드에서 ${to.title} 카드로는 연결할 수 없습니다.`,
      getAllowedCanvasNextSteps(from.kind),
    ));
    pendingConnectionNodeId = null;
    return;
  }

  const edgeId = `manual:${from.id}->${to.id}`;
  if (!currentEditorGraph.edges.some((edge) => edge.id === edgeId)) {
    const edge: CanvasEdge = {
      id: edgeId,
      from: from.id,
      to: to.id,
      relation,
    };
    if (relation === "contains") {
      edge.label = "포함";
    } else if (relation === "references") {
      edge.label = "참조";
    }
    currentEditorGraph.edges.push(edge);
    getCanvasState(currentEditorGraphKey).extraEdges.push(edge);
  }
  pendingConnectionNodeId = null;
  renderEditorCanvas();
}

function createCanvasNodeFromPalette(item: PaletteItem, x: number, y: number): CanvasNode {
  const resourceSegment = item.resourceKind ? `${item.resourceKind}:` : "";
  const id = `palette:${item.kind}:${resourceSegment}${item.id}:${Date.now().toString(36)}`;
  const node = createCanvasNode(id, item.kind, item.title, item.description, x, y, item.meta ?? [item.id], item.resourceKind);
  node.sourceId = item.id;
  return node;
}

function handlePaletteDrop(event: DragEvent, board: HTMLElement) {
  if (!currentEditorGraph) {
    return;
  }

  const raw = event.dataTransfer?.getData("application/x-nanika-palette");
  if (!raw) {
    return;
  }

  let item: PaletteItem;
  try {
    item = JSON.parse(raw) as PaletteItem;
  } catch {
    return;
  }

  const rect = board.getBoundingClientRect();
  const node = createCanvasNodeFromPalette(
    item,
    Math.max(16, ((event.clientX - rect.left) / editorCanvasZoom) - 92),
    Math.max(16, ((event.clientY - rect.top) / editorCanvasZoom) - 38),
  );
  currentEditorGraph.nodes.push(node);
  getCanvasState(currentEditorGraphKey).extraNodes.push(node);
  renderEditorCanvas();
}

function addPaletteItemToCurrentGraph(item: PaletteItem, renderImmediately = true) {
  if (!currentEditorGraph) {
    selectCatalogInEditor(item.title, item.description, item.meta ?? [item.id], false);
    return null;
  }

  const size = getCanvasSize(currentEditorGraph);
  const node = createCanvasNodeFromPalette(
    item,
    Math.max(16, Math.min(size.width - 232, Math.round(size.width / 2) - 92)),
    Math.max(16, Math.min(size.height - 112, Math.round(size.height / 2) - 38)),
  );
  currentEditorGraph.nodes.push(node);
  getCanvasState(currentEditorGraphKey).extraNodes.push(node);
  selectedCanvasNodeId = node.id;
  if (renderImmediately) {
    renderEditorCanvas();
  }
  return node;
}

function revealEditorPanel() {
  const panel = mappingEditorCanvas.closest<HTMLElement>(".nanika-editor-panel");

  if (!panel) {
    return;
  }

  panel.dataset.focused = "true";
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    delete panel.dataset.focused;
  }, 1200);
}

function setEditorSelection(selection: EditorSelection, reveal = false, readonly = false) {
  editorSelection = selection;
  editorReadOnly = readonly;
  renderEditorCanvas();
  if (reveal) {
    revealEditorPanel();
  }
}

function selectEditorDraft() {
  selectedPaletteCategory = "events";
  setEditorSelection({ type: "draft" });
}

function selectCharacterInEditor(reveal = true, readonly = false) {
  selectedPaletteCategory = "resources";
  emptyEditorTitle = "선택된 항목 없음";
  emptyEditorDescription = "카드를 선택하면 이 영역이 공통 편집 캔버스처럼 바뀝니다. 다음 단계에서는 이 재료를 드래그해서 연결하는 방식으로 확장할 수 있습니다.";
  emptyEditorMeta = ["대기 중"];
  setEditorSelection({ type: "character" }, reveal, readonly);
}

function getPaletteItems(category: PaletteCategoryId): PaletteItem[] {
  if (category === "characters") {
    const character = registry.character;

    return [{
      id: character.id,
      kind: "character",
      title: character.name,
      description: character.description,
      meta: [
        `preset: ${registry.preset.id}`,
        `default: ${character.defaultExpression}`,
        `${character.expressionCount} expressions`,
      ],
    }];
  }

  if (category === "saved") {
    return savedMappings.map((mapping) => ({
      id: mapping.id,
      kind: "mapping",
      title: mapping.name ?? mapping.id,
      description: `${getReadableEventLabel(mapping.event)} · 액션 ${countNestedActions(mapping.actions)}개`,
      meta: [mapping.id, mapping.event],
    }));
  }

  if (category === "events") {
    return registry.events.map((event) => ({
      id: event.event,
      kind: "event",
      title: getReadableEventLabel(event.event),
      description: event.description,
      meta: [event.event],
    }));
  }

  if (category === "actions") {
    return registry.actions.map((action) => ({
      id: action.type,
      kind: action.type === "run_sequence" || action.type === "run_parallel" || action.type === "run_random" ? "group" : "action",
      title: getReadableActionLabel(action.type),
      description: action.description,
      meta: [action.type, `category: ${action.category}`],
    }));
  }

  if (category === "feature-sets") {
    return getFeatureSetsForDisplay().map((featureSet) => ({
      id: featureSet.id,
      kind: "feature-set",
      title: featureSet.name ?? featureSet.id,
      description: `${featureSet.mappingIds.length}개 연결을 포함합니다.`,
      meta: [featureSet.id, getFeatureSetStatusText(featureSet)],
    }));
  }

  const pendingSource = getPendingConnectionSourceNode();

  if (category === "resources" && pendingSource?.kind === "character") {
    return getCharacterResourceGroupPaletteItems().map((item) => ({
      id: item.id,
      kind: item.kind,
      resourceKind: item.resourceKind,
      title: item.title,
      description: item.description,
      meta: item.meta ?? [],
    }));
  }

  const resources = registry.characterResources;
  const resourceItems: Array<CharacterResourceCatalogOption & {
    kind: "resource";
    resourceKind: NanikaResourceKind;
    meta: string[];
  }> = [
    ...resources.expressions.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "expression" as const, meta: ["표정"] })),
    ...resources.surfaces.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "surface" as const, meta: ["캐릭터 상태"] })),
    ...resources.scenes.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "scene" as const, meta: ["무대 조합"] })),
    ...resources.layers.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "layer" as const, meta: ["파츠 움직임"] })),
    ...resources.dialogueCategories.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "dialogue" as const, meta: ["대사"] })),
    ...resources.touchParts.map((item) => ({ ...item, kind: "resource" as const, resourceKind: "hitArea" as const, meta: ["터치"] })),
  ];

  return resourceItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    resourceKind: item.resourceKind,
    title: item.label,
    description: item.description ?? item.id,
    meta: item.meta,
  }));
}

function isPaletteItemAllowedForPending(item: PaletteItem) {
  if (!pendingConnectionNodeId || !currentEditorGraph) {
    return true;
  }

  const source = currentEditorGraph.nodes.find((node) => node.id === pendingConnectionNodeId);
  if (!source || !getCanvasRelation(source.kind, item.kind)) {
    return false;
  }

  if (source.kind === "resource-group" && item.kind === "resource") {
    const resourceKind = getCanvasNodeResourceKind(source);

    return Boolean(resourceKind && item.resourceKind === resourceKind);
  }

  if (source.kind === "resource" && (item.kind === "action" || item.kind === "group")) {
    const resourceKind = getCanvasNodeResourceKind(source);
    const actionResourceKind = getActionResourceKind(item.id);

    return Boolean(resourceKind && actionResourceKind === resourceKind);
  }

  if (source.kind === "action" && item.kind === "resource") {
    const actionType = getCanvasNodeActionType(source);
    const resourceKind = actionType ? getActionResourceKind(actionType) : null;

    return Boolean(resourceKind && item.resourceKind === resourceKind);
  }

  return true;
}

function getAvailablePaletteCategories(categories: PaletteCategory[]) {
  if (!pendingConnectionNodeId) {
    return categories;
  }

  return categories.filter((category) => getPaletteItems(category.id).some(isPaletteItemAllowedForPending));
}

function renderEditorPalette() {
  if (pendingConnectionNodeId) {
    mappingPaletteDeck.dataset.pendingSourceId = pendingConnectionNodeId;
  } else {
    delete mappingPaletteDeck.dataset.pendingSourceId;
  }

  const baseCategories: PaletteCategory[] = [
    { id: "characters", label: "캐릭터" },
    { id: "saved", label: "저장 연결" },
    { id: "events", label: "이벤트" },
    { id: "actions", label: "액션" },
    { id: "feature-sets", label: "기능 묶음" },
    { id: "resources", label: "캐릭터 재료" },
  ];
  const categories = getAvailablePaletteCategories(baseCategories);
  if (!categories.some((category) => category.id === selectedPaletteCategory)) {
    selectedPaletteCategory = categories[0]?.id ?? "resources";
  }

  mappingPaletteTabs.replaceChildren(...categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category.label;
    button.dataset.active = selectedPaletteCategory === category.id ? "true" : "false";
    button.addEventListener("click", () => {
      selectedPaletteCategory = category.id;
      renderEditorPalette();
    });
    return button;
  }));

  const items = getPaletteItems(selectedPaletteCategory).filter(isPaletteItemAllowedForPending);
  if (items.length === 0) {
    mappingPaletteDeck.replaceChildren(createEditorSummary(
      "연결 가능한 카드 없음",
      pendingConnectionNodeId ? "선택한 카드에서 이어 붙일 수 있는 카드가 이 카테고리에 없습니다." : "아직 이 카테고리에 끌어올 카드가 없습니다.",
    ));
    return;
  }

  mappingPaletteDeck.replaceChildren(...items.map((item) => {
    const card = document.createElement("button");
    card.className = "nanika-palette-card";
    card.type = "button";
    card.draggable = true;
    card.dataset.kind = item.kind;
    if (item.resourceKind) {
      card.dataset.resourceKind = item.resourceKind;
    }

    const title = document.createElement("strong");
    title.textContent = item.title;
    const description = document.createElement("span");
    description.textContent = item.description;
    card.append(title, description);
    if (item.meta && item.meta.length > 0) {
      card.append(createEditorMeta(item.meta.slice(0, 2)));
    }

    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("application/x-nanika-palette", JSON.stringify(item));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
      }
    });
    card.addEventListener("click", () => {
      if (item.kind === "character" && !pendingConnectionNodeId) {
        selectCharacterInEditor(false);
        selectedCanvasNodeId = "character";
        renderEditorCanvas();
        return;
      }

      if (item.kind === "mapping" && !pendingConnectionNodeId) {
        const mapping = savedMappings.find((savedMapping) => savedMapping.id === item.id);
        if (mapping) {
          selectMappingInEditor(mapping, "saved", false);
          return;
        }
      }

      if (item.kind === "feature-set" && !pendingConnectionNodeId) {
        const featureSet = getFeatureSetsForDisplay().find((savedFeatureSet) => savedFeatureSet.id === item.id);
        if (featureSet) {
          selectFeatureSetInEditor(featureSet, false);
          return;
        }
      }

      const pendingSourceId = pendingConnectionNodeId ?? mappingPaletteDeck.dataset.pendingSourceId ?? selectedCanvasNodeForPopover?.id ?? null;
      const shouldConnectPending = Boolean(pendingSourceId);
      const node = addPaletteItemToCurrentGraph(item, !shouldConnectPending);

      if (pendingSourceId && node) {
        pendingConnectionNodeId = pendingSourceId;
        connectPendingNodeTo(node.id);
      }
    });
    return card;
  }));
}

function renderEditorCanvas() {
  renderEditorPalette();
  mappingEditorCanvas.replaceChildren();
  mappingEditorDetail.replaceChildren();
  const isReadonly = editorReadOnly;
  const editorPanel = mappingEditorCanvas.closest<HTMLElement>(".nanika-editor-panel");
  if (editorPanel) {
    editorPanel.dataset.readonly = isReadonly ? "true" : "false";
  }
  editorLoadDraftButton.disabled = true;
  editorAddToFeatureSetButton.disabled = true;
  editorSaveButton.disabled = true;
  editorSaveButton.textContent = "저장";
  editorCopyGraphButton.disabled = !currentEditorGraph;

  if (editorSelection.type === "empty") {
    currentEditorGraph = null;
    editorCopyGraphButton.disabled = true;
    mappingEditorHelp.textContent = emptyEditorDescription;
    mappingEditorCanvas.replaceChildren(createEditorSummary(
      emptyEditorTitle,
      emptyEditorDescription,
      emptyEditorMeta,
    ));
    renderEditorStats();
    return;
  }

  if (editorSelection.type === "character") {
    mappingEditorHelp.textContent = "캐릭터 중심 작업판입니다. 런타임에서 실제 캐릭터로 들어오고, 캐릭터 재료와 런타임 무대 조합이 별도 재료로 이어집니다.";
    selectedPaletteCategory = "resources";
    setCurrentEditorGraph(getEditorGraphKey(editorSelection), createCharacterCanvasGraph());
    editorCopyGraphButton.disabled = false;
    editorSaveButton.disabled = isReadonly;
    editorSaveButton.textContent = isReadonly ? "조회 전용" : "작업판 저장";
    mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: isReadonly }));
    renderEditorStats();
    return;
  }

  if (editorSelection.type === "draft") {
    mappingEditorHelp.textContent = "새 연결 만들기에서 구성 중인 연결 흐름입니다.";
    if (lastDraftResult.mapping) {
      setCurrentEditorGraph(getEditorGraphKey(editorSelection), createMappingCanvasGraph(lastDraftResult.mapping, "draft"));
      editorCopyGraphButton.disabled = false;
      editorSaveButton.disabled = false;
      editorSaveButton.textContent = "연결 저장";
      mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: isReadonly }));
    } else {
      currentEditorGraph = null;
      editorCopyGraphButton.disabled = true;
      editorSaveButton.disabled = true;
      editorSaveButton.textContent = "연결 저장";
      mappingEditorCanvas.replaceChildren(createEditorSummary(
        "작성 중인 연결",
        "대상, 이벤트, 액션을 선택하면 연결 흐름이 캔버스에 그려집니다.",
        lastDraftResult.errors.length > 0 ? lastDraftResult.errors : ["draft"],
      ));
    }
    renderEditorStats();
    return;
  }

  if (editorSelection.type === "mapping") {
    const { mapping, source } = editorSelection;
    setCurrentEditorGraph(getEditorGraphKey(editorSelection), createMappingCanvasGraph(mapping, source));
    editorCopyGraphButton.disabled = false;
    mappingEditorHelp.textContent = source === "saved"
      ? "저장된 연결을 캔버스에 표시했습니다. 필요하면 새 연결 만들기 화면으로 불러와 수정할 수 있습니다."
      : "현재 preset에 적용된 실행 규칙을 캔버스에 표시했습니다.";
    mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: isReadonly }));
    editorLoadDraftButton.disabled = isReadonly;
    editorAddToFeatureSetButton.disabled = isReadonly || source !== "saved";
    editorSaveButton.disabled = isReadonly;
    editorSaveButton.textContent = isReadonly ? "조회 전용" : "작업판 저장";
    if (source !== "saved") {
      mappingEditorDetail.append(createEditorSummary(
        "묶음 추가 전 저장 필요",
        "기능 묶음은 저장된 연결 ID를 묶습니다. 현재 preset에만 있는 실행 규칙은 먼저 새 연결로 불러와 저장한 뒤 묶음에 추가할 수 있습니다.",
      ));
    }
    renderEditorStats();
    return;
  }

  if (editorSelection.type === "feature-set") {
    const { featureSet } = editorSelection;
    const compatibility = checkFeatureSetCompatibility(featureSet);
    setCurrentEditorGraph(getEditorGraphKey(editorSelection), createFeatureSetCanvasGraph(featureSet));
    editorCopyGraphButton.disabled = false;
    editorSaveButton.disabled = isReadonly;
    editorSaveButton.textContent = isReadonly ? "조회 전용" : "묶음 저장";
    mappingEditorHelp.textContent = "기능 묶음은 여러 연결을 재사용하기 위한 포함 묶음입니다. 실행 순서 자체는 각 연결 내부에서 확인합니다.";
    mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: isReadonly }));
    if (compatibility.missing.length > 0) {
      mappingEditorDetail.append(createEditorSummary("누락 재료", "이 묶음을 현재 캐릭터에 적용하기 전 확인이 필요합니다.", compatibility.missing));
    }
    renderEditorStats();
    return;
  }

  mappingEditorHelp.textContent = "카탈로그 재료를 선택했습니다. 아직 실행 흐름에 붙기 전의 재사용 가능한 재료입니다.";
  setCurrentEditorGraph(getEditorGraphKey(editorSelection), createCatalogCanvasGraph(
    editorSelection.title,
    editorSelection.description,
    editorSelection.meta,
  ));
  editorCopyGraphButton.disabled = false;
  editorSaveButton.disabled = true;
  editorSaveButton.textContent = "조회 전용";
  mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: true }));
  renderEditorStats();
}

function selectMappingInEditor(mapping: RuntimeRule | NanikaMapping, source: "applied" | "saved", reveal = true, readonly = false) {
  setEditorSelection({ type: "mapping", mapping, source }, reveal, readonly);
}

function selectFeatureSetInEditor(featureSet: NanikaFeatureSet, reveal = true, readonly = false) {
  setEditorSelection({ type: "feature-set", featureSet }, reveal, readonly);
}

function selectCatalogInEditor(title: string, description: string, meta: string[] = [], reveal = true) {
  setEditorSelection({ type: "catalog", title, description, meta }, reveal, true);
}

function getCharacterResourceGroupPaletteItems(): ResourceGroupPaletteItem[] {
  const resources = registry.characterResources;

  return [
    {
      id: "expressions",
      kind: "resource-group",
      resourceKind: "expression",
      title: "표정",
      description: "대사나 이벤트에서 사용할 표정 후보입니다.",
      options: resources.expressions,
      meta: [`${resources.expressions.length}개`],
    },
    {
      id: "surfaces",
      kind: "resource-group",
      resourceKind: "surface",
      title: "캐릭터 상태",
      description: "실제로 표시되는 캐릭터 상태입니다.",
      options: resources.surfaces,
      meta: [`${resources.surfaces.length}개`],
    },
    {
      id: "scenes",
      kind: "resource-group",
      resourceKind: "scene",
      title: "무대 조합",
      description: "배경, 전경, 환경 FX를 묶은 화면 세트입니다.",
      options: resources.scenes,
      meta: [`${resources.scenes.length}개`],
    },
    {
      id: "layers",
      kind: "resource-group",
      resourceKind: "layer",
      title: "파츠 움직임",
      description: "눈 깜빡임, 입 모양, 보조 파츠 움직임입니다.",
      options: resources.layers,
      meta: [`${resources.layers.length}개`],
    },
    {
      id: "dialogues",
      kind: "resource-group",
      resourceKind: "dialogue",
      title: "대사",
      description: "말풍선에 표시할 대사 카테고리입니다.",
      options: resources.dialogueCategories,
      meta: [`${resources.dialogueCategories.length}개`],
    },
    {
      id: "hit-areas",
      kind: "resource-group",
      resourceKind: "hitArea",
      title: "터치 영역",
      description: "클릭하거나 터치할 수 있는 캐릭터 영역입니다.",
      options: resources.touchParts,
      meta: [`${resources.touchParts.length}개`],
    },
  ];
}

function getConfiguredMappings(): readonly (RuntimeRule | NanikaMapping)[] {
  return savedMappingsLoaded ? savedMappings : registry.mappings;
}

function getConfiguredMappingSourceLabel() {
  return savedMappingsLoaded ? "saved" : "preset";
}

function collectActionUsage(actions: readonly RuntimeAction[], output = new Map<string, number>()) {
  actions.forEach((action) => {
    output.set(`action:${action.type}`, (output.get(`action:${action.type}`) ?? 0) + 1);

    const record = action as Record<string, unknown>;
    const usageFields: Array<[string, string]> = [
      ["category", "dialogue"],
      ["expression", "expression"],
      ["id", action.type === "scene" || action.type === "scene_overlay" ? "무대 조합 id" : "캐릭터 상태 id"],
      ["layerId", "layer"],
      ["pluginId", "plugin"],
      ["part", "hitArea"],
      ["theme", "ui"],
      ["mode", "ui"],
      ["placement", "ui"],
      ["display", "ui"],
    ];

    usageFields.forEach(([field, kind]) => {
      const value = record[field];

      if (typeof value === "string" && value) {
        output.set(`${kind}:${value}`, (output.get(`${kind}:${value}`) ?? 0) + 1);
      }
    });

    if (Array.isArray(record.actions)) {
      collectActionUsage(record.actions as RuntimeAction[], output);
    }

    if (Array.isArray(record.items)) {
      record.items.forEach((item) => {
        const actions = (item as { actions?: RuntimeAction[] }).actions;
        const children = (item as { children?: Array<{ actions?: RuntimeAction[] }> }).children;

        if (Array.isArray(actions)) {
          collectActionUsage(actions, output);
        }

        if (Array.isArray(children)) {
          children.forEach((child) => {
            if (Array.isArray(child.actions)) {
              collectActionUsage(child.actions, output);
            }
          });
        }
      });
    }
  });

  return output;
}

function createMaterialItem(
  group: string,
  kind: string,
  id: string,
  label: string,
  description: string,
  usage: Map<string, number>,
  fallbackStatus: MaterialStatus = "reusable",
): MaterialItem {
  const usageCount = usage.get(`${kind}:${id}`) ?? 0;

  return {
    id: `${kind}:${id}`,
    label,
    description,
    group,
    status: usageCount > 0 ? "connected" : fallbackStatus,
    usageCount,
  };
}

function createMaterialGroups() {
  const configuredMappings = getConfiguredMappings();
  const usage = collectActionUsage(configuredMappings.flatMap((rule) => rule.actions));
  const mappedEvents = new Set(configuredMappings.map((rule) => rule.event));
  const resources = registry.characterResources;

  return [
    {
      title: "필수 입력",
      description: "기본 사용자가 기대하는 주요 입력입니다.",
      items: registry.events
        .filter((event) => requiredEventNames.has(event.event))
        .map((event) => ({
          id: `event:${event.event}`,
          label: getReadableEventLabel(event.event),
          description: event.description,
          group: "필수 입력",
          status: mappedEvents.has(event.event) ? "connected" : "required-missing",
          usageCount: configuredMappings.filter((rule) => rule.event === event.event).length,
        } satisfies MaterialItem)),
    },
    {
      title: "대사 / 표정",
      description: "여러 연결에서 반복해서 사용할 수 있는 캐릭터 반응 재료입니다.",
      items: [
        ...resources.dialogueCategories.map((item) => createMaterialItem("대사 / 표정", "dialogue", item.id, item.label, item.description ?? item.id, usage)),
        ...resources.expressions.map((item) => createMaterialItem("대사 / 표정", "expression", item.id, item.label, item.description ?? item.id, usage)),
      ],
    },
    {
      title: "캐릭터 표시",
      description: "캐릭터 상태와 파츠 움직임처럼 캐릭터 자체를 바꾸는 재료입니다.",
      items: [
        ...resources.surfaces.map((item) => createMaterialItem("캐릭터 표시", "surface", item.id, item.label, item.description ?? item.id, usage)),
        ...resources.layers.map((item) => createMaterialItem("캐릭터 표시", "layer", item.id, item.label, item.description ?? item.id, usage)),
      ],
    },
    {
      title: "무대 조합",
      description: "런타임 배경, 전경, 환경 FX처럼 캐릭터와 별도로 켜고 끄는 화면 세트입니다.",
      items: [
        ...resources.scenes.map((item) => createMaterialItem("무대 조합", "scene", item.id, item.label, item.description ?? item.id, usage)),
      ],
    },
    {
      title: "플러그인 / UI",
      description: "외부 기능 호출과 말풍선, 메뉴, 상태 제어 재료입니다.",
      items: [
        ...registry.capabilities.map((capability) => createMaterialItem("플러그인 / UI", "plugin", String((capability.action as Record<string, unknown>).pluginId ?? capability.id), capability.name, capability.description ?? capability.id, usage, "unused")),
        ...registry.actions
          .filter((action) => ["ui", "plugin", "io", "flow"].includes(action.category))
          .map((action) => createMaterialItem("플러그인 / UI", "action", action.type, getReadableActionLabel(action.type), action.description, usage, "unused")),
      ],
    },
    {
      title: "선택 이벤트",
      description: "필수는 아니지만 필요할 때 연결할 수 있는 입력입니다.",
      items: registry.events
        .filter((event) => !requiredEventNames.has(event.event))
        .map((event) => ({
          id: `event:${event.event}`,
          label: getReadableEventLabel(event.event),
          description: event.description,
          group: "선택 이벤트",
          status: mappedEvents.has(event.event) ? "connected" : "unused",
          usageCount: configuredMappings.filter((rule) => rule.event === event.event).length,
        } satisfies MaterialItem)),
    },
  ].filter((group) => group.items.length > 0);
}

function createMaterialGroupElement(group: ReturnType<typeof createMaterialGroups>[number]) {
  const section = document.createElement("section");
  section.className = "nanika-material-group";

  const header = document.createElement("div");
  header.className = "nanika-material-group-header";

  const title = document.createElement("h3");
  title.textContent = group.title;

  const description = document.createElement("p");
  description.textContent = group.description;

  header.append(title, description);

  const flow = document.createElement("div");
  flow.className = "nanika-result-flow nanika-material-flow";
  flow.dataset.relation = "catalog";
  group.items.forEach((item) => {
    appendFlowItem(flow, createMaterialNode(item));
  });

  section.append(header, flow);

  return section;
}

function renderMaterialMaps() {
  const groups = createMaterialGroups();
  const elements = groups.map(createMaterialGroupElement);

  materialMap.replaceChildren(...elements.map((element) => element.cloneNode(true)));
  catalogMaterialMap.replaceChildren(...elements);
}

function createMermaidNodeId(prefix: string, value: string) {
  return `${prefix}_${value.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function escapeMermaidLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function collectMermaidActionLines(
  sourceNodeId: string,
  actions: readonly RuntimeAction[],
  lines: string[],
  prefix: string,
) {
  actions.forEach((action, index) => {
    const nodeId = `${prefix}_action_${index}_${createMermaidNodeId(action.type, String(index))}`;
    const actionRecord = action as {
      actions?: RuntimeAction[];
      items?: MermaidMenuItem[];
    };
    const nestedActions = Array.isArray(actionRecord.actions) ? actionRecord.actions : [];
    const menuItems = Array.isArray(actionRecord.items) ? actionRecord.items : [];
    const label = nestedActions.length > 0
      ? `${getReadableActionLabel(action.type)} (${nestedActions.length})`
      : getReadableActionLabel(action.type);

    lines.push(`  ${sourceNodeId} --> ${nodeId}["${escapeMermaidLabel(label)}"]:::action`);

    if (nestedActions.length > 0) {
      collectMermaidActionLines(nodeId, nestedActions, lines, `${prefix}_${index}`);
    }

    if (menuItems.length > 0) {
      collectMermaidMenuItemLines(nodeId, menuItems, lines, `${prefix}_${index}_menu`);
    }
  });
}

function createMermaidTargetNode(mapping: RuntimeRule | NanikaMapping, index: number) {
  const target = (mapping as NanikaMapping).target;
  const targetLabel = target?.label ?? getMappingTargetLabel(mapping);
  const targetId = target
    ? `${target.scope}_${target.id}`
    : `${getEventScope(mapping.event)}_${index}`;

  return {
    id: createMermaidNodeId("target", targetId),
    label: targetLabel,
  };
}

function collectMermaidMenuItemLines(
  sourceNodeId: string,
  items: readonly MermaidMenuItem[],
  lines: string[],
  prefix: string,
) {
  items.forEach((item, index) => {
    const itemId = String(item.id ?? index);
    const nodeId = `${prefix}_${createMermaidNodeId("item", itemId)}`;

    lines.push(`  ${sourceNodeId} --> ${nodeId}["메뉴: ${escapeMermaidLabel(item.label ?? itemId)}"]:::action`);

    if (Array.isArray(item.actions) && item.actions.length > 0) {
      collectMermaidActionLines(nodeId, item.actions, lines, `${prefix}_${index}`);
    }

    if (Array.isArray(item.children) && item.children.length > 0) {
      collectMermaidMenuItemLines(
        nodeId,
        item.children,
        lines,
        `${prefix}_${index}_children`,
      );
    }
  });
}

function createMappingsMermaid(
  mappings: readonly RuntimeRule[],
  saved: readonly NanikaMapping[] = savedMappings,
  mode: MermaidRelationMode = "execution",
) {
  const lines = [
    "flowchart LR",
    "  classDef context fill:#edf8f5,stroke:#32776c,color:#26231f",
    "  classDef event fill:#fff5e2,stroke:#b28751,color:#26231f",
    "  classDef mapping fill:#fffaf1,stroke:#b28751,color:#26231f",
    "  classDef action fill:#ffffff,stroke:#d7c9b8,color:#26231f",
    `  runtime["나니카 실행: ${escapeMermaidLabel(registry.preset.name)}"]:::context`,
    `  character["캐릭터: ${escapeMermaidLabel(registry.character.name)}"]:::context`,
    `  config["${escapeMermaidLabel(registry.character.name)} 설정"]:::context`,
    "  runtime -.표시 대상.-> character",
    "  character -.설정 참조.-> config",
  ];
  const savedMappingIds = new Set(saved.map((mapping) => mapping.id));
  const createdTargetIds = new Set<string>();

  mappings.forEach((mapping, index) => {
    const mappingNodeId = createMermaidNodeId("mapping", mapping.id);
    const eventNodeId = createMermaidNodeId(`event_${index}`, mapping.event);
    const targetNode = createMermaidTargetNode(mapping, index);
    const mappingLabel = savedMappingIds.has(mapping.id)
      ? `${mapping.id} / 저장됨`
      : mapping.id;

    if (!createdTargetIds.has(targetNode.id)) {
      lines.push(`  ${targetNode.id}["${escapeMermaidLabel(targetNode.label)}"]:::context`);
      createdTargetIds.add(targetNode.id);
    }

    lines.push(`  ${targetNode.id} --> ${eventNodeId}["${escapeMermaidLabel(getReadableEventLabel(mapping.event))}"]:::event`);
    lines.push(`  ${eventNodeId} --> ${mappingNodeId}["${escapeMermaidLabel(mappingLabel)}"]:::mapping`);
    collectMermaidActionLines(mappingNodeId, mapping.actions, lines, `mapping_${index}`);
  });

  if (mode === "reference") {
    lines.push("  %% 기능 묶음/카탈로그는 실행 흐름이 아니므로 이 Mermaid에는 연결하지 않습니다.");
  }

  return lines.join("\n");
}

function getFeatureSetsForDisplay() {
  if (savedFeatureSets.some((featureSet) => featureSet.id === "generic.character.full-runtime")) {
    return savedFeatureSets;
  }

  const source = savedFeatureSets.find((featureSet) => featureSet.id === "rine.full-runtime");

  if (!source) {
    return savedFeatureSets;
  }

  return [
    ...savedFeatureSets,
    {
      id: "generic.character.full-runtime",
      name: "캐릭터 미지정 기본 런타임 템플릿",
      description: "Rine 전체 런타임 구성을 기반으로 한 캐릭터 미지정 템플릿입니다.",
      mode: "character-template",
      sourceCharacterId: "rine",
      requirements: genericFeatureRequirements,
      mappingIds: source.mappingIds,
    } satisfies NanikaFeatureSet,
  ];
}

function getResourceOptionsForRequirement(kind: NonNullable<NanikaFeatureSet["requirements"]>[number]["kind"]) {
  const resources = registry.characterResources;

  if (kind === "expression") {
    return resources.expressions;
  }

  if (kind === "surface") {
    return resources.surfaces;
  }

  if (kind === "scene") {
    return resources.scenes;
  }

  if (kind === "layer") {
    return resources.layers;
  }

  if (kind === "dialogue") {
    return resources.dialogueCategories;
  }

  return resources.touchParts;
}

function getRequirementKindLabel(kind: NonNullable<NanikaFeatureSet["requirements"]>[number]["kind"]) {
  const labels: Record<NonNullable<NanikaFeatureSet["requirements"]>[number]["kind"], string> = {
    expression: "표정",
    surface: "캐릭터 상태",
    scene: "무대 조합",
    layer: "파츠 움직임",
    dialogue: "대사",
    hitArea: "터치 영역",
  };

  return labels[kind];
}

function checkFeatureSetCompatibility(featureSet: NanikaFeatureSet): FeatureCompatibility {
  const requirements = featureSet.requirements ?? [];

  if (requirements.length === 0) {
    return {
      status: "ready",
      available: 0,
      missing: [],
    };
  }

  const missing = requirements
    .filter((requirement) => requirement.required !== false)
    .filter((requirement) => !getResourceOptionsForRequirement(requirement.kind).some((option) => option.id === requirement.id))
    .map((requirement) => `${getRequirementKindLabel(requirement.kind)}: ${requirement.label ?? requirement.id}`);

  return {
    status: missing.length === 0 ? "ready" : missing.length === requirements.length ? "missing" : "partial",
    available: requirements.length - missing.length,
    missing,
  };
}

function getFeatureSetStatusText(featureSet: NanikaFeatureSet) {
  const compatibility = checkFeatureSetCompatibility(featureSet);

  if (featureSet.mode !== "character-template") {
    return "캐릭터 전용 묶음";
  }

  if (compatibility.status === "ready") {
    return "현재 캐릭터에 적용 가능";
  }

  if (compatibility.status === "partial") {
    return `일부 사용 불가: ${compatibility.missing.length}개 누락`;
  }

  return "현재 캐릭터에 사용 불가";
}

function createGraphNodeElement(node: GraphNode) {
  const element = document.createElement("article");
  element.className = "nanika-graph-node";
  element.dataset.kind = node.kind;
  element.dataset.status = node.status ?? "ready";

  const title = document.createElement("strong");
  title.textContent = node.title;

  const description = document.createElement("p");
  description.textContent = node.description;

  element.append(title, description);

  if (node.meta && node.meta.length > 0) {
    const meta = document.createElement("div");
    meta.className = "nanika-mapping-meta";
    node.meta.forEach((item) => {
      const pill = document.createElement("span");
      pill.textContent = item;
      meta.append(pill);
    });
    element.append(meta);
  }

  return element;
}

function createGraphColumnElement(column: GraphColumn) {
  const section = document.createElement("section");
  section.className = "nanika-graph-column";
  section.dataset.column = column.id;

  const header = document.createElement("div");
  header.className = "nanika-graph-column-header";

  const title = document.createElement("h3");
  title.textContent = column.title;

  const description = document.createElement("p");
  description.textContent = column.description;

  header.append(title, description);

  const nodes = document.createElement("div");
  nodes.className = "nanika-graph-column-nodes";
  nodes.replaceChildren(...column.nodes.map(createGraphNodeElement));

  section.append(header, nodes);

  return section;
}

function createResourceGraphNodes(
  kind: "expression" | "surface" | "scene" | "layer" | "dialogue" | "hitArea",
  title: string,
  options: readonly ParameterOption[],
  usageKind: string,
  usage: Map<string, number>,
) {
  const groupNode: GraphNode = {
    id: `group:${kind}`,
    kind: "resource-group",
    title,
    description: `${options.length}개 재료가 있습니다.`,
    meta: [`${options.filter((option) => (usage.get(`${usageKind}:${option.id}`) ?? 0) > 0).length}개 사용 중`],
  };

  return [
    groupNode,
    ...options.map((option): GraphNode => {
      const usageCount = usage.get(`${usageKind}:${option.id}`) ?? 0;

      return {
        id: `${kind}:${option.id}`,
        kind: "resource",
        title: option.label,
        description: option.description ?? option.id,
        meta: [`저장 키: ${option.id}`, usageCount > 0 ? `사용 ${usageCount}` : "미연결"],
        status: usageCount > 0 ? "ready" : "warning",
      };
    }),
  ];
}

function createMappingGraphColumns(): GraphColumn[] {
  const resources = registry.characterResources;
  const configuredMappings = getConfiguredMappings();
  const usage = collectActionUsage(configuredMappings.flatMap((rule) => rule.actions));
  const mappedEvents = new Set(configuredMappings.map((rule) => rule.event));
  const featureSets = getFeatureSetsForDisplay();

  return [
    {
      id: "runtime",
      title: "1. 나니카 실행",
      description: "나니카를 실행하는 가장 바깥 컨테이너입니다.",
      nodes: [{
        id: `runtime:${registry.preset.id}`,
        kind: "runtime",
        title: registry.preset.name,
        description: "실행 컨테이너입니다. 실제 연결 중심은 아래 캐릭터입니다.",
        meta: [`id: ${registry.preset.id}`, `rules ${configuredMappings.length}`, `source ${getConfiguredMappingSourceLabel()}`],
      }],
    },
    {
      id: "character",
      title: "2. 실제 캐릭터",
      description: "현재 매핑이 붙는 캐릭터입니다.",
      nodes: [{
        id: `character:${registry.character.id}`,
        kind: "character",
        title: `캐릭터: ${registry.character.name}`,
        description: registry.character.description,
        meta: [`id: ${registry.character.id}`, `기본 표정: ${registry.character.defaultExpression}`],
      }],
    },
    {
      id: "config",
      title: "3. 캐릭터 설정",
      description: "캐릭터가 가진 재료 묶음입니다.",
      nodes: [{
        id: `config:${registry.character.id}`,
        kind: "config",
        title: `${registry.character.name} 설정`,
        description: "표정, 캐릭터 상태, 무대 조합, 파츠, 대사, 터치 영역을 제공합니다.",
        meta: [
          `표정 ${registry.character.expressionCount}`,
          `캐릭터 상태 ${registry.character.surfaceCount}`,
          `무대 조합 ${registry.character.sceneCount}`,
          `터치 영역 ${registry.character.hitAreaCount}`,
        ],
      }],
    },
    {
      id: "resources",
      title: "4. 캐릭터 재료",
      description: "액션이 참조하는 실제 캐릭터 리소스입니다.",
      nodes: [
        ...createResourceGraphNodes("expression", "표정", resources.expressions, "expression", usage),
        ...createResourceGraphNodes("surface", "캐릭터 상태", resources.surfaces, "surface", usage),
        ...createResourceGraphNodes("scene", "무대 조합", resources.scenes, "scene", usage),
        ...createResourceGraphNodes("layer", "파츠 움직임", resources.layers, "layer", usage),
        ...createResourceGraphNodes("dialogue", "대사", resources.dialogueCategories, "dialogue", usage),
        ...createResourceGraphNodes("hitArea", "터치 영역", resources.touchParts, "hitArea", usage),
      ],
    },
    {
      id: "events",
      title: "5. 이벤트",
      description: "캐릭터와 UI에서 발생하는 시작점입니다.",
      nodes: registry.events.map((event): GraphNode => ({
        id: `event:${event.event}`,
        kind: "event",
        title: getReadableEventLabel(event.event),
        description: event.description,
        meta: [event.event, mappedEvents.has(event.event) ? "연결됨" : "미연결"],
        status: mappedEvents.has(event.event) ? "ready" : "warning",
      })),
    },
    {
      id: "mappings",
      title: "6. 연결 / 액션",
      description: "이벤트가 실행할 action flow입니다.",
      nodes: configuredMappings.map((mapping): GraphNode => ({
        id: `mapping:${mapping.id}`,
        kind: "mapping",
        title: mapping.id,
        description: `${getReadableEventLabel(mapping.event)}에서 ${countNestedActions(mapping.actions)}개 액션을 실행합니다.`,
        meta: mapping.actions.map((action) => getReadableActionLabel(action.type)).slice(0, 4),
      })),
    },
    {
      id: "feature-sets",
      title: "7. 기능 묶음",
      description: "연결 여러 개를 재사용하는 묶음입니다.",
      nodes: featureSets.map((featureSet): GraphNode => {
        const compatibility = checkFeatureSetCompatibility(featureSet);
        const missingPreview = compatibility.missing.slice(0, 3);

        return {
          id: `feature-set:${featureSet.id}`,
          kind: "feature-set",
          title: featureSet.name ?? featureSet.id,
          description: getFeatureSetStatusText(featureSet),
          meta: [
            featureSet.id,
            featureSet.mode === "character-template" ? "캐릭터 미지정 템플릿" : "캐릭터 전용",
            ...missingPreview,
          ],
          status: compatibility.status === "ready" ? "ready" : compatibility.status === "partial" ? "warning" : "missing",
        };
      }),
    },
  ];
}

function renderMappingGraph() {
  const canvas = document.createElement("div");
  canvas.className = "nanika-graph-canvas";
  canvas.style.setProperty("--nanika-graph-zoom", String(mappingGraphZoom));
  canvas.replaceChildren(...createMappingGraphColumns().map(createGraphColumnElement));

  mappingGraphPanel.dataset.size = mappingGraphExpanded ? "expanded" : "normal";
  mappingGraphViewport.replaceChildren(canvas);
  mappingGraphToggleButton.textContent = mappingGraphExpanded ? "그래프 작게 보기" : "그래프 크게 보기";
}

function countNestedActions(actions: readonly RuntimeAction[]): number {
  return actions.reduce((count, action) => {
    const nestedActions = (action as { actions?: RuntimeAction[] }).actions;
    return count + 1 + (Array.isArray(nestedActions) ? countNestedActions(nestedActions) : 0);
  }, 0);
}

function getMappingTargetLabel(mapping: RuntimeRule | NanikaMapping) {
  const target = (mapping as NanikaMapping).target;

  if (target?.label) {
    return target.label;
  }

  const eventScope = getEventScope(mapping.event);
  return scopeOptions.find((scope) => scope.id === eventScope)?.title ?? eventScope;
}

function uniqueFlowNodes(nodes: FlowBoardNode[]) {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);
    return true;
  });
}

function createMappingFlowBoardColumns(
  mappings: readonly (RuntimeRule | NanikaMapping)[],
  featureSets: readonly NanikaFeatureSet[] = savedFeatureSets,
): FlowBoardColumn[] {
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const targetNodes = uniqueFlowNodes(mappings.map((mapping) => ({
    id: `target:${getMappingTargetLabel(mapping)}`,
    title: getMappingTargetLabel(mapping),
    description: `${mappings.filter((item) => getMappingTargetLabel(item) === getMappingTargetLabel(mapping)).length}개 연결이 이 대상에 걸려 있습니다.`,
    variant: "target",
  })));
  const eventNodes = uniqueFlowNodes(mappings.map((mapping) => ({
    id: `event:${mapping.event}`,
    title: getReadableEventLabel(mapping.event),
    description: `${mappings.filter((item) => item.event === mapping.event).length}개 연결의 시작점입니다.`,
    meta: [mapping.event],
    variant: "event",
  })));
  const mappingNodes = mappings.map((mapping) => ({
    id: `mapping:${mapping.id}`,
    title: (mapping as NanikaMapping).name ?? mapping.id,
    description: `${getReadableEventLabel(mapping.event)}에서 ${mapping.actions.length}개 최상위 액션을 실행합니다.`,
    meta: [
      mapping.id,
      `전체 액션 ${countNestedActions(mapping.actions)}`,
    ],
    variant: "mapping",
  }));
  const actionNodes = uniqueFlowNodes(mappings.flatMap((mapping) => mapping.actions.map((action) => ({
    id: `action:${action.type}`,
    title: getReadableActionLabel(action.type),
    description: `${mappings.filter((item) => collectActionUsage(item.actions).has(`action:${action.type}`)).length}개 연결에서 사용됩니다.`,
    meta: [action.type],
    variant: "action",
  }))));
  const featureSetNodes = featureSets.map((featureSet) => {
    const validCount = featureSet.mappingIds.filter((mappingId) => mappingById.has(mappingId)).length;
    const missingCount = featureSet.mappingIds.length - validCount;

    return {
      id: `feature-set:${featureSet.id}`,
      title: featureSet.name ?? featureSet.id,
      description: `${validCount}개 연결을 포함합니다.${missingCount > 0 ? ` 누락 ${missingCount}개가 있습니다.` : ""}`,
      meta: [featureSet.id],
      variant: missingCount > 0 ? "missing" : "target",
    };
  });

  return [
    {
      title: "1. 적용 대상",
      description: "누구에게 붙는 연결인지 먼저 봅니다.",
      nodes: targetNodes,
    },
    {
      title: "2. 시작 이벤트",
      description: "언제 실행되는지 봅니다.",
      nodes: eventNodes,
    },
    {
      title: "3. 저장/적용 연결",
      description: "이벤트와 액션을 묶은 연결 단위입니다.",
      nodes: mappingNodes,
    },
    {
      title: "4. 실행 액션",
      description: "나니카가 실제로 수행하는 행동입니다.",
      nodes: actionNodes,
    },
    {
      title: "5. 기능 묶음",
      description: "여러 연결을 한 번에 적용하기 위한 묶음입니다.",
      nodes: featureSetNodes,
    },
  ];
}

function appendFlowStep(flow: HTMLElement, node: HTMLElement) {
  if (flow.childElementCount > 0) {
    flow.append(createFlowArrow());
  }

  flow.append(node);
}

function appendFlowItem(flow: HTMLElement, node: HTMLElement) {
  flow.append(node);
}

function createActionFlowNode(action: RuntimeAction, index: number) {
  const actionRecord = action as { actions?: RuntimeAction[] };
  const nestedActions = Array.isArray(actionRecord.actions) ? actionRecord.actions : [];
  const node = createFlowNode(
    `${index + 1}. ${getReadableActionLabel(action.type)}`,
    nestedActions.length > 0 ? `${nestedActions.length}개 액션 포함` : formatAction(action),
    nestedActions.length > 0 ? "group" : "action",
  );

  if (nestedActions.length > 0) {
    const nestedList = document.createElement("ul");
    nestedList.className = "nanika-result-flow-nested";
    nestedActions.forEach((nestedAction, nestedIndex) => {
      const item = document.createElement("li");
      item.textContent = `${nestedIndex + 1}. ${getReadableActionLabel(nestedAction.type)}`;
      nestedList.append(item);
    });
    node.append(nestedList);
  }

  return node;
}

function createMappingFlow(mapping: NanikaMapping) {
  const flow = document.createElement("div");
  flow.className = "nanika-result-flow";

  appendFlowStep(flow, createFlowNode(
    mapping.target?.label ?? getReadableEventLabel(mapping.event),
    mapping.target ? "연결 대상" : "시작점",
    "target",
  ));
  appendFlowStep(flow, createFlowNode(getReadableEventLabel(mapping.event), mapping.event, "event"));
  mapping.actions.forEach((action, index) => {
    appendFlowStep(flow, createActionFlowNode(action, index));
  });

  return flow;
}

function createDraftMappingFlow() {
  const flow = document.createElement("div");
  flow.className = "nanika-result-flow";

  appendFlowStep(flow, createFlowNode(
    selectedScope ? scopeOptions.find((scope) => scope.id === selectedScope)?.title ?? selectedScope : "대상 미선택",
    selectedScope ? "시작 영역" : "먼저 대상 선택",
    selectedScope ? "target" : "missing",
  ));
  appendFlowStep(flow, createFlowNode(
    selectedEvent ? getReadableEventLabel(selectedEvent) : "이벤트 미선택",
    selectedEvent ?? "이벤트를 고르면 연결이 시작됩니다.",
    selectedEvent ? "event" : "missing",
  ));

  if (draftActionFlow.length === 0) {
    appendFlowStep(flow, createFlowNode("액션 없음", "액션을 추가하면 여기서 흐름을 확인합니다.", "missing"));
    return flow;
  }

  draftActionFlow.forEach((action, index) => {
    appendFlowStep(flow, createActionFlowNode(action, index));
  });

  return flow;
}

function renderDraftFlowPreview() {
  draftFlowPreview.replaceChildren(createDraftMappingFlow());
}

function createFeatureSetFlow(featureSet: NanikaFeatureSet) {
  const flow = document.createElement("div");
  flow.className = "nanika-result-flow";
  flow.dataset.relation = "contains";
  const mappingById = new Map(savedMappings.map((mapping) => [mapping.id, mapping]));

  appendFlowItem(flow, createFlowNode(featureSet.name ?? featureSet.id, "포함 묶음", "target"));
  featureSet.mappingIds.forEach((mappingId, index) => {
    const mapping = mappingById.get(mappingId);
    const actionCount = mapping?.actions.length ?? 0;
    appendFlowItem(flow, createFlowNode(
      mapping?.name ?? mappingId,
      mapping ? `${getReadableEventLabel(mapping.event)} · 액션 ${actionCount}개` : "누락된 연결",
      mapping ? "mapping" : "missing",
    ));
  });

  return flow;
}

function createActionButton(label: string, onClick: () => void | Promise<void>) {
  const button = document.createElement("button");
  button.className = "asset-small-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    void onClick();
  });

  return button;
}

function cloneRuntimeAction(action: RuntimeAction): RuntimeAction {
  return JSON.parse(JSON.stringify(action)) as RuntimeAction;
}

function createActionGroup(type: "run_sequence" | "run_parallel" | "run_random", actions: RuntimeAction[]): RuntimeAction {
  return {
    type,
    actions: actions.map(cloneRuntimeAction),
  } as RuntimeAction;
}

function renderDetailPanel(source: DetailSource, title: string, description: string, meta: string[] = []) {
  const heading = document.createElement("strong");
  heading.textContent = `${source}: ${title}`;

  const body = document.createElement("p");
  body.textContent = description;

  mappingDetailPanel.replaceChildren(heading, body);

  if (meta.length > 0) {
    const metaList = document.createElement("div");
    metaList.className = "nanika-mapping-meta";
    meta.forEach((item) => {
      const pill = document.createElement("span");
      pill.textContent = item;
      metaList.append(pill);
    });
    mappingDetailPanel.append(metaList);
  }
}

function createStepOptionButton(option: StepOption, source: DetailSource, selected: boolean, onClick: () => void) {
  const button = document.createElement("button");
  button.className = "nanika-step-option";
  button.type = "button";
  button.dataset.selected = selected ? "true" : "false";
  button.title = option.description;

  const title = document.createElement("strong");
  title.textContent = option.title;

  button.append(title);

  if (option.meta && option.meta.length > 0) {
    const meta = document.createElement("small");
    meta.textContent = option.meta.join(" / ");
    button.append(meta);
  }

  button.addEventListener("mouseenter", () => renderDetailPanel(source, option.title, option.description, option.meta));
  button.addEventListener("focus", () => renderDetailPanel(source, option.title, option.description, option.meta));
  button.addEventListener("click", onClick);

  return button;
}

function formatAction(action: RuntimeAction) {
  const record = action as Record<string, unknown>;

  if (action.type === "call_plugin") {
    return `${action.type}:${String(record.pluginId ?? "")}`;
  }

  if (action.type === "speak") {
    return `${action.type}:${String(record.category ?? "")}`;
  }

  if (action.type === "surface") {
    return `${action.type}:${String(record.id ?? "")}`;
  }

  if (Array.isArray(record.actions)) {
    const groupType = action.type as "run_sequence" | "run_parallel" | "run_random";
    const groupDescription = actionGroupDescriptions[groupType]?.summary ?? "묶음 안의 액션을 실행합니다.";

    return `${groupDescription} 포함 액션 ${record.actions.length}개.`;
  }

  return action.type;
}

function formatNestedActionLabels(action: RuntimeAction) {
  const nestedActions = (action as { actions?: RuntimeAction[] }).actions;

  if (!Array.isArray(nestedActions)) {
    return [];
  }

  return nestedActions.map((nestedAction, index) => `${index + 1}. ${getReadableActionLabel(nestedAction.type)}`);
}

function formatRequiredControls(item: unknown) {
  const controls = (item as { requiredControls?: readonly (keyof RuntimeControlOptions)[] }).requiredControls ?? [];

  return controls.map((control) => `control: ${String(control)}`);
}

function formatPayloadFields(item: unknown) {
  const fields = (item as { payloadFields?: readonly { name: string }[] }).payloadFields ?? [];

  return fields.map((field) => `payload: ${field.name}`);
}

function formatResourceOptions(options: readonly ParameterOption[]) {
  return options.length > 0
    ? options.map((option) => option.label)
    : ["등록된 항목 없음"];
}

function getSavedMappingStatus() {
  const appliedIds = new Set(registry.mappings.map((rule) => rule.id));
  const savedIds = new Set(savedMappings.map((mapping) => mapping.id));
  const savedAndApplied = savedMappings.filter((mapping) => appliedIds.has(mapping.id));
  const savedOnly = savedMappings.filter((mapping) => !appliedIds.has(mapping.id));
  const appliedOnly = registry.mappings.filter((rule) => !savedIds.has(rule.id));
  const duplicateSavedIds = savedMappings
    .map((mapping) => mapping.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  return {
    appliedIds,
    savedIds,
    savedAndApplied,
    savedOnly,
    appliedOnly,
    duplicateSavedIds: Array.from(new Set(duplicateSavedIds)),
  };
}

function getMermaidMappings() {
  return getConfiguredMappings();
}

function refreshOverview() {
  const configuredMappings = getConfiguredMappings();

  renderMaterialMaps();
  renderRuntimeProfileOverview();
  renderSummary();
  renderConnectionMap();
  renderFlowBoard(mappingFlowBoard, createMappingFlowBoardColumns(configuredMappings, savedFeatureSets));
  renderMappingGraph();
  renderCoverage();
  renderMappings();
  renderEditorCanvas();
  mappingMermaidPreview.textContent = createMappingsMermaid(getMermaidMappings(), savedMappings, "reference");
}

function getSelectedActionCatalogItem(): RuntimeActionCatalogItem | undefined {
  return registry.actions.find((action) => action.type === selectedActionType);
}

function getSelectedEventCatalogItem() {
  return registry.events.find((event) => event.event === selectedEvent);
}

function getEventsForSelectedScope() {
  if (!selectedScope) {
    return [];
  }

  return registry.events.filter((event) => getEventScope(event.event) === selectedScope);
}

function getActionsForSelectedCategory() {
  if (!selectedActionCategory) {
    return [];
  }

  return registry.actions.filter((action) => action.category === selectedActionCategory);
}

function parseParameterValue(parameter: RuntimeActionParameterCatalogItem, value: string) {
  if (parameter.type === "boolean") {
    return { value: value === "true" };
  }

  if (parameter.type === "number") {
    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? { value: numericValue }
      : { value, error: `${parameter.name}은 숫자로 입력하세요.` };
  }

  if (jsonParameterTypes.has(parameter.type)) {
    try {
      return { value: JSON.parse(value) };
    } catch {
      return { value, error: `${parameter.name}의 JSON 형식이 올바르지 않습니다.` };
    }
  }

  return { value };
}

function renderScopeOptions() {
  draftScopeOptions.replaceChildren(...scopeOptions.map((scope) => createStepOptionButton(
    scope,
    "대상",
    selectedScope === scope.id,
    () => {
      selectedScope = scope.id;
      selectedEvent = null;
      selectedActionCategory = null;
      selectedActionType = null;
      renderDetailPanel("대상", scope.title, scope.description);
      renderStepBuilder();
    },
  )));
}

function renderEventOptions() {
  const events = getEventsForSelectedScope();

  if (!selectedScope) {
    draftEventHelp.textContent = "시작 영역을 선택하면 연결 가능한 이벤트가 나타납니다.";
    draftEventOptions.replaceChildren(createCard("대기 중", "먼저 시작 영역을 선택하세요."));
    return;
  }

  if (events.length === 0) {
    draftEventHelp.textContent = "이 영역에는 아직 등록된 이벤트가 없습니다.";
    draftEventOptions.replaceChildren(createCard("이벤트 없음", "나중에 custom event 등록 기능에서 확장할 수 있습니다."));
    return;
  }

  draftEventHelp.textContent = `${events.length}개 이벤트 중 하나를 선택하세요.`;
  draftEventOptions.replaceChildren(...events.map((event) => createStepOptionButton(
    {
      id: event.event,
      title: getReadableEventLabel(event.event),
      description: event.description,
      meta: [event.event, ...formatPayloadFields(event), ...formatRequiredControls(event)],
    },
    "이벤트",
    selectedEvent === event.event,
    () => {
      selectedEvent = event.event;
      selectedActionCategory = null;
      selectedActionType = null;
      renderDetailPanel("이벤트", getReadableEventLabel(event.event), event.description, [
        event.event,
        ...formatPayloadFields(event),
        ...formatRequiredControls(event),
      ]);
      renderStepBuilder();
    },
  )));
}

function renderActionCategoryOptions() {
  if (!selectedEvent) {
    draftActionCategoryOptions.replaceChildren(createCard("대기 중", "먼저 이벤트를 선택하세요."));
    return;
  }

  draftActionCategoryOptions.replaceChildren(...actionCategoryOptions.map((category) => createStepOptionButton(
    {
      id: category.id,
      title: category.title,
      description: category.description,
      meta: [`actions: ${registry.actions.filter((action) => action.category === category.id).length}`],
    },
    "실행 영역",
    selectedActionCategory === category.id,
    () => {
      selectedActionCategory = category.id;
      selectedActionType = null;
      renderDetailPanel("실행 영역", category.title, category.description);
      renderStepBuilder();
    },
  )));
}

function renderActionOptions() {
  const actions = getActionsForSelectedCategory();

  if (!selectedActionCategory) {
    draftActionHelp.textContent = "실행 영역을 선택하면 구체적인 액션이 나타납니다.";
    draftActionOptions.replaceChildren(createCard("대기 중", "먼저 실행 영역을 선택하세요."));
    return;
  }

  draftActionHelp.textContent = `${actions.length}개 액션 중 하나를 선택하세요.`;
  draftActionOptions.replaceChildren(...actions.map((action) => createStepOptionButton(
    {
      id: action.type,
      title: getReadableActionLabel(action.type),
      description: action.description,
      meta: [action.type, ...formatRequiredControls(action)],
    },
    "액션",
    selectedActionType === action.type,
    () => {
      selectedActionType = action.type;
      renderDetailPanel("액션", getReadableActionLabel(action.type), action.description, [
        action.type,
        ...formatRequiredControls(action),
      ]);
      renderStepBuilder();
    },
  )));
}

function renderDraftActionParameters() {
  const selectedAction = getSelectedActionCatalogItem();
  draftActionParameters.replaceChildren();

  if (!selectedAction) {
    const empty = document.createElement("p");
    empty.className = "asset-lab-help";
    empty.textContent = "액션을 선택하면 입력할 값이 나타납니다.";
    draftActionParameters.append(empty);
    return;
  }

  if (selectedAction.parameters.length === 0) {
    const empty = document.createElement("p");
    empty.className = "asset-lab-help";
    empty.textContent = "이 액션은 입력할 파라미터가 없습니다.";
    draftActionParameters.append(empty);
    return;
  }

  selectedAction.parameters.forEach((parameter) => {
    const label = document.createElement("label");
    const inputId = `draftActionParam_${parameter.name}`;
    label.htmlFor = inputId;
    label.textContent = `${getReadableParameterLabel(parameter.name)}${parameter.required ? " *" : ""}`;

    let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const options = getParameterOptions(selectedAction.type, parameter.name);
    if (options.length > 0) {
      const select = document.createElement("select");
      select.append(new Option("선택하세요", ""));
      options.forEach((option) => {
        const optionElement = new Option(option.label, option.id);
        if (option.description) {
          optionElement.title = option.description;
        }
        select.append(optionElement);
      });
      input = select;
    } else if (parameter.type === "boolean") {
      const select = document.createElement("select");
      select.append(
        new Option("선택 안 함", ""),
        new Option("true", "true"),
        new Option("false", "false"),
      );
      input = select;
    } else if (jsonParameterTypes.has(parameter.type)) {
      const textarea = document.createElement("textarea");
      textarea.placeholder = parameter.required ? "{}" : "선택 입력";
      input = textarea;
    } else {
      const textInput = document.createElement("input");
      textInput.type = parameter.type === "number" ? "number" : "text";
      input = textInput;
    }

    input.id = inputId;
    input.dataset.parameterName = parameter.name;
    input.addEventListener("input", renderDraftPreview);
    input.addEventListener("change", renderDraftPreview);

    const help = document.createElement("small");
    help.textContent = parameter.description;

    label.append(input, help);
    draftActionParameters.append(label);
  });
}

function createActionFromSelectedInputs(errors: string[]) {
  const selectedAction = getSelectedActionCatalogItem();

  if (!selectedAction) {
    errors.push("액션을 선택하세요.");
    return null;
  }

  const action = {
    type: selectedAction.type,
  } as Record<string, unknown>;

  selectedAction.parameters.forEach((parameter) => {
    const input = draftActionParameters.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-parameter-name="${parameter.name}"]`,
    );
    const rawValue = input?.value.trim() ?? "";

    if (!rawValue) {
      if (parameter.required) {
        errors.push(`필수 파라미터 누락: ${parameter.name}`);
      }
      return;
    }

    const parsed = parseParameterValue(parameter, rawValue);
    if (parsed.error) {
      errors.push(parsed.error);
      return;
    }

    action[parameter.name] = parsed.value;
  });

  return errors.length > 0 ? null : action as RuntimeAction;
}

function renderActionFlow() {
  if (draftActionFlow.length === 0) {
    draftActionFlowList.replaceChildren(createCard(
      "액션 없음",
      "선택 액션 설정에서 액션을 추가하면 여기에 쌓입니다. 2개 이상 쌓은 뒤 실행 방식을 고를 수 있습니다.",
    ));
    renderDraftFlowPreview();
    return;
  }

  draftActionFlowList.replaceChildren(...draftActionFlow.map((action, index) => {
    const nestedActionLabels = formatNestedActionLabels(action);
    const meta = [`type: ${action.type}`, ...nestedActionLabels];
    const card = createCard(
      `${index + 1}. ${getReadableActionLabel(action.type)}`,
      formatAction(action),
      meta,
    );
    const controls = document.createElement("div");
    controls.className = "asset-lab-button-row";
    controls.append(
      createActionButton("위로", () => {
        if (index <= 0) {
          return;
        }

        const previousAction = draftActionFlow[index - 1];
        const currentAction = draftActionFlow[index];
        if (!previousAction || !currentAction) {
          return;
        }

        draftActionFlow[index - 1] = currentAction;
        draftActionFlow[index] = previousAction;
        renderActionFlow();
        renderDraftFlowPreview();
        renderDraftPreview();
      }),
      createActionButton("아래로", () => {
        if (index >= draftActionFlow.length - 1) {
          return;
        }

        const currentAction = draftActionFlow[index];
        const nextAction = draftActionFlow[index + 1];
        if (!currentAction || !nextAction) {
          return;
        }

        draftActionFlow[index] = nextAction;
        draftActionFlow[index + 1] = currentAction;
        renderActionFlow();
        renderDraftFlowPreview();
        renderDraftPreview();
      }),
      createActionButton("복제", () => {
        if (draftActionFlow.length >= maxActionFlowSteps) {
          draftMappingStatus.textContent = `액션 플로우는 최대 ${maxActionFlowSteps}개까지 추가할 수 있습니다.`;
          draftMappingStatus.dataset.state = "warning";
          return;
        }

        draftActionFlow.splice(index + 1, 0, cloneRuntimeAction(action));
        renderActionFlow();
        renderDraftFlowPreview();
        renderDraftPreview();
      }),
      createActionButton("삭제", () => {
        draftActionFlow.splice(index, 1);
        renderActionFlow();
        renderDraftFlowPreview();
        renderDraftPreview();
      }),
    );
    card.append(controls);

    return card;
  }));
}

function addSelectedActionToFlow() {
  const errors: string[] = [];

  if (draftActionFlow.length >= maxActionFlowSteps) {
    draftMappingStatus.textContent = `액션 플로우는 최대 ${maxActionFlowSteps}개까지 추가할 수 있습니다.`;
    draftMappingStatus.dataset.state = "warning";
    renderDraftPreview();
    return;
  }

  const action = createActionFromSelectedInputs(errors);

  if (!action) {
    draftMappingStatus.textContent = errors.join(" / ") || "추가할 액션이 없습니다.";
    draftMappingStatus.dataset.state = "warning";
    renderDraftPreview();
    return;
  }

  draftActionFlow.push(action);
  renderActionFlow();
  renderDraftFlowPreview();
  renderDraftPreview();
  draftMappingStatus.textContent = `${getReadableActionLabel(action.type)} 액션을 플로우에 추가했어요.`;
  draftMappingStatus.dataset.state = "ready";
}

function wrapCurrentActionFlow(type: "run_sequence" | "run_parallel" | "run_random") {
  if (draftActionFlow.length < 2) {
    draftMappingStatus.textContent = "묶음으로 만들려면 액션 플로우에 액션을 2개 이상 추가하세요.";
    draftMappingStatus.dataset.state = "warning";
    return;
  }

  draftActionFlow = [createActionGroup(type, draftActionFlow)];
  renderActionFlow();
  renderDraftFlowPreview();
  renderDraftPreview();
  draftMappingStatus.textContent = actionGroupDescriptions[type].status;
  draftMappingStatus.dataset.state = "ready";
}

function createDraftMapping(): DraftMappingResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const mappingId = draftMappingIdInput.value.trim() || "new.mapping";

  if (!selectedScope) {
    errors.push("대상을 선택하세요.");
  }

  if (!selectedEvent) {
    errors.push("이벤트를 선택하세요.");
  }

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(mappingId)) {
    errors.push("매핑 ID는 영문, 숫자, -, _, ., : 조합으로 입력하세요.");
  }

  if (draftActionFlow.length === 0) {
    errors.push("액션 플로우에 액션을 하나 이상 추가하세요.");
  }

  if (draftActionFlow.length > maxActionFlowSteps) {
    errors.push(`액션 플로우는 최대 ${maxActionFlowSteps}개까지만 저장할 수 있습니다.`);
  }

  if (!selectedEvent) {
    return { mapping: null, runtimeRule: null, warnings, errors };
  }

  const draftName = draftMappingNameInput.value.trim();
  const selectedTarget = getSelectedTargetOption();
  const mapping: NanikaMapping = {
    id: mappingId,
    event: selectedEvent,
    actions: [...draftActionFlow],
  };

  if (draftName) {
    mapping.name = draftName;
  }

  if (selectedTarget) {
    mapping.target = {
      scope: selectedTarget.scope,
      id: selectedTarget.id,
      label: selectedTarget.label,
    };
  }

  if (registry.mappings.some((rule) => rule.id === mapping.id)) {
    warnings.push(`현재 preset에 같은 rule id가 있습니다: ${mapping.id}`);
  }

  return {
    mapping,
    runtimeRule: createRuntimeRuleFromMapping(mapping),
    warnings,
    errors,
  };
}

function renderDraftPreview() {
  lastDraftResult = createDraftMapping();
  draftMappingPreview.textContent = JSON.stringify({
    mapping: lastDraftResult.mapping,
    runtimeRule: lastDraftResult.runtimeRule,
  }, null, 2);
  if (activeView === "create" && editorSelection.type === "draft") {
    renderEditorCanvas();
  }

  if (lastDraftResult.errors.length > 0) {
    draftMappingStatus.textContent = lastDraftResult.errors.join(" / ");
    draftMappingStatus.dataset.state = "warning";
    return;
  }

  draftMappingStatus.textContent = lastDraftResult.warnings.length > 0
    ? lastDraftResult.warnings.join(" / ")
    : "저장 가능한 매핑입니다.";
  draftMappingStatus.dataset.state = lastDraftResult.warnings.length > 0 ? "warning" : "ready";
}

function initTargetOptions() {
  draftTargetSelect.replaceChildren(
    ...targetOptions.map((target) => {
      const option = new Option(target.label, createMappingTargetValue(target.scope, target.id));
      option.title = target.description;
      return option;
    }),
  );
}

function initMappingGraphControls() {
  mappingGraphToggleButton.addEventListener("click", () => {
    mappingGraphExpanded = !mappingGraphExpanded;
    renderMappingGraph();
  });

  mappingGraphZoomOutButton.addEventListener("click", () => {
    mappingGraphZoom = Math.max(0.65, Math.round((mappingGraphZoom - 0.1) * 10) / 10);
    renderMappingGraph();
  });

  mappingGraphZoomInButton.addEventListener("click", () => {
    mappingGraphZoom = Math.min(1.4, Math.round((mappingGraphZoom + 0.1) * 10) / 10);
    renderMappingGraph();
  });

  mappingGraphResetButton.addEventListener("click", () => {
    mappingGraphZoom = 1;
    renderMappingGraph();
  });
}

function renderStepBuilder() {
  renderScopeOptions();
  renderEventOptions();
  renderActionCategoryOptions();
  renderActionOptions();
  renderDraftActionParameters();
  renderActionFlow();
  renderDraftFlowPreview();
  renderDraftPreview();
}

async function copyText(text: string, statusElement: HTMLElement, message: string) {
  await navigator.clipboard.writeText(text);
  statusElement.textContent = message;
  statusElement.dataset.state = "ready";
}

async function loadSavedMappings() {
  savedMappingStatus.textContent = "저장된 매핑을 불러오는 중입니다.";
  savedMappingStatus.dataset.state = "ready";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/nanika-mappings"));
    const result = await readApiJson<NanikaMappingsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "저장된 매핑을 불러오지 못했습니다.");
    }

    savedMappings = result.mappings ?? [];
    savedMappingsLoaded = true;
    saveCanvasStatesToStorage();
    renderSavedMappings(result.path);
    renderFeatureSets();
    refreshOverview();
  } catch (error) {
    savedMappings = [];
    savedMappingsLoaded = false;
    renderSavedMappings();
    refreshOverview();
    savedMappingStatus.textContent = error instanceof Error ? error.message : "저장된 매핑을 불러오지 못했습니다.";
    savedMappingStatus.dataset.state = "warning";
  }
}

async function saveDraftMapping() {
  renderDraftPreview();

  if (!lastDraftResult.mapping || lastDraftResult.errors.length > 0) {
    draftMappingStatus.textContent = lastDraftResult.errors.join(" / ") || "저장할 매핑이 없습니다.";
    draftMappingStatus.dataset.state = "warning";
    return;
  }

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-mapping"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping: lastDraftResult.mapping }),
    });
    const result = await readApiJson<NanikaMappingsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "매핑을 저장하지 못했습니다.");
    }

    savedMappings = result.mappings ?? [];
    savedMappingsLoaded = true;
    renderSavedMappings(result.path);
    refreshOverview();
    draftMappingStatus.textContent = `${lastDraftResult.mapping.id} 매핑을 저장했어요.`;
    draftMappingStatus.dataset.state = "ready";
  } catch (error) {
    draftMappingStatus.textContent = error instanceof Error ? error.message : "매핑을 저장하지 못했습니다.";
    draftMappingStatus.dataset.state = "warning";
  }
}

async function deleteSavedMapping(mappingId: string) {
  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-nanika-mapping"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mappingId }),
    });
    const result = await readApiJson<NanikaMappingsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "저장 연결을 삭제하지 못했습니다.");
    }

    savedMappings = result.mappings ?? [];
    savedMappingsLoaded = true;
    renderSavedMappings(result.path);
    refreshOverview();
    savedMappingStatus.textContent = `${mappingId} 저장 연결을 삭제했어요. 원본 asset은 삭제하지 않았어요.`;
    savedMappingStatus.dataset.state = "ready";
  } catch (error) {
    savedMappingStatus.textContent = error instanceof Error ? error.message : "저장 연결을 삭제하지 못했습니다.";
    savedMappingStatus.dataset.state = "warning";
  }
}

async function loadFeatureSets() {
  featureSetStatus.textContent = "저장된 기능 묶음을 불러오는 중입니다.";
  featureSetStatus.dataset.state = "ready";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/nanika-feature-sets"));
    const result = await readApiJson<NanikaFeatureSetsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "저장된 기능 묶음을 불러오지 못했습니다.");
    }

    savedFeatureSets = result.featureSets ?? [];
    saveCanvasStatesToStorage();
    renderFeatureSets(result.path);
    refreshOverview();
  } catch (error) {
    savedFeatureSets = [];
    renderFeatureSets();
    refreshOverview();
    featureSetStatus.textContent = error instanceof Error ? error.message : "저장된 기능 묶음을 불러오지 못했습니다.";
    featureSetStatus.dataset.state = "warning";
  }
}

async function saveFeatureSet() {
  const mappingIds = getSelectedFeatureSetMappingIds();
  const featureSetId = featureSetIdInput.value.trim() || "new.feature-set";
  const featureSetName = featureSetNameInput.value.trim();

  if (mappingIds.length === 0) {
    featureSetStatus.textContent = "기능 묶음에 넣을 저장된 연결을 하나 이상 선택하세요.";
    featureSetStatus.dataset.state = "warning";
    return;
  }

  const featureSet: NanikaFeatureSet = {
    id: featureSetId,
    mode: "character-specific",
    sourceCharacterId: registry.character.id,
    mappingIds,
  };

  if (featureSetName) {
    featureSet.name = featureSetName;
  }

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-feature-set"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureSet }),
    });
    const result = await readApiJson<NanikaFeatureSetsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "기능 묶음을 저장하지 못했습니다.");
    }

    savedFeatureSets = result.featureSets ?? [];
    renderFeatureSets(result.path);
    refreshOverview();
    featureSetStatus.textContent = `${featureSet.id} 기능 묶음을 저장했어요.`;
    featureSetStatus.dataset.state = "ready";
  } catch (error) {
    featureSetStatus.textContent = error instanceof Error ? error.message : "기능 묶음을 저장하지 못했습니다.";
    featureSetStatus.dataset.state = "warning";
  }
}

async function deleteFeatureSet(featureSetId: string) {
  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-nanika-feature-set"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: featureSetId }),
    });
    const result = await readApiJson<NanikaFeatureSetsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "기능 묶음을 삭제하지 못했습니다.");
    }

    savedFeatureSets = result.featureSets ?? [];
    renderFeatureSets(result.path);
    refreshOverview();
    featureSetStatus.textContent = `${featureSetId} 기능 묶음을 삭제했어요.`;
    featureSetStatus.dataset.state = "ready";
  } catch (error) {
    featureSetStatus.textContent = error instanceof Error ? error.message : "기능 묶음을 삭제하지 못했습니다.";
    featureSetStatus.dataset.state = "warning";
  }
}

function loadMappingIntoDraft(mapping: NanikaMapping) {
  const [firstAction] = mapping.actions;
  const firstActionType = firstAction?.type;
  const actionCatalogItem = registry.actions.find((action) => action.type === firstActionType);

  selectedScope = getEventScope(mapping.event);
  selectedEvent = mapping.event;
  selectedActionCategory = actionCatalogItem?.category ?? null;
  selectedActionType = firstActionType ?? null;
  draftActionFlow = [...mapping.actions];
  draftMappingIdInput.value = mapping.id;
  draftMappingNameInput.value = mapping.name ?? mapping.id;
  if (mapping.target) {
    const targetValue = createMappingTargetValue(mapping.target.scope, mapping.target.id);
    if (!Array.from(draftTargetSelect.options).some((option) => option.value === targetValue)) {
      draftTargetSelect.append(new Option(mapping.target.label ?? mapping.target.id, targetValue));
    }
    draftTargetSelect.value = targetValue;
  }
  renderStepBuilder();

  const actionRecord = firstAction as Record<string, unknown> | undefined;
  getSelectedActionCatalogItem()?.parameters.forEach((parameter) => {
    const input = draftActionParameters.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-parameter-name="${parameter.name}"]`,
    );
    const value = actionRecord?.[parameter.name];

    if (!input || value === undefined) {
      return;
    }

    const nextValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (input instanceof HTMLSelectElement && nextValue && !Array.from(input.options).some((option) => option.value === nextValue)) {
      input.append(new Option(`직접 입력: ${nextValue}`, nextValue));
    }
    input.value = nextValue;
  });

  renderDraftPreview();
  if (activeView === "create") {
    selectEditorDraft();
  }
  draftMappingStatus.textContent = `${mapping.id} 매핑을 편집기로 불러왔어요.`;
  draftMappingStatus.dataset.state = "ready";
}

function syncSelectedSnippetFeatureSetIds() {
  const availableIds = new Set(savedFeatureSets.map((featureSet) => featureSet.id));
  selectedSnippetFeatureSetIds = new Set(
    Array.from(selectedSnippetFeatureSetIds).filter((featureSetId) => availableIds.has(featureSetId)),
  );

  if (selectedSnippetFeatureSetIds.size === 0 && savedFeatureSets.length > 0) {
    selectedSnippetFeatureSetIds = new Set(savedFeatureSets.map((featureSet) => featureSet.id));
  }
}

function getSelectedSnippetFeatureSetIds() {
  syncSelectedSnippetFeatureSetIds();

  return Array.from(selectedSnippetFeatureSetIds);
}

function createSnippet(
  mappings: readonly NanikaMapping[],
  featureSets: readonly NanikaFeatureSet[],
  featureSetIds: readonly string[] = featureSets.map((featureSet) => featureSet.id),
) {
  const mappingsJson = JSON.stringify(mappings, null, 2);
  const featureSetsJson = JSON.stringify(featureSets, null, 2);
  const selectedFeatureSetIdsJson = JSON.stringify(featureSetIds, null, 2);

  return `import { createGhostRuntimeFromPreset, createRuntimeRulesFromFeatureSets, createRuntimeRulesFromMappings } from "ghost-nest";
import { nanikaPreset } from "./nanikaPreset";

const savedMappings = ${mappingsJson};
const savedFeatureSets = ${featureSetsJson};
const selectedFeatureSetIds = ${selectedFeatureSetIdsJson};
const featureSetRules = createRuntimeRulesFromFeatureSets(savedFeatureSets, savedMappings, selectedFeatureSetIds);
if (featureSetRules.warnings.length > 0) {
  console.warn("[Nanika] Feature set warnings", featureSetRules.warnings);
}

const runtime = createGhostRuntimeFromPreset(nanikaPreset, {
  replaceRules: selectedFeatureSetIds.length > 0
    ? featureSetRules.rules
    : createRuntimeRulesFromMappings(savedMappings),
});

runtime.mount(document.querySelector("#nanika")!);`;
}

function updateSnippetPreview() {
  const selectedFeatureSetIds = getSelectedSnippetFeatureSetIds();
  mappingSnippetPreview.textContent = createSnippet(savedMappings, savedFeatureSets, selectedFeatureSetIds);
  mappingMermaidPreview.textContent = createMappingsMermaid(getMermaidMappings(), savedMappings, "reference");

  if (savedFeatureSets.length === 0) {
    mappingSnippetHelp.textContent = "저장된 기능 묶음이 없어서 저장된 연결 전체를 실행 규칙으로 생성합니다.";
    return;
  }

  if (selectedFeatureSetIds.length === 0) {
    mappingSnippetHelp.textContent = "선택한 기능 묶음이 없어서 저장된 연결 전체를 실행 규칙으로 생성합니다.";
    return;
  }

  mappingSnippetHelp.textContent = `${selectedFeatureSetIds.length}개 기능 묶음을 기준으로 실행 규칙을 생성합니다. 선택하지 않은 묶음과 묶음 밖 저장 연결은 적용 코드에 포함되지 않습니다.`;
}

function renderSnippetFeatureSetPicker() {
  syncSelectedSnippetFeatureSetIds();

  if (savedFeatureSets.length === 0) {
    snippetFeatureSetPicker.replaceChildren(createCard("적용할 기능 묶음 없음", "기능 묶음 탭에서 저장된 연결을 묶음으로 묶으면 여기에서 적용 대상을 고를 수 있습니다."));
    updateSnippetPreview();
    return;
  }

  snippetFeatureSetPicker.replaceChildren(...savedFeatureSets.map((featureSet) => {
    const label = document.createElement("label");
    label.className = "nanika-feature-set-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = featureSet.id;
    checkbox.checked = selectedSnippetFeatureSetIds.has(featureSet.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedSnippetFeatureSetIds.add(featureSet.id);
      } else {
        selectedSnippetFeatureSetIds.delete(featureSet.id);
      }

      updateSnippetPreview();
    });

    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = `${featureSet.name ?? featureSet.id} (${featureSet.mappingIds.length}개 연결)`;

    const description = document.createElement("small");
    description.textContent = getFeatureSetStatusText(featureSet);

    text.append(title, description);

    label.append(checkbox, text);
    return label;
  }));
  updateSnippetPreview();
}

function renderSavedMappings(savedPath?: string) {
  renderSnippetFeatureSetPicker();
  renderFeatureSetMappingPicker();
  renderFlowBoard(savedFlowBoard, createMappingFlowBoardColumns(savedMappings, savedFeatureSets));

  if (savedMappings.length === 0) {
    savedMappingList.replaceChildren(createCard("저장된 연결 없음", "아직 저장된 기능 연결이 없습니다."));
    savedMappingStatus.textContent = savedPath
      ? `${savedPath}에 저장된 기능 연결이 없습니다.`
      : "저장된 기능 연결이 없습니다.";
    return;
  }

  const groups = new Map<string, NanikaMapping[]>();
  savedMappings.forEach((mapping) => {
    const key = mapping.event;
    groups.set(key, [...(groups.get(key) ?? []), mapping]);
  });

  savedMappingList.replaceChildren(...Array.from(groups.entries()).map(([eventName, mappings]) => {
    const details = document.createElement("details");
    details.className = "nanika-saved-group";
    details.open = mappings.some((mapping) => registry.mappings.some((rule) => rule.id === mapping.id));

    const summary = document.createElement("summary");
    summary.textContent = `${getReadableEventLabel(eventName)} · ${mappings.length}개 연결`;

    const body = document.createElement("div");
    body.className = "nanika-saved-group-body";

    body.replaceChildren(...mappings.map((mapping) => {
    const applied = registry.mappings.some((rule) => rule.id === mapping.id);
    const card = createCard(
      mapping.name ?? mapping.id,
      `${mapping.event} 이벤트에서 ${mapping.actions.length}개 액션을 실행합니다.`,
      [
        `id: ${mapping.id}`,
        applied ? "현재 preset 적용됨" : "저장됨 / 미적용",
        mapping.target?.label ? `대상: ${mapping.target.label}` : "대상 미지정",
        ...mapping.actions.map(formatAction),
      ],
    );
    card.append(createMappingFlow(mapping));
    const controls = document.createElement("div");
    controls.className = "asset-lab-button-row";
    controls.append(
      createActionButton("편집기에서 보기", () => selectMappingInEditor(mapping, "saved")),
      createActionButton("불러오기", () => loadMappingIntoDraft(mapping)),
      createActionButton("연결 삭제", () => deleteSavedMapping(mapping.id)),
    );
    card.append(controls);

    return card;
    }));

    details.append(summary, body);

    return details;
  }));
  savedMappingStatus.textContent = savedPath
    ? `${savedPath}에서 ${savedMappings.length}개 기능 연결을 불러왔어요.`
    : `${savedMappings.length}개 기능 연결을 불러왔어요.`;
  savedMappingStatus.dataset.state = "ready";
}

function renderFeatureSetMappingPicker() {
  if (savedMappings.length === 0) {
    featureSetMappingPicker.replaceChildren(createCard("저장된 연결 없음", "먼저 저장된 기능 연결을 만들어야 묶음으로 묶을 수 있습니다."));
    renderFeatureSetDraftPreview();
    return;
  }

  featureSetMappingPicker.replaceChildren(...savedMappings.map((mapping) => {
    const label = document.createElement("label");
    label.className = "nanika-feature-set-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = mapping.id;
    checkbox.addEventListener("change", renderFeatureSetDraftPreview);

    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = mapping.name ?? mapping.id;

    const description = document.createElement("small");
    description.textContent = `${getReadableEventLabel(mapping.event)} → ${mapping.actions.length}개 액션`;

    text.append(title, description);
    label.append(checkbox, text);
    return label;
  }));
  renderFeatureSetDraftPreview();
}

function getSelectedFeatureSetMappingIds() {
  return Array.from(featureSetMappingPicker.querySelectorAll<HTMLInputElement>("input[type='checkbox']:checked"))
    .map((input) => input.value);
}

function renderFeatureSetDraftPreview() {
  const selectedIds = getSelectedFeatureSetMappingIds();

  if (selectedIds.length === 0) {
    featureSetPreview.replaceChildren(createCard(
      "묶음 미리보기 없음",
      "저장된 연결을 선택하면 이 묶음이 어떤 이벤트 줄기를 포함하는지 먼저 보여줍니다.",
    ));
    return;
  }

  const previewSet: NanikaFeatureSet = {
    id: featureSetIdInput.value.trim() || "new.feature-set",
    name: featureSetNameInput.value.trim() || "새 기능 묶음",
    mode: "character-specific",
    mappingIds: selectedIds,
  };
  const card = createCard(previewSet.name ?? previewSet.id, `${selectedIds.length}개 연결을 포함할 예정입니다.`, selectedIds);
  card.append(createFeatureSetFlow(previewSet));
  featureSetPreview.replaceChildren(card);
  if (activeView === "feature-sets" && editorSelection.type === "feature-set") {
    selectFeatureSetInEditor(previewSet, false);
  }
}

function renderFeatureSets(savedPath?: string) {
  renderSnippetFeatureSetPicker();
  const displayFeatureSets = getFeatureSetsForDisplay();
  renderFlowBoard(featureSetFlowBoard, createMappingFlowBoardColumns(savedMappings, displayFeatureSets));
  renderMappingGraph();
  const featureSetMappingIds = new Set(displayFeatureSets.flatMap((featureSet) => featureSet.mappingIds));
  const mappingsOutsideFeatureSets = savedMappings.filter((mapping) => !featureSetMappingIds.has(mapping.id));

  if (displayFeatureSets.length === 0) {
    featureSetList.replaceChildren(createCard("저장된 기능 묶음 없음", "저장된 기능 연결을 골라 하나의 묶음으로 묶어보세요."));
    featureSetStatus.textContent = savedPath
      ? `${savedPath}에 저장된 기능 묶음이 없습니다.`
      : "저장된 기능 묶음이 없습니다.";
    return;
  }

  featureSetList.replaceChildren(
    createCard("묶음 적용 범위", `${featureSetMappingIds.size}개 저장 연결이 기능 묶음에 포함되어 있습니다.`, [
      `묶음 밖 저장 연결 ${mappingsOutsideFeatureSets.length}`,
      ...mappingsOutsideFeatureSets.map((mapping) => mapping.name ?? mapping.id),
    ]),
    ...displayFeatureSets.map((featureSet) => {
    const missingMappingIds = featureSet.mappingIds.filter((mappingId) => !savedMappings.some((mapping) => mapping.id === mappingId));
    const compatibility = checkFeatureSetCompatibility(featureSet);
    const card = createCard(
      featureSet.name ?? featureSet.id,
      `${featureSet.mappingIds.length}개 기능 연결을 포함합니다. ${getFeatureSetStatusText(featureSet)}`,
      [
        `id: ${featureSet.id}`,
        featureSet.mode === "character-template" ? "캐릭터 미지정 템플릿" : "캐릭터 전용 묶음",
        `호환 상태: ${compatibility.status === "ready" ? "사용 가능" : compatibility.status === "partial" ? "일부 사용 불가" : "사용 불가"}`,
        ...featureSet.mappingIds.map((mappingId) => `연결: ${mappingId}`),
        ...(missingMappingIds.length > 0 ? [`누락 연결 ${missingMappingIds.length}`] : []),
        ...compatibility.missing.slice(0, 4).map((missing) => `누락 재료: ${missing}`),
      ],
    );
    card.append(createFeatureSetFlow(featureSet));
    const controls = document.createElement("div");
    controls.className = "asset-lab-button-row";
    controls.append(
      createActionButton("편집기에서 보기", () => selectFeatureSetInEditor(featureSet)),
      createActionButton("불러오기", () => loadFeatureSetIntoForm(featureSet)),
      createActionButton("삭제", () => deleteFeatureSet(featureSet.id)),
    );
    card.append(controls);

    return card;
  }));
  featureSetStatus.textContent = savedPath
    ? `${savedPath}에서 ${displayFeatureSets.length}개 기능 묶음을 불러왔어요.`
    : `${displayFeatureSets.length}개 기능 묶음을 불러왔어요.`;
  featureSetStatus.dataset.state = "ready";
}

function loadFeatureSetIntoForm(featureSet: NanikaFeatureSet) {
  featureSetIdInput.value = featureSet.id;
  featureSetNameInput.value = featureSet.name ?? featureSet.id;
  renderFeatureSetMappingPicker();
  featureSet.mappingIds.forEach((mappingId) => {
    const checkbox = featureSetMappingPicker.querySelector<HTMLInputElement>(`input[value="${CSS.escape(mappingId)}"]`);
    if (checkbox) {
      checkbox.checked = true;
    }
  });
  renderFeatureSetDraftPreview();
  selectFeatureSetInEditor(featureSet);
  featureSetStatus.textContent = `${featureSet.id} 기능 묶음을 편집 폼으로 불러왔어요.`;
  featureSetStatus.dataset.state = "ready";
}

function addSelectedEditorMappingToFeatureSet() {
  if (editorSelection.type !== "mapping" || editorSelection.source !== "saved") {
    return;
  }

  const mappingId = editorSelection.mapping.id;
  setActiveView("feature-sets");
  const checkbox = featureSetMappingPicker.querySelector<HTMLInputElement>(`input[value="${CSS.escape(mappingId)}"]`);

  if (!checkbox) {
    featureSetStatus.textContent = `${mappingId} 연결을 기능 묶음 선택 목록에서 찾지 못했어요.`;
    featureSetStatus.dataset.state = "warning";
    revealEditorPanel();
    return;
  }

  checkbox.checked = true;
  renderFeatureSetDraftPreview();
  featureSetStatus.textContent = `${mappingId} 연결을 새 기능 묶음 후보에 추가했어요.`;
  featureSetStatus.dataset.state = "ready";
  revealEditorPanel();
}

async function saveMappingFromEditorCanvas(mapping: NanikaMapping) {
  const nextMapping = createMappingFromCanvasState(mapping);

  if (nextMapping.actions.length === 0) {
    savedMappingStatus.textContent = "모든 액션을 제거한 연결은 저장할 수 없어요. 연결 자체를 삭제해 주세요.";
    savedMappingStatus.dataset.state = "warning";
    return;
  }

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-mapping"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping: nextMapping }),
    });
    const result = await readApiJson<NanikaMappingsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "작업판 변경을 mapping에 저장하지 못했어요.");
    }

    savedMappings = result.mappings ?? [];
    savedMappingsLoaded = true;
    saveCanvasStatesToStorage();
    renderSavedMappings(result.path);
    renderFeatureSets();
    refreshOverview();
    selectMappingInEditor(nextMapping, "saved", false);
    savedMappingStatus.textContent = `${nextMapping.id} 연결 변경을 저장했어요.`;
    savedMappingStatus.dataset.state = "ready";
  } catch (error) {
    savedMappingStatus.textContent = error instanceof Error ? error.message : "작업판 변경을 mapping에 저장하지 못했어요.";
    savedMappingStatus.dataset.state = "warning";
  }
}

async function saveEditorCanvasState() {
  if (!currentEditorGraph || !currentEditorGraphKey) {
    return;
  }

  if (editorSelection.type === "mapping" && editorSelection.source === "saved") {
    await saveMappingFromEditorCanvas(editorSelection.mapping as NanikaMapping);
    return;
  }

  saveCanvasStatesToStorage();
  mappingEditorDetail.replaceChildren(createEditorSummary(
    "작업판 저장 완료",
    "현재 다이어그램의 카드 위치, 삭제한 카드, 직접 추가한 카드와 연결을 이 브라우저에 저장했습니다.",
    [currentEditorGraphKey],
  ));
}

function runEditorSave() {
  if (editorSelection.type === "draft") {
    void saveDraftMapping();
    return;
  }

  if (editorSelection.type === "feature-set" || activeView === "feature-sets") {
    void saveFeatureSet();
    return;
  }

  void saveEditorCanvasState();
}

function createEditorGraphDraftJson() {
  return JSON.stringify({
    key: currentEditorGraphKey,
    graph: currentEditorGraph,
    state: canvasStateByKey.get(currentEditorGraphKey) ?? null,
    note: "이 JSON은 devtools 편집 캔버스 상태입니다. 실행 규칙 저장 반영은 후속 단계에서 연결합니다.",
  }, null, 2);
}

function initDraftBuilder() {
  initMappingGraphControls();
  initTargetOptions();
  draftMappingIdInput.addEventListener("input", renderDraftPreview);
  draftMappingNameInput.addEventListener("input", renderDraftPreview);
  draftTargetSelect.addEventListener("change", renderDraftPreview);
  addSelectedActionButton.addEventListener("click", addSelectedActionToFlow);
  wrapSequenceButton.addEventListener("click", () => wrapCurrentActionFlow("run_sequence"));
  wrapParallelButton.addEventListener("click", () => wrapCurrentActionFlow("run_parallel"));
  wrapRandomButton.addEventListener("click", () => wrapCurrentActionFlow("run_random"));
  saveDraftMappingButton.addEventListener("click", () => {
    void saveDraftMapping();
  });
  copyDraftMappingButton.addEventListener("click", async () => {
    renderDraftPreview();
    await copyText(JSON.stringify(lastDraftResult.mapping, null, 2), draftMappingStatus, "매핑 JSON을 복사했어요.");
  });
  copyRuntimeRuleButton.addEventListener("click", async () => {
    renderDraftPreview();
    await copyText(JSON.stringify(lastDraftResult.runtimeRule, null, 2), draftMappingStatus, "실행 규칙 JSON을 복사했어요.");
  });
  copyMappingSnippetButton.addEventListener("click", async () => {
    await copyText(mappingSnippetPreview.textContent ?? "", savedMappingStatus, "적용 코드를 복사했어요.");
  });
  copyMermaidButton.addEventListener("click", async () => {
    await copyText(mappingMermaidPreview.textContent ?? "", savedMappingStatus, "Mermaid 코드를 복사했어요.");
  });
  editorLoadDraftButton.addEventListener("click", () => {
    if (editorSelection.type !== "mapping") {
      return;
    }

    const mapping = editorSelection.mapping;
    setActiveView("create");
    loadMappingIntoDraft(mapping as NanikaMapping);
    selectEditorDraft();
  });
  editorAddToFeatureSetButton.addEventListener("click", addSelectedEditorMappingToFeatureSet);
  editorSaveButton.addEventListener("click", runEditorSave);
  editorZoomOutButton.addEventListener("click", () => {
    editorCanvasZoom = Math.max(0.55, Math.round((editorCanvasZoom - 0.1) * 10) / 10);
    renderEditorCanvas();
  });
  editorZoomInButton.addEventListener("click", () => {
    editorCanvasZoom = Math.min(1.6, Math.round((editorCanvasZoom + 0.1) * 10) / 10);
    renderEditorCanvas();
  });
  editorZoomResetButton.addEventListener("click", () => {
    editorCanvasZoom = 1;
    renderEditorCanvas();
  });
  editorCopyGraphButton.addEventListener("click", async () => {
    if (!currentEditorGraph) {
      return;
    }

    await copyText(createEditorGraphDraftJson(), savedMappingStatus, "편집 캔버스 상태를 복사했어요.");
  });
  refreshSavedMappingsButton.addEventListener("click", () => {
    void loadSavedMappings();
  });
  saveFeatureSetButton.addEventListener("click", () => {
    void saveFeatureSet();
  });
  featureSetIdInput.addEventListener("input", renderFeatureSetDraftPreview);
  featureSetNameInput.addEventListener("input", renderFeatureSetDraftPreview);
  refreshFeatureSetsButton.addEventListener("click", () => {
    void loadFeatureSets();
  });

  renderStepBuilder();
  renderFeatureSetMappingPicker();
  renderFeatureSets();
}

function renderSummary() {
  const rules = getConfiguredMappings();
  const capabilities = registry.capabilities;
  const savedStatus = getSavedMappingStatus();

  summary.replaceChildren(
    createCard("프리셋", registry.preset.name, [
      `id: ${registry.preset.id}`,
      `적용된 실행 규칙: ${rules.length}`,
      `플러그인: ${registry.plugins.length}`,
      `연결 가능한 기능: ${capabilities.length}`,
    ]),
    createCard("캐릭터", registry.character.name, [
      `id: ${registry.character.id}`,
      `기본 표정: ${registry.character.defaultExpression}`,
    ]),
    createCard("저장 / 적용 상태", "저장된 연결과 현재 preset에 실제 적용된 실행 규칙을 구분합니다.", [
      `저장됨 ${savedMappings.length}`,
      `적용됨 ${rules.length}`,
      `기능 묶음 ${savedFeatureSets.length}`,
      `저장+적용 ${savedStatus.savedAndApplied.length}`,
      `저장만 됨 ${savedStatus.savedOnly.length}`,
      `적용만 됨 ${savedStatus.appliedOnly.length}`,
    ]),
  );
}

function renderConnectionMap() {
  const { character, capabilities } = registry;
  const mappings = getConfiguredMappings();
  const mappedEventNames = new Set(mappings.map((rule) => rule.event));
  const coverage = {
    unmappedEvents: registry.events.filter((event) => !mappedEventNames.has(event.event)),
  };
  const savedStatus = getSavedMappingStatus();
  const characterEvents = mappings.filter((rule) => getEventScope(rule.event) === "character");
  const speechActions = mappings.flatMap((rule) => rule.actions).filter((action) => {
    const catalogItem = registry.actions.find((item) => item.type === action.type);

    return catalogItem?.category === "speech";
  });
  const pluginActionTypes = new Set(mappings.flatMap((rule) => rule.actions).map((action) => {
    const record = action as Record<string, unknown>;

    return action.type === "call_plugin" ? String(record.pluginId ?? action.type) : action.type;
  }));
  const connectedCapabilities = capabilities.filter((capability) => {
    const record = capability.action as Record<string, unknown>;

    return pluginActionTypes.has(String(record.pluginId ?? capability.action.type));
  });

  connectionMap.replaceChildren(
    createCard("나니카 실행", `${mappings.length}개 실행 규칙이 현재 프리셋에 적용되어 있습니다.`, [
      `이벤트 ${registry.events.length}`,
      `동작 ${registry.actions.length}`,
      `미연결 이벤트 ${coverage.unmappedEvents.length}`,
    ]),
    createCard(`Character: ${character.id}`, `${character.name} 캐릭터가 현재 프리셋의 표시 대상입니다.`, [
      `캐릭터 이벤트 연결 ${characterEvents.length}`,
      `surface ${character.surfaceCount}`,
      `scene ${character.sceneCount}`,
      `hit area ${character.hitAreaCount}`,
    ]),
    createCard("Speech / Balloon", `${speechActions.length}개 대사 동작이 실행 규칙에서 사용 중입니다.`, [
      `대사 동작 ${speechActions.length}`,
      "말풍선은 runtime 설정에서 표시",
    ]),
    createCard("Plugin / 기능", `${connectedCapabilities.length}개 기능이 실행 규칙에서 호출됩니다.`, [
      `연결 가능 ${capabilities.length}`,
      `연결됨 ${connectedCapabilities.length}`,
      `미연결 ${Math.max(0, capabilities.length - connectedCapabilities.length)}`,
    ]),
    createCard("Saved / Applied", `${savedStatus.savedOnly.length}개 저장 연결은 아직 현재 preset에 적용되지 않았습니다.`, [
      `저장만 됨 ${savedStatus.savedOnly.length}`,
      `적용만 됨 ${savedStatus.appliedOnly.length}`,
      `중복 저장 ${savedStatus.duplicateSavedIds.length}`,
    ]),
    createCard("기능 묶음", `${savedFeatureSets.length}개 기능 묶음이 저장되어 있습니다.`, [
      `묶음 ${savedFeatureSets.length}`,
      `포함 연결 ${savedFeatureSets.reduce((count, featureSet) => count + featureSet.mappingIds.length, 0)}`,
      "runtime 자동 적용은 후속 단계",
    ]),
  );
}

function renderCoverage() {
  const mappings = getConfiguredMappings();
  const mappedEventNames = new Set(mappings.map((rule) => rule.event));
  const actionUsage = collectActionUsage(mappings.flatMap((rule) => rule.actions));
  const coverage = {
    mappedEvents: registry.events.filter((event) => mappedEventNames.has(event.event)),
    unmappedEvents: registry.events.filter((event) => !mappedEventNames.has(event.event)),
    mappedActions: registry.actions.filter((action) => actionUsage.has(`action:${action.type}`)),
    unmappedActions: registry.actions.filter((action) => !actionUsage.has(`action:${action.type}`)),
  };
  const savedStatus = getSavedMappingStatus();

  mappingCoverage.replaceChildren(
    createCard("연결된 이벤트", `${coverage.mappedEvents.length}개 이벤트가 실행 규칙의 시작점으로 사용 중입니다.`, coverage.mappedEvents.map((event) => event.event)),
    createCard("미연결 이벤트", `${coverage.unmappedEvents.length}개 이벤트는 아직 실행 규칙에 연결되지 않았습니다.`, coverage.unmappedEvents.map((event) => event.event)),
    createCard("사용 중인 동작", `${coverage.mappedActions.length}개 동작 타입이 현재 실행 규칙에서 사용됩니다.`, coverage.mappedActions.map((action) => getReadableActionLabel(action.type))),
    createCard("미사용 동작", `${coverage.unmappedActions.length}개 동작 타입은 아직 연결되지 않았습니다.`, coverage.unmappedActions.map((action) => getReadableActionLabel(action.type))),
    createCard("저장됐지만 미적용", `${savedStatus.savedOnly.length}개 연결은 저장되어 있지만 현재 preset에는 들어가 있지 않습니다.`, savedStatus.savedOnly.map((mapping) => mapping.name ?? mapping.id)),
    createCard("적용됐지만 저장 목록 없음", `${savedStatus.appliedOnly.length}개 실행 규칙은 현재 preset에만 있고 저장 목록에는 없습니다.`, savedStatus.appliedOnly.map((rule) => rule.id)),
  );
}

function renderCharacter() {
  const { character } = registry;
  const resources = registry.characterResources;
  const characterCard = createCard(character.name, character.description, [
    `expressions: ${character.expressionCount}`,
    `surfaces: ${character.surfaceCount}`,
    `scenes: ${character.sceneCount}`,
    `hitAreas: ${character.hitAreaCount}`,
  ]);
  const controls = document.createElement("div");
  controls.className = "asset-lab-button-row";
  controls.append(createActionButton("다이어그램 보기", () => selectCharacterInEditor(true, true)));
  characterCard.append(controls);

  characterList.replaceChildren(
    characterCard,
    createPaletteCard("표정 이미지", "change_expression 액션에서 선택할 수 있는 표정 리소스입니다.", formatResourceOptions(resources.expressions)),
    createPaletteCard("캐릭터 상태", "캐릭터의 기본 표시 상태로 사용할 수 있는 재료입니다.", formatResourceOptions(resources.surfaces)),
    createPaletteCard("무대", "이미지 그룹을 한 장처럼 사용할 수 있는 재료입니다.", formatResourceOptions(resources.scenes)),
    createPaletteCard("파츠 움직임", "입모양, 눈깜빡임처럼 캐릭터 상태 위에서 움직일 수 있는 재료입니다.", formatResourceOptions(resources.layers)),
    createPaletteCard("대사 묶음", "speak 액션에서 사용할 수 있는 대사 카테고리입니다.", formatResourceOptions(resources.dialogueCategories)),
    createPaletteCard("터치 영역", "set_touched_part나 터치 이벤트와 연결할 수 있는 영역입니다.", formatResourceOptions(resources.touchParts)),
  );
}

function renderCapabilities() {
  const { capabilities } = registry;

  if (capabilities.length === 0) {
    capabilityList.replaceChildren(createCard("연결된 기능 없음", "현재 preset에서 확인할 수 있는 plugin capability가 없습니다."));
    return;
  }

  capabilityList.replaceChildren(...capabilities.map((capability) => createPaletteCard(
    capability.name,
    capability.description ?? "설명이 없는 기능입니다.",
    [`id: ${capability.id}`, capability.action.type],
  )));
}

function renderEvents() {
  eventList.replaceChildren(...registry.events.map((event) => createPaletteCard(
    getReadableEventLabel(event.event),
    event.description,
    [
      event.event,
      ...formatPayloadFields(event),
      ...formatRequiredControls(event),
    ],
  )));
}

function renderActions() {
  actionList.replaceChildren(...registry.actions.map((action) => createPaletteCard(
    getReadableActionLabel(action.type),
    action.description,
    [
      action.type,
      `category: ${action.category}`,
      ...formatRequiredControls(action),
    ],
  )));
}

function renderMappings() {
  const rules = getConfiguredMappings();

  if (rules.length === 0) {
    mappingList.replaceChildren(createCard("매핑 없음", "현재 preset에 등록된 rule이 없습니다."));
    return;
  }

  mappingList.replaceChildren(...rules.map((rule) => createCard(
    rule.id,
    `${rule.event} 이벤트에서 ${rule.actions.length}개 액션을 실행합니다.`,
    [
      `event: ${rule.event}`,
      ...rule.actions.map(formatAction),
    ],
  )).map((card, index) => {
    const rule = rules[index];
    if (rule) {
      card.append(createMappingFlow(rule as NanikaMapping));
      const controls = document.createElement("div");
      controls.className = "asset-lab-button-row";
      controls.append(createActionButton("다이어그램 보기", () => selectMappingInEditor(rule, "applied", true, true)));
      card.append(controls);
    }

    return card;
  }));
}

loadCanvasStatesFromStorage();
initViewNavigation();
initDraftBuilder();
renderCharacter();
renderCapabilities();
renderEvents();
renderActions();
refreshOverview();
void loadSavedMappings();
void loadFeatureSets();
