import {
  createNanikaMappingRegistry,
  createRuntimeRuleFromMapping,
  defaultNanikaCommonKeys,
} from "../plugins/nanikaMapping/index.js";
import { nanikaPreset } from "../ghost/preset.js";
import {
  createDemoDeveloperMenuItems,
  createDemoManagementMenuItems,
  createDemoUserMenuItems,
} from "../demo/demoManagementMenu.js";
import {
  createDevtoolsApiPath,
  fetchCharacterAssets,
  fetchCharacterList,
  readApiJson,
  type CharacterAssetsResponse,
  type DevApiResponse,
} from "./assetApi.js";
import { requireElement } from "./assetShared.js";
import type { RuntimeAction, RuntimeCondition, RuntimeControlOptions, RuntimeEventName, RuntimeRule } from "../core/types.js";
import type {
  NanikaMapping,
  NanikaFeatureSet,
  CharacterResourceCatalog,
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

type NanikaCondition = {
  id: string;
  scope: "runtime" | "character";
  type: "url" | "pageId";
  operator?: "contains" | "startsWith" | "equals" | "pattern";
  value: string;
  name?: string;
  description?: string;
};

type NanikaConditionsResponse = DevApiResponse & {
  conditions?: NanikaCondition[];
  condition?: NanikaCondition;
  deletedId?: string;
  path?: string;
};

type DraftMappingResult = {
  mapping: NanikaMapping | null;
  runtimeRule: RuntimeRule | null;
  warnings: string[];
  errors: string[];
};

type MappingSaveIssueSeverity = "error" | "warning";

type MappingSaveIssue = {
  severity: MappingSaveIssueSeverity;
  message: string;
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
  | "condition"
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
  | "condition"
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

type PaletteCategoryId = "characters" | "conditions" | "saved" | "events" | "actions" | "feature-sets" | "resources";

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

type ActionResourceReference = {
  resourceKind: NanikaResourceKind;
  id: string;
  parameterName: string;
};

type ActionUsageDetail = {
  mappingId: string;
  mappingName: string;
  event: string;
  actionType: string;
  actionLabel: string;
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
const editorCanvasMinWidth = 1680;
const editorCanvasMinHeight = 1040;
const editorCanvasNodeWidth = 184;
const editorCanvasNodeHeight = 100;
const editorCanvasPaddingX = 420;
const editorCanvasPaddingY = 320;
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

const internalManagementMenuPresets = [
  {
    id: "demo.default",
    title: "기본 관리 메뉴",
    description: "대사, 플러그인, UI, 캐릭터 테스트 메뉴를 모두 포함합니다.",
    createItems: () => createDemoManagementMenuItems(),
  },
  {
    id: "demo.user",
    title: "사용자 메뉴",
    description: "개발자 도구 없이 사용자에게 보여줄 수 있는 기본 메뉴입니다.",
    createItems: () => createDemoUserMenuItems(),
  },
  {
    id: "demo.developer",
    title: "개발자 메뉴",
    description: "개발 중 진단과 설정 확인에 쓰는 메뉴입니다.",
    createItems: () => createDemoDeveloperMenuItems(),
  },
];

type InternalManagementMenuPreset = (typeof internalManagementMenuPresets)[number];

function getInternalManagementMenuPreset(presetId: string | null | undefined): InternalManagementMenuPreset {
  return internalManagementMenuPresets.find((preset) => preset.id === presetId) ?? internalManagementMenuPresets[0]!;
}

function getCanvasNodeManagementMenuPresetId(node: CanvasNode) {
  const metaPreset = node.meta
    ?.find((item) => item.startsWith("menu preset: "))
    ?.slice("menu preset: ".length);

  if (metaPreset) {
    return metaPreset;
  }

  const sourceId = node.sourceId ?? "";
  const presetSuffix = sourceId.startsWith("open_management_menu:")
    ? sourceId.slice("open_management_menu:".length)
    : null;
  return presetSuffix ? `demo.${presetSuffix}` : null;
}

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

function createRuntimeConditionPaletteItems(): PaletteItem[] {
  return runtimeProfileOverviewCards.map((profile) => ({
    id: `runtime-condition:${profile.id}`,
    kind: "condition",
    title: `${profile.name} 런타임 조건`,
    description: `${profile.match} 조건에서 이 런타임 프로필을 사용합니다.`,
    meta: [
      "scope: runtime",
      "붙이는 곳: 런타임 또는 이벤트 앞",
      profile.id,
      profile.match,
      `character: ${profile.characterId}`,
      ...profile.initial,
    ],
  }));
}

function createCharacterConditionPaletteItems(): PaletteItem[] {
  return runtimeProfileOverviewCards.map((profile) => ({
    id: `character-condition:${profile.id}`,
    kind: "condition",
    title: `${profile.name} 캐릭터 조건`,
    description: `${profile.characterId} 캐릭터가 ${profile.match} 조건에서 쓸 시작 상태와 기능 묶음입니다.`,
    meta: [
      "scope: character",
      "붙이는 곳: 캐릭터 또는 이벤트 앞",
      profile.id,
      profile.match,
      ...profile.initial,
      ...profile.featureSetIds.map((featureSetId) => `feature set: ${featureSetId}`),
    ],
  }));
}

function createSavedConditionPaletteItems(): PaletteItem[] {
  return savedConditions.map((condition) => {
    const typeLabel = getReadableConditionTypeLabel(condition);
    const scopeLabel = condition.scope === "runtime" ? "런타임" : "캐릭터";

    return {
      id: `saved-condition:${condition.id}`,
      kind: "condition",
      title: condition.name ?? condition.id,
      description: condition.description || `${typeLabel}: ${condition.value}`,
      meta: [
        `scope: ${condition.scope}`,
        "붙이는 곳: 이벤트/연결 앞",
        condition.id,
        `${getConditionOperator(condition)} ${condition.type}: ${condition.value}`,
        `${scopeLabel} 조건`,
      ],
    };
  });
}

function getConditionScopeFromMeta(meta: readonly string[] = []) {
  const scopeMeta = meta.find((item) => item.startsWith("scope: "));

  return scopeMeta?.slice("scope: ".length) ?? "";
}

const runtimeStateOptions: ParameterOption[] = [
  { id: "idle", label: "대기 상태", description: "저장 키: idle" },
  { id: "speaking", label: "말하는 중", description: "저장 키: speaking" },
  { id: "thinking", label: "생각하는 중", description: "저장 키: thinking" },
  { id: "hidden", label: "숨김 상태", description: "저장 키: hidden" },
];

const maxActionFlowSteps = 8;
const mappingTargetSeparator = "::";
const unassignedCharacterId = "__unassigned";

function createMappingTargetValue(scope: string, id: string) {
  return `${scope}${mappingTargetSeparator}${id}`;
}

function createUniqueMappingCopyId(sourceId: string) {
  const existingIds = new Set([
    ...savedMappings.map((mapping) => mapping.id),
    ...registry.mappings.map((mapping) => mapping.id),
  ]);
  const baseId = `${sourceId}.copy`.replace(/[^a-zA-Z0-9_.:-]/g, ".");
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}.${index}`;
    index += 1;
  }

  return candidate.slice(0, 128);
}

function getKnownCharacterIds() {
  return Array.from(new Set([registry.character.id, ...availableCharacterIds])).filter(Boolean);
}

function getCanvasCharacterId(node: CanvasNode | undefined) {
  if (!node || node.kind !== "character") {
    return null;
  }

  const sourceId = getCanvasNodeSourceId(node);
  return sourceId || null;
}

function isUnassignedCharacterNode(node: CanvasNode | undefined) {
  return getCanvasCharacterId(node) === unassignedCharacterId;
}

function isCurrentRegistryCharacterNode(node: CanvasNode | undefined) {
  return getCanvasCharacterId(node) === registry.character.id;
}

function getActiveCanvasCharacterNode() {
  return currentEditorGraph?.nodes.find((node) => node.kind === "character" && !isUnassignedCharacterNode(node)) ?? null;
}

function hasLoadedCharacterResources(node: CanvasNode | undefined) {
  const characterId = getCanvasCharacterId(node);

  return Boolean(characterId && characterResourcesById.has(characterId));
}

function createEmptyCharacterResources(): CharacterResourceCatalog {
  return {
    expressions: [],
    surfaces: [],
    scenes: [],
    layers: [],
    dialogueCategories: [],
    touchParts: [],
  };
}

function createResourceOption(id: string, label = id, description = `저장 키: ${id}`): CharacterResourceCatalogOption {
  return { id, label, description };
}

function createCharacterResourcesFromAssets(result: CharacterAssetsResponse): CharacterResourceCatalog {
  const assets = result.assets ?? {};
  const surfaces = Object.entries(assets.surfaces ?? {});

  return {
    expressions: Object.keys(assets.expressions ?? {}).map((id) => createResourceOption(id)),
    surfaces: surfaces.map(([id, surface]) => createResourceOption(
      id,
      surface.alt ? `${id} - ${surface.alt}` : id,
      [
        surface.expression ? `표정 키: ${surface.expression}` : undefined,
        surface.visual?.type ? `기준 화면: ${surface.visual.type}` : undefined,
        surface.layers ? `파츠 ${Object.keys(surface.layers).length}개` : undefined,
      ].filter(Boolean).join(" / ") || `저장 키: ${id}`,
    )),
    scenes: Object.entries(assets.scenes ?? {}).map(([id, scene]) => createResourceOption(
      id,
      id,
      `저장 키: ${id} / 무대 요소 ${scene.layers.length}개`,
    )),
    layers: Array.from(new Map(surfaces.flatMap(([surfaceId, surface]) =>
      Object.entries(surface.layers ?? {}).map(([layerId, layer]) => {
        const layerRecord = layer && typeof layer === "object" ? layer as { frames?: unknown[]; image?: string; idleIntervalMs?: number } : {};
        return [layerId, createResourceOption(
          layerId,
          `${layerId} (${surfaceId})`,
          [
            `캐릭터 상태 ${surfaceId}`,
            Array.isArray(layerRecord.frames) ? `프레임 ${layerRecord.frames.length}개` : undefined,
            layerRecord.image ? "단일 이미지" : undefined,
            layerRecord.idleIntervalMs ? `대기 애니메이션 ${layerRecord.idleIntervalMs}ms` : undefined,
          ].filter(Boolean).join(" / ") || `저장 키: ${layerId}`,
        )] as const;
      }),
    )).values()),
    dialogueCategories: Object.entries(result.lines ?? {}).map(([id, lines]) => createResourceOption(
      id,
      id,
      `저장 키: ${id} / 대사 ${lines.length}개`,
    )),
    touchParts: Object.keys(assets.hitAreas ?? {}).map((id) => createResourceOption(id, id, `저장 키: ${id} / 터치 영역`)),
  };
}

function getActiveCharacterResources(): CharacterResourceCatalog {
  if (!activeCharacterResourceId) {
    return createEmptyCharacterResources();
  }

  return characterResourcesById.get(activeCharacterResourceId) ?? createEmptyCharacterResources();
}

async function activateCharacterResources(characterId: string) {
  if (characterId === unassignedCharacterId) {
    activeCharacterResourceId = null;
    renderEditorPalette();
    renderEditorCanvas();
    return;
  }

  activeCharacterResourceId = characterId;
  if (characterResourcesById.has(characterId)) {
    renderEditorPalette();
    renderEditorCanvas();
    return;
  }

  mappingEditorDetail.replaceChildren(createEditorSummary(
    "캐릭터 자원 불러오는 중",
    `${characterId} 캐릭터의 표정, 상태, 무대, 파츠, 대사 정보를 불러오고 있어요.`,
    [characterId],
  ));

  try {
    const result = await fetchCharacterAssets(characterId);
    characterResourcesById.set(characterId, createCharacterResourcesFromAssets(result));
    characterResourceLoadErrors.delete(characterId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "캐릭터 자원을 불러오지 못했어요.";
    characterResourceLoadErrors.set(characterId, message);
    mappingEditorDetail.replaceChildren(createEditorSummary(
      "캐릭터 자원 로드 실패",
      message,
      [characterId],
    ));
  }

  renderEditorPalette();
  renderEditorCanvas();
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
let draftParameterPrefill: Record<string, string> = {};
let draftQuickConnectionActive = false;
let savedMappings: NanikaMapping[] = [];
let savedMappingsLoaded = false;
let savedFeatureSets: NanikaFeatureSet[] = [];
let savedConditions: NanikaCondition[] = [];
let availableCharacterIds: string[] = [registry.character.id];
let activeCharacterResourceId: string | null = registry.character.id;
const characterResourcesById = new Map<string, CharacterResourceCatalog>([
  [registry.character.id, registry.characterResources],
]);
const characterResourceLoadErrors = new Map<string, string>();
let featureSetClonePreviewRequestId = 0;
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
const featureSetCloneSourceSelect = requireElement(document.querySelector<HTMLSelectElement>("#featureSetCloneSourceSelect"), "#featureSetCloneSourceSelect");
const featureSetCloneCharacterSelect = requireElement(document.querySelector<HTMLSelectElement>("#featureSetCloneCharacterSelect"), "#featureSetCloneCharacterSelect");
const featureSetCloneIdInput = requireElement(document.querySelector<HTMLInputElement>("#featureSetCloneIdInput"), "#featureSetCloneIdInput");
const featureSetCloneNameInput = requireElement(document.querySelector<HTMLInputElement>("#featureSetCloneNameInput"), "#featureSetCloneNameInput");
const saveFeatureSetCloneButton = requireElement(document.querySelector<HTMLButtonElement>("#saveFeatureSetCloneButton"), "#saveFeatureSetCloneButton");
const featureSetClonePreview = requireElement(document.querySelector<HTMLElement>("#featureSetClonePreview"), "#featureSetClonePreview");
const featureSetPreview = requireElement(document.querySelector<HTMLElement>("#featureSetPreview"), "#featureSetPreview");
const featureSetMappingPicker = requireElement(document.querySelector<HTMLElement>("#featureSetMappingPicker"), "#featureSetMappingPicker");
const featureSetFlowBoard = requireElement(document.querySelector<HTMLElement>("#featureSetFlowBoard"), "#featureSetFlowBoard");
const featureSetStatus = requireElement(document.querySelector<HTMLElement>("#featureSetStatus"), "#featureSetStatus");
const featureSetList = requireElement(document.querySelector<HTMLElement>("#featureSetList"), "#featureSetList");
const mappingPaletteTabs = requireElement(document.querySelector<HTMLElement>("#mappingPaletteTabs"), "#mappingPaletteTabs");
const mappingPaletteDeck = requireElement(document.querySelector<HTMLElement>("#mappingPaletteDeck"), "#mappingPaletteDeck");
const conditionIdInput = requireElement(document.querySelector<HTMLInputElement>("#conditionIdInput"), "#conditionIdInput");
const conditionNameInput = requireElement(document.querySelector<HTMLInputElement>("#conditionNameInput"), "#conditionNameInput");
const conditionScopeSelect = requireElement(document.querySelector<HTMLSelectElement>("#conditionScopeSelect"), "#conditionScopeSelect");
const conditionTypeSelect = requireElement(document.querySelector<HTMLSelectElement>("#conditionTypeSelect"), "#conditionTypeSelect");
const conditionOperatorSelect = requireElement(document.querySelector<HTMLSelectElement>("#conditionOperatorSelect"), "#conditionOperatorSelect");
const conditionValueInput = requireElement(document.querySelector<HTMLInputElement>("#conditionValueInput"), "#conditionValueInput");
const conditionDescriptionInput = requireElement(document.querySelector<HTMLInputElement>("#conditionDescriptionInput"), "#conditionDescriptionInput");
const saveConditionButton = requireElement(document.querySelector<HTMLButtonElement>("#saveConditionButton"), "#saveConditionButton");
const conditionList = requireElement(document.querySelector<HTMLElement>("#conditionList"), "#conditionList");
const conditionStatus = requireElement(document.querySelector<HTMLElement>("#conditionStatus"), "#conditionStatus");
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

function getReadableActionCategoryLabel(category: RuntimeActionCatalogCategory) {
  return actionCategoryOptions.find((option) => option.id === category)?.title ?? category;
}

function getConditionOperator(condition: Pick<NanikaCondition, "type" | "operator">) {
  if (condition.operator) {
    return condition.operator;
  }

  return condition.type === "url" ? "contains" : "equals";
}

function normalizeConditionOperator(value: string): NonNullable<NanikaCondition["operator"]> {
  return value === "startsWith" || value === "equals" || value === "pattern"
    ? value
    : "contains";
}

function getReadableConditionOperatorLabel(operator: NonNullable<NanikaCondition["operator"]>) {
  const labels: Record<NonNullable<NanikaCondition["operator"]>, string> = {
    contains: "포함",
    startsWith: "시작",
    equals: "일치",
    pattern: "패턴",
  };

  return labels[operator];
}

function getReadableConditionTypeLabel(condition: Pick<NanikaCondition, "type" | "operator">) {
  if (condition.type === "pageId") {
    return "페이지 코드 일치";
  }

  return `URL ${getReadableConditionOperatorLabel(getConditionOperator(condition))}`;
}

function formatRuntimeConditionValue(condition: RuntimeCondition) {
  if (condition.type === "page_id" || condition.type === "url") {
    return Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;
  }

  if (condition.type === "host_context") {
    return condition.key;
  }

  return "";
}

function getRuntimeConditionLabel(condition: RuntimeCondition) {
  if (condition.type === "page_id") {
    return "페이지 코드 조건";
  }

  if (condition.type === "url") {
    return `URL ${getReadableConditionOperatorLabel(condition.operator ?? "contains")} 조건`;
  }

  if (condition.type === "host_context") {
    return "호스트 상태 조건";
  }

  return condition.type;
}

function getConditionSaveIssues(conditions: readonly RuntimeCondition[]): MappingSaveIssue[] {
  return conditions
    .filter((condition) => {
      const value = formatRuntimeConditionValue(condition);
      return (condition.type === "page_id" || condition.type === "url" || condition.type === "host_context") && !value.trim();
    })
    .map((condition): MappingSaveIssue => ({
      severity: "error",
      message: `${getRuntimeConditionLabel(condition)}의 값이 비어 있습니다.`,
    }));
}

function getMappingSaveIssues(mapping: NanikaMapping | null, options: { requireTarget?: boolean } = {}): MappingSaveIssue[] {
  const issues: MappingSaveIssue[] = [];

  if (!mapping) {
    return [{ severity: "error", message: "저장할 연결 내용이 없습니다." }];
  }

  if (!mapping.id.trim()) {
    issues.push({ severity: "error", message: "연결 ID가 비어 있습니다." });
  }

  if (options.requireTarget && !mapping.target) {
    issues.push({ severity: "error", message: "연결 대상이 없습니다. 먼저 캐릭터나 런타임 대상을 선택하세요." });
  }

  if (!mapping.event) {
    issues.push({ severity: "error", message: "언제 실행할지 이벤트가 없습니다." });
  }

  if (mapping.actions.length === 0) {
    issues.push({ severity: "error", message: "실행할 액션이 없습니다." });
  }

  issues.push(...getConditionSaveIssues(mapping.conditions ?? []));

  return issues;
}

function getBlockingSaveIssueMessages(issues: readonly MappingSaveIssue[]) {
  return issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
}

function getWarningSaveIssueMessages(issues: readonly MappingSaveIssue[]) {
  return issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);
}

function createRuntimeConditionFromSavedCondition(condition: NanikaCondition): RuntimeCondition {
  if (condition.type === "pageId") {
    return {
      type: "page_id",
      value: condition.value,
    };
  }

  return {
    type: "url",
    operator: getConditionOperator(condition),
    value: condition.value,
  };
}

function findSavedConditionForCanvasNode(node: CanvasNode) {
  const sourceId = node.sourceId ?? "";
  const sourceConditionId = sourceId.startsWith("saved-condition:")
    ? sourceId.slice("saved-condition:".length)
    : null;
  const metaConditionId = node.meta?.find((item) => savedConditions.some((condition) => condition.id === item));
  const conditionId = sourceConditionId ?? metaConditionId;

  return conditionId ? savedConditions.find((condition) => condition.id === conditionId) : undefined;
}

function createRuntimeConditionFromCanvasNode(node: CanvasNode): RuntimeCondition | null {
  const savedCondition = findSavedConditionForCanvasNode(node);
  if (savedCondition) {
    return createRuntimeConditionFromSavedCondition(savedCondition);
  }

  const conditionText = [node.description, ...(node.meta ?? [])]
    .map((item) => item.trim())
    .find((item) => /^pageId\s*:/i.test(item) || /^page_id\s*:/i.test(item) || /^url(?:\s+\w+)?\s*:/i.test(item));

  if (!conditionText) {
    return null;
  }

  const pageIdMatch = conditionText.match(/^pageId\s*:\s*(.+)$/i);
  if (pageIdMatch?.[1]) {
    return {
      type: "page_id",
      value: pageIdMatch[1].trim(),
    };
  }

  const pageIdRuntimeMatch = conditionText.match(/^page_id\s*:\s*(.+)$/i);
  if (pageIdRuntimeMatch?.[1]) {
    return {
      type: "page_id",
      value: pageIdRuntimeMatch[1].trim(),
    };
  }

  const urlMatch = conditionText.match(/^url(?:\s+(contains|startsWith|equals|pattern))?\s*:\s*(.+)$/i);
  if (urlMatch?.[2]) {
    return {
      type: "url",
      operator: normalizeConditionOperator(urlMatch[1] ?? "contains"),
      value: urlMatch[2].trim(),
    };
  }

  return null;
}

function getSelectedTargetOption(): MappingTargetOption | undefined {
  return targetOptions.find((target) => createMappingTargetValue(target.scope, target.id) === draftTargetSelect.value);
}

function getParameterOptions(actionType: string, parameterName: string): ParameterOption[] {
  const characterResources = getActiveCharacterResources();

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

function resetDraftBuilder() {
  canvasStateByKey.delete("draft");
  if (currentEditorGraphKey === "draft") {
    currentEditorGraph = null;
    selectedCanvasNodeId = null;
    selectedCanvasNodeForPopover = null;
    pendingConnectionNodeId = null;
  }
  selectedScope = "runtime";
  selectedEvent = null;
  selectedActionCategory = null;
  selectedActionType = null;
  draftActionFlow = [];
  draftParameterPrefill = {};
  draftQuickConnectionActive = false;
  draftTargetSelect.value = "";
  draftMappingIdInput.value = "new.mapping";
  draftMappingNameInput.value = "Draft mapping";
  saveCanvasStatesToStorage();
  renderStepBuilder();
  renderDraftPreview();
}

function setEditorMode(view: MappingView, options: { resetDraft?: boolean } = {}) {
  activeView = view;
  viewSections.forEach((section) => {
    section.hidden = view === "create" || section.dataset.view !== view;
  });
  editorModeButtons.forEach((button) => {
    button.dataset.active = button.dataset.editorModeTarget === view ? "true" : "false";
  });

  if (view === "create") {
    emptyEditorTitle = "새 연결 만들기";
    emptyEditorDescription = "작업판을 비우고 새 연결 흐름을 준비합니다. 대상, 이벤트, 액션을 고르면 이 캔버스에 연결이 그려집니다.";
    emptyEditorMeta = ["새 연결"];
    if (options.resetDraft) {
      resetDraftBuilder();
    }
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
      setEditorMode(nextMode, { resetDraft: nextMode === "create" });
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

function appendEditorSaveGuide(title: string, description: string, meta: readonly string[] = []) {
  mappingEditorDetail.append(createEditorSummary(title, description, meta));
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

function sanitizeCanvasIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getResourceOptionsByKind(resourceKind: NanikaResourceKind): readonly ParameterOption[] {
  const resources = getActiveCharacterResources();

  if (resourceKind === "expression") {
    return resources.expressions;
  }

  if (resourceKind === "surface") {
    return resources.surfaces;
  }

  if (resourceKind === "scene") {
    return resources.scenes;
  }

  if (resourceKind === "layer") {
    return resources.layers;
  }

  if (resourceKind === "dialogue") {
    return resources.dialogueCategories;
  }

  return resources.touchParts;
}

function findResourceOption(resourceKind: NanikaResourceKind, id: string) {
  return getResourceOptionsByKind(resourceKind).find((option) => option.id === id) ?? null;
}

function createResourceReferenceNode(
  id: string,
  resourceKind: NanikaResourceKind,
  resourceId: string,
  x: number,
  y: number,
  meta: string[],
) {
  const option = findResourceOption(resourceKind, resourceId);
  const node = createCanvasNode(
    id,
    "resource",
    option?.label ?? resourceId,
    option?.description ?? resourceId,
    x,
    y,
    [`key: ${resourceId}`, ...meta],
    resourceKind,
  );
  node.sourceId = resourceId;

  return node;
}

function getActionResourceReferences(action: RuntimeAction): ActionResourceReference[] {
  const record = action as Record<string, unknown>;
  const references: ActionResourceReference[] = [];

  const addReference = (parameterName: string, resourceKind: NanikaResourceKind) => {
    const value = record[parameterName];

    if (typeof value === "string" && value.trim()) {
      references.push({
        resourceKind,
        id: value.trim(),
        parameterName,
      });
    }
  };

  if (action.type === "speak") {
    addReference("category", "dialogue");
  }

  if (action.type === "change_expression") {
    addReference("expression", "expression");
  }

  if (action.type === "surface") {
    addReference("id", "surface");
  }

  if (action.type === "scene" || action.type === "scene_overlay") {
    addReference("id", "scene");
  }

  if (action.type === "play_layer_animation") {
    addReference("layerId", "layer");
  }

  if (action.type === "set_touched_part") {
    addReference("part", "hitArea");
  }

  return references;
}

function attachActionResourceReferences(
  action: RuntimeAction,
  actionNodeId: string,
  graph: CanvasGraph,
  baseX: number,
  baseY: number,
) {
  getActionResourceReferences(action).forEach((reference, referenceIndex) => {
    const resourceNodeId = `${actionNodeId}:resource:${reference.resourceKind}:${sanitizeCanvasIdPart(reference.id)}`;

    if (!graph.nodes.some((node) => node.id === resourceNodeId)) {
      graph.nodes.push(createResourceReferenceNode(
        resourceNodeId,
        reference.resourceKind,
        reference.id,
        baseX,
        baseY + 112 + (referenceIndex * 104),
        [`param: ${reference.parameterName}`, "액션 참조"],
      ));
    }

    graph.edges.push({
      id: `${actionNodeId}->${resourceNodeId}`,
      from: actionNodeId,
      to: resourceNodeId,
      relation: "references",
      label: "참조",
    });
  });
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
  const actionMeta = [
    action.type,
    ...["category", "id", "pluginId", "command", "part", "area", "menuId", "text"]
      .map((key) => {
        const value = record[key];
        if (value === undefined || value === null || value === "") {
          return null;
        }

        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        return `${getReadableParameterLabel(key)}: ${serialized.slice(0, 80)}`;
      })
      .filter((item): item is string => Boolean(item)),
  ];

  graph.nodes.push(createCanvasNode(
    nodeId,
    kind,
    `${index + 1}. ${getReadableActionLabel(action.type)}`,
    nestedActions.length > 0 ? `${nestedActions.length}개 액션을 포함합니다.` : formatAction(action),
    baseX,
    baseY,
    actionMeta,
  ));
  graph.edges.push({
    id: `${parentId}->${nodeId}`,
    from: parentId,
    to: nodeId,
    relation: "executes",
  });
  attachActionResourceReferences(action, nodeId, graph, baseX, baseY);

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

function getRuntimeConditionDisplay(condition: RuntimeCondition, index: number) {
  if (condition.type === "page_id") {
    const value = Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;
    return {
      title: condition.negate ? "페이지 코드 제외" : "페이지 코드 조건",
      description: `${condition.negate ? "pageId가 다음 값이 아닐 때" : "pageId가 다음 값일 때"}: ${value}`,
      meta: [`page_id: ${value}`],
    };
  }

  if (condition.type === "url") {
    const value = Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;
    const operator = condition.operator ?? "contains";
    return {
      title: condition.negate ? "URL 제외 조건" : "URL 조건",
      description: `${condition.negate ? "URL이 조건에 맞지 않을 때" : "URL이 조건에 맞을 때"}: ${operator} ${value}`,
      meta: [`url ${operator}: ${value}`],
    };
  }

  if (condition.type === "host_context") {
    return {
      title: condition.negate ? "Host context 제외" : "Host context 조건",
      description: `${condition.key} 기준으로 host context를 확인합니다.`,
      meta: [`host: ${condition.key}`],
    };
  }

  return {
    title: `조건 ${index + 1}`,
    description: condition.type,
    meta: [condition.type],
  };
}

function createConditionCanvasNodes(graph: CanvasGraph, targetNodeId: string, conditions: readonly RuntimeCondition[]) {
  conditions.forEach((condition, index) => {
    const display = getRuntimeConditionDisplay(condition, index);
    const nodeId = `condition:${targetNodeId}:${index}`;
    graph.nodes.push(createCanvasNode(
      nodeId,
      "condition",
      display.title,
      display.description,
      260,
      216 + (index * 112),
      display.meta,
    ));
    graph.edges.push({
      id: `${nodeId}->${targetNodeId}`,
      from: nodeId,
      to: targetNodeId,
      relation: "executes",
      label: "조건",
    });
  });
}

function createMappingCanvasGraph(mapping: RuntimeRule | NanikaMapping, source: "applied" | "saved" | "draft" = "applied"): CanvasGraph {
  const mappingName = getDisplayMappingName(mapping);
  const targetId = "target";
  const eventId = "event";
  const mappingId = "mapping";
  const graph: CanvasGraph = {
    title: mappingName,
    description: `${getReadableEventLabel(mapping.event)} 이벤트에서 ${countNestedActions(mapping.actions)}개 액션을 실행합니다.`,
    nodes: [
      createCanvasNode(targetId, "target", getMappingTargetLabel(mapping), source === "saved" ? "저장된 연결 대상" : "실행 대상", 24, 96, [source]),
      createCanvasNode(eventId, "event", getReadableEventLabel(mapping.event), mapping.event, 260, 96, [`event: ${mapping.event}`]),
      createCanvasNode(mappingId, "mapping", mappingName, mapping.id, 496, 96, [`id: ${mapping.id}`, getMappingPortabilityLabel(mapping)]),
    ],
    edges: [
      { id: "target->event", from: targetId, to: eventId, relation: "executes" },
      { id: "event->mapping", from: eventId, to: mappingId, relation: "executes" },
    ],
  };

  let previousId = mappingId;
  createConditionCanvasNodes(graph, eventId, mapping.conditions ?? []);
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

function createDraftSetupCanvasGraph(): CanvasGraph {
  return {
    title: "새 연결 만들기",
    description: "런타임에서 사용할 캐릭터를 먼저 고른 뒤, 이벤트와 실행할 동작을 이어 붙입니다.",
    nodes: [
      createCanvasNode("runtime", "runtime", "Runtime", "나니카 실행 영역입니다.", 24, 96, ["start"]),
      createCanvasNode(
        "character-guide",
        "catalog",
        "캐릭터를 선택하세요",
        "오른쪽 카드덱의 캐릭터 탭에서 캐릭터 미정, 리네, 미야코 같은 캐릭터 컨텍스트를 먼저 고릅니다.",
        280,
        96,
        ["next: character"],
      ),
    ],
    edges: [
      { id: "runtime->character-guide", from: "runtime", to: "character-guide", relation: "references", label: "다음" },
    ],
  };
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
    const sourceParts = parts.slice(sourceIndex, -1);

    return sourceParts.length > 0 ? sourceParts.join(":") : parts[sourceIndex] ?? node.id;
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

const defaultDialogueCategoryByEvent: Partial<Record<RuntimeEventName, string>> = {
  "runtime:ready": "onMount",
  "character:click": "onClick",
  "character:idle": "onIdle",
  "character:randomPrompt": "onRandomPrompt",
  "command:line": "onLine",
};

function getNearestCanvasEventNameForAction(graph: CanvasGraph, actionNode: CanvasNode) {
  const visited = new Set<string>();
  const queue = [actionNode.id];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const incomingNodes = graph.edges
      .filter((edge) => edge.relation === "executes" && edge.to === nodeId)
      .map((edge) => graph.nodes.find((node) => node.id === edge.from))
      .filter((node): node is CanvasNode => Boolean(node));

    for (const incomingNode of incomingNodes) {
      if (incomingNode.kind === "event") {
        return getCanvasEventName(incomingNode);
      }

      if (incomingNode.kind === "mapping" || incomingNode.kind === "group" || incomingNode.kind === "action") {
        queue.push(incomingNode.id);
      }
    }
  }

  return null;
}

function applyDefaultDialogueCategoryToCanvasAction(graph: CanvasGraph, node: CanvasNode, action: Record<string, unknown>) {
  if (action.type !== "speak" || action.category !== undefined) {
    return;
  }

  const eventName = getNearestCanvasEventNameForAction(graph, node);
  const defaultCategory = eventName ? defaultDialogueCategoryByEvent[eventName] : undefined;

  if (defaultCategory) {
    action.category = defaultCategory;
  }
}

function applyDefaultManagementMenuToCanvasAction(node: CanvasNode, action: Record<string, unknown>) {
  if (action.type !== "open_management_menu" || action.items !== undefined) {
    return;
  }

  const preset = getInternalManagementMenuPreset(getCanvasNodeManagementMenuPresetId(node));
  action.menuId = action.menuId ?? preset.id;
  action.title = action.title ?? preset.title;
  action.items = preset.createItems();
}

function getMissingRequiredCanvasActionParameters(action: Record<string, unknown>, catalogItem: RuntimeActionCatalogItem | undefined) {
  return catalogItem?.parameters.filter((parameter) =>
    "required" in parameter && parameter.required === true && action[parameter.name] === undefined,
  ) ?? [];
}

function createRuntimeActionCandidateFromCanvasNode(graph: CanvasGraph, node: CanvasNode) {
  const actionType = getCanvasNodeActionType(node) ?? node.sourceId;
  if (!actionType) {
    return null;
  }

  const action = { type: actionType } as Record<string, unknown>;
  applyResourceToCanvasAction(action, getConnectedResourceForAction(graph, node));
  applyDefaultDialogueCategoryToCanvasAction(graph, node, action);
  applyDefaultManagementMenuToCanvasAction(node, action);

  const catalogItem = registry.actions.find((item) => item.type === actionType);

  return {
    action,
    actionType,
    catalogItem,
    missingRequired: getMissingRequiredCanvasActionParameters(action, catalogItem),
  };
}

function getCanvasActionMissingReason(actionType: string, missingRequired: RuntimeActionParameterCatalogItem[]) {
  const missingNames = missingRequired.map((parameter) => parameter.name).join(", ");

  if (actionType === "speak" && missingRequired.some((parameter) => parameter.name === "category")) {
    return "대사 묶음이 필요합니다. 새 캐릭터에 대사가 없다면 캐릭터 대사 설정을 먼저 만들거나, 대사 재료 카드를 액션에 연결하세요.";
  }

  if (actionType === "speak_text" && missingRequired.some((parameter) => parameter.name === "text")) {
    return "고정 문장 값이 필요합니다. 그래프 카드에서 직접 문장을 입력할 수 없으면 새 연결 단계에서 문장을 입력하거나 대사 재료를 먼저 만드세요.";
  }

  if (missingNames.length > 0) {
    return `필수값이 비어 있습니다: ${missingNames}`;
  }

  return "저장 가능한 액션 값으로 변환하지 못했습니다.";
}

function hasConnectedResourceKind(graph: CanvasGraph, actionNode: CanvasNode, resourceKind: NanikaResourceKind) {
  return graph.edges
    .filter((edge) => edge.relation === "references" && (edge.from === actionNode.id || edge.to === actionNode.id))
    .some((edge) => {
      const resourceNodeId = edge.from === actionNode.id ? edge.to : edge.from;
      const resourceNode = graph.nodes.find((node) => node.id === resourceNodeId);

      return resourceNode?.kind === "resource" && getCanvasNodeResourceKind(resourceNode) === resourceKind;
    });
}

function materializeInferredActionResourceReferences(graph: CanvasGraph) {
  graph.nodes
    .filter((node) => node.kind === "action")
    .forEach((actionNode) => {
      const candidate = createRuntimeActionCandidateFromCanvasNode(graph, actionNode);
      const category = candidate?.action.category;

      if (candidate?.action.type !== "speak" || typeof category !== "string" || !category) {
        return;
      }

      if (hasConnectedResourceKind(graph, actionNode, "dialogue")) {
        return;
      }

      const resourceNodeId = `${actionNode.id}:resource:dialogue:${sanitizeCanvasIdPart(category)}:inferred`;
      if (!graph.nodes.some((node) => node.id === resourceNodeId)) {
        graph.nodes.push(createResourceReferenceNode(
          resourceNodeId,
          "dialogue",
          category,
          actionNode.x + 244,
          actionNode.y + 88,
          ["param: category", "자동 추론"],
        ));
      }

      const edgeId = `${actionNode.id}->${resourceNodeId}`;
      if (!graph.edges.some((edge) => edge.id === edgeId)) {
        graph.edges.push({
          id: edgeId,
          from: actionNode.id,
          to: resourceNodeId,
          relation: "references",
          label: "자동",
        });
      }
    });
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

  const candidate = createRuntimeActionCandidateFromCanvasNode(graph, node);
  if (!candidate) {
    return null;
  }

  return candidate.missingRequired.length > 0 ? null : candidate.action as RuntimeAction;
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

function collectRuntimeConditionsForTargets(graph: CanvasGraph, targetNodeIds: readonly string[]) {
  const targetIds = new Set(targetNodeIds);
  const conditions = graph.edges
    .filter((edge) => edge.relation === "executes" && targetIds.has(edge.to))
    .map((edge) => graph.nodes.find((node) => node.id === edge.from))
    .filter((node): node is CanvasNode => Boolean(node && node.kind === "condition"))
    .map(createRuntimeConditionFromCanvasNode)
    .filter((condition): condition is RuntimeCondition => Boolean(condition));
  const seen = new Set<string>();

  return conditions.filter((condition) => {
    const key = JSON.stringify(condition);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
  const conditions = collectRuntimeConditionsForTargets(graph, ["event", "mapping"]);

  return {
    ...mapping,
    ...(conditions.length > 0 ? { conditions } : {}),
    actions: [...keptActions, ...additionalActions],
  };
}

function createMappingIdFromCanvasEvent(characterId: string, eventName: RuntimeEventName, index: number) {
  const baseId = `${characterId}.${eventName}`.replace(/[^a-zA-Z0-9_.:-]/g, ".");
  const suffix = index > 0 ? `.${index + 1}` : "";

  return `${baseId}${suffix}`.slice(0, 128);
}

function createMappingsFromCharacterCanvas(graph: CanvasGraph): NanikaMapping[] {
  const characterNode = graph.nodes.find((node) => node.kind === "character");
  const characterId = getCanvasCharacterId(characterNode) ?? activeCharacterResourceId ?? registry.character.id;
  const characterLabel = characterId === unassignedCharacterId
    ? "캐릭터 미정"
    : characterId === registry.character.id
      ? registry.character.name
      : characterId;
  const eventNodes = graph.nodes
    .filter((node) => node.kind === "event")
    .sort((left, right) => (left.x - right.x) || (left.y - right.y));

  return eventNodes.flatMap((eventNode, index) => {
    const eventName = getCanvasEventName(eventNode);
    if (!eventName) {
      return [];
    }

    const actions = graph.edges
      .filter((edge) => edge.relation === "executes" && edge.from === eventNode.id)
      .map((edge) => graph.nodes.find((node) => node.id === edge.to))
      .filter((node): node is CanvasNode => Boolean(node && (node.kind === "action" || node.kind === "group")))
      .sort((left, right) => (left.x - right.x) || (left.y - right.y))
      .map((node) => createRuntimeActionFromCanvasNode(graph, node))
      .filter((action): action is RuntimeAction => Boolean(action));

    if (actions.length === 0) {
      return [];
    }

    const conditions = collectRuntimeConditionsForTargets(graph, [eventNode.id]);
    const mapping: NanikaMapping = {
      id: createMappingIdFromCanvasEvent(characterId, eventName, index),
      name: `${characterLabel} ${getReadableEventLabel(eventName)} 연결`,
      event: eventName,
      actions,
      ...(conditions.length > 0 ? { conditions } : {}),
      ...(characterId === unassignedCharacterId
        ? {}
        : {
          target: {
          scope: "character",
          id: characterId,
          label: `캐릭터: ${characterLabel}`,
          },
        }),
    };

    return [mapping];
  });
}

function getCharacterCanvasSaveIssues(graph: CanvasGraph) {
  const eventNodes = graph.nodes
    .filter((node) => node.kind === "event")
    .sort((left, right) => (left.x - right.x) || (left.y - right.y));
  const issues: string[] = [];

  if (eventNodes.length === 0) {
    return ["이벤트 카드가 없습니다. 캐릭터 카드에서 클릭, hover, 시작 같은 이벤트를 먼저 연결하세요."];
  }

  eventNodes.forEach((eventNode) => {
    const eventLabel = getReadableEventLabel(getCanvasEventName(eventNode) ?? eventNode.title);
    const connectedActionNodes = graph.edges
      .filter((edge) => edge.relation === "executes" && edge.from === eventNode.id)
      .map((edge) => graph.nodes.find((node) => node.id === edge.to))
      .filter((node): node is CanvasNode => Boolean(node && (node.kind === "action" || node.kind === "group")))
      .sort((left, right) => (left.x - right.x) || (left.y - right.y));

    if (connectedActionNodes.length === 0) {
      issues.push(`${eventLabel}: 실행할 액션 카드가 연결되어 있지 않습니다.`);
      return;
    }

    connectedActionNodes.forEach((actionNode) => {
      const candidate = createRuntimeActionCandidateFromCanvasNode(graph, actionNode);
      if (!candidate) {
        issues.push(`${eventLabel} -> ${actionNode.title}: 액션 종류를 확인할 수 없습니다.`);
        return;
      }

      if (candidate.missingRequired.length > 0) {
        issues.push(`${eventLabel} -> ${actionNode.title}: ${getCanvasActionMissingReason(candidate.actionType, candidate.missingRequired)}`);
      }
    });
  });

  return issues;
}

function getCharacterCanvasLiveRequiredIssues(graph: CanvasGraph) {
  const state = getCanvasState(currentEditorGraphKey);
  const changedNodeIds = new Set<string>();
  state.extraNodes.forEach((node) => changedNodeIds.add(node.id));
  state.extraEdges.forEach((edge) => {
    changedNodeIds.add(edge.from);
    changedNodeIds.add(edge.to);
  });

  const changedActionNodes = graph.nodes
    .filter((node) => (node.kind === "action" || node.kind === "group") && changedNodeIds.has(node.id))
    .sort((left, right) => (left.x - right.x) || (left.y - right.y));
  const issues: string[] = [];

  changedActionNodes.forEach((actionNode) => {
    const hasExecutionInput = graph.edges.some((edge) =>
      edge.relation === "executes" && edge.to === actionNode.id,
    );

    if (!hasExecutionInput) {
      issues.push(`${actionNode.title}: 이벤트 카드나 액션 묶음 아래에 연결되어야 저장됩니다.`);
    }

    if (actionNode.kind === "group") {
      const childActionCount = graph.edges.filter((edge) =>
        edge.relation === "executes" && edge.from === actionNode.id,
      ).length;

      if (childActionCount === 0) {
        issues.push(`${actionNode.title}: 묶음 안에 실행할 액션 카드가 없습니다.`);
      }

      return;
    }

    const candidate = createRuntimeActionCandidateFromCanvasNode(graph, actionNode);
    if (!candidate) {
      issues.push(`${actionNode.title}: 액션 종류를 확인할 수 없습니다.`);
      return;
    }

    if (candidate.missingRequired.length > 0) {
      issues.push(`${actionNode.title}: ${getCanvasActionMissingReason(candidate.actionType, candidate.missingRequired)}`);
    }
  });

  return Array.from(new Set(issues));
}

async function saveMappingsFromCharacterCanvas() {
  if (!currentEditorGraph) {
    return false;
  }

  const mappings = createMappingsFromCharacterCanvas(currentEditorGraph);
  if (mappings.length === 0) {
    const issues = getCharacterCanvasSaveIssues(currentEditorGraph);
    mappingEditorDetail.replaceChildren(createEditorSummary(
      "파일에 저장할 연결 없음",
      "작업판 연결은 있지만 매핑 파일로 만들 수 있는 이벤트-액션 조합이 없습니다. 아래 항목을 먼저 해결하세요.",
      issues.length > 0 ? issues : ["예: 캐릭터 -> 클릭 이벤트 -> 대사 말하기 + 대사 재료"],
    ));
    saveCanvasStatesToStorage();
    return false;
  }

  const savedIds: string[] = [];
  for (const mapping of mappings) {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-mapping"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping }),
    });
    const result = await readApiJson<NanikaMappingsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? `${mapping.id} 연결을 저장하지 못했어요.`);
    }

    savedMappings = result.mappings ?? [];
    savedMappingsLoaded = true;
    savedIds.push(mapping.id);
  }

  saveCanvasStatesToStorage();
  renderSavedMappings();
  refreshOverview();
  mappingEditorDetail.replaceChildren(createEditorSummary(
    "연결 파일 저장 완료",
    "현재 캐릭터 작업판에서 만든 이벤트-액션 연결을 매핑 파일에 저장했습니다.",
    savedIds,
  ));

  return true;
}

function getCanvasActionNodes(graph: CanvasGraph) {
  return graph.nodes
    .filter((node) => node.kind === "action" || node.kind === "group")
    .sort((left, right) => (left.x - right.x) || (left.y - right.y));
}

function syncSavedMappingCanvasStateAfterSave(previousGraph: CanvasGraph, nextMapping: NanikaMapping) {
  const key = `saved:mapping:${nextMapping.id}`;
  const state = getCanvasState(key);
  const nextGraph = createMappingCanvasGraph(nextMapping, "saved");
  const previousActionNodes = getCanvasActionNodes(previousGraph);
  const nextActionNodes = getCanvasActionNodes(nextGraph);
  const usedPreviousNodeIds = new Set<string>();

  nextActionNodes.forEach((nextNode, index) => {
    if (state.positions[nextNode.id]) {
      return;
    }

    const nextActionType = getCanvasNodeActionType(nextNode);
    const matchedPreviousNode = previousActionNodes.find((previousNode) =>
      !usedPreviousNodeIds.has(previousNode.id) && getCanvasNodeActionType(previousNode) === nextActionType,
    ) ?? previousActionNodes[index];

    if (!matchedPreviousNode) {
      return;
    }

    usedPreviousNodeIds.add(matchedPreviousNode.id);
    state.positions[nextNode.id] = {
      x: matchedPreviousNode.x,
      y: matchedPreviousNode.y,
    };
  });

  state.extraNodes = state.extraNodes.filter((node) =>
    !(usedPreviousNodeIds.has(node.id) && (node.kind === "action" || node.kind === "group")),
  );
  state.extraEdges = state.extraEdges.filter((edge) =>
    !usedPreviousNodeIds.has(edge.from) && !usedPreviousNodeIds.has(edge.to),
  );
}

function createCharacterCanvasGraph(): CanvasGraph {
  const activeCharacterId = activeCharacterResourceId;
  const resources = getActiveCharacterResources();
  const isRegistryCharacter = activeCharacterId === registry.character.id;
  const characterName = activeCharacterId
    ? isRegistryCharacter ? registry.character.name : activeCharacterId
    : "캐릭터 미정";
  const characterDescription = activeCharacterId
    ? isRegistryCharacter ? registry.character.description : `${activeCharacterId} 캐릭터 재료를 확인합니다.`
    : "특정 캐릭터를 정하지 않은 공통 연결 context입니다.";
  const defaultExpression = isRegistryCharacter
    ? registry.character.defaultExpression
    : resources.expressions[0]?.id ?? "미지정";
  const configuredMappings = getConfiguredMappings();
  const usage = collectActionUsage(configuredMappings.flatMap((rule) => rule.actions));
  const usageDetails = collectActionUsageDetails(configuredMappings);
  const graph: CanvasGraph = {
    title: `${characterName} 연결 작업판`,
    description: "런타임에서 실제 캐릭터로 들어오고, 캐릭터 재료와 별도 무대 조합 재료로 이어집니다.",
    nodes: [
      createCanvasNode("runtime", "runtime", "나니카 실행", registry.preset.name, 32, 220, [
        `preset: ${registry.preset.id}`,
        `rules: ${configuredMappings.length}`,
        `source: ${getConfiguredMappingSourceLabel()}`,
      ]),
      createCanvasNode("character", "character", characterName, characterDescription, 292, 220, [
        `id: ${activeCharacterId ?? unassignedCharacterId}`,
        `기본 표정: ${defaultExpression}`,
        `표정 ${resources.expressions.length}개`,
        `상태 ${resources.surfaces.length}개`,
        `무대 조합 ${resources.scenes.length}개`,
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
  const relevantProfiles = activeCharacterId
    ? runtimeProfileOverviewCards.filter((profile) => profile.characterId === activeCharacterId)
    : [];
  relevantProfiles.forEach((profile, index) => {
    const runtimeConditionId = `runtime-condition:${profile.id}`;
    const characterConditionId = `character-condition:${profile.id}`;
    const conditionY = 40 + (index * 360);

    graph.nodes.push(
      createCanvasNode(runtimeConditionId, "condition", `${profile.name} 런타임 조건`, profile.match, 32, conditionY, [
        "scope: runtime",
        profile.id,
        profile.match,
      ]),
      createCanvasNode(characterConditionId, "condition", `${profile.name} 캐릭터 조건`, `${profile.characterId} 캐릭터 시작 설정`, 32, 760 + (index * 220), [
        "scope: character",
        ...profile.initial,
        ...profile.featureSetIds.map((featureSetId) => `feature set: ${featureSetId}`),
      ]),
    );
    graph.edges.push(
      {
        id: `runtime->${runtimeConditionId}`,
        from: "runtime",
        to: runtimeConditionId,
        relation: "contains",
        label: "조건",
      },
      {
        id: `${runtimeConditionId}->character`,
        from: runtimeConditionId,
        to: "character",
        relation: "contains",
        label: "대상",
      },
      {
        id: `character->${characterConditionId}`,
        from: "character",
        to: characterConditionId,
        relation: "references",
        label: "조건",
      },
    );
  });

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
      const optionUsageDetails = usageDetails.get(`${group.resourceKind}:${option.id}`) ?? [];
      const nodeId = `${group.id}:${option.id}`;
      const resourceX = 836 + ((optionIndex % 2) * optionGapX);
      const resourceY = groupY + ((Math.floor(optionIndex / 2)) * optionGapY);
      const resourceNode = createCanvasNode(
        nodeId,
        "resource",
        option.label,
        option.description ?? option.id,
        resourceX,
        resourceY,
        [`key: ${option.id}`, usageCount > 0 ? `사용 ${usageCount}` : "미연결"],
        group.resourceKind,
      );
      resourceNode.sourceId = option.id;
      graph.nodes.push(resourceNode);
      graph.edges.push({
        id: `${groupId}->${nodeId}`,
        from: groupId,
        to: nodeId,
        relation: usageCount > 0 ? "executes" : "references",
        label: "보유",
      });

      if (optionUsageDetails.length > 0) {
        const usageNodeId = `${nodeId}:usage`;
        const usageMeta = optionUsageDetails.slice(0, 6).map((detail) =>
          `${detail.mappingName} / ${getReadableEventLabel(detail.event)} / ${detail.actionLabel}`,
        );
        if (optionUsageDetails.length > 6) {
          usageMeta.push(`+${optionUsageDetails.length - 6}개 더 있음`);
        }
        graph.nodes.push(createCanvasNode(
          usageNodeId,
          "mapping",
          `${option.label} 사용처`,
          `${optionUsageDetails.length}개 연결/액션에서 이 재료를 참조합니다.`,
          resourceX + 584,
          resourceY,
          usageMeta,
        ));
        graph.edges.push({
          id: `${nodeId}->${usageNodeId}`,
          from: nodeId,
          to: usageNodeId,
          relation: "references",
          label: "참조됨",
        });
      }
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
    const mappingX = 280 + ((index % 3) * 238);
    const mappingY = 72 + (Math.floor(index / 3) * 220);
    graph.nodes.push(createCanvasNode(
      nodeId,
      mapping ? "mapping" : "missing",
      mapping?.name ?? mappingId,
      mapping ? `${getReadableEventLabel(mapping.event)} · 액션 ${countNestedActions(mapping.actions)}개` : "저장된 연결 목록에 없습니다.",
      mappingX,
      mappingY,
      mapping ? [
        mapping.event,
        ...mapping.actions.slice(0, 3).map((action) => getReadableActionLabel(action.type)),
      ] : ["누락"],
    ));
    graph.edges.push({
      id: `${rootId}->${nodeId}`,
      from: rootId,
      to: nodeId,
      relation: "contains",
      label: "포함",
    });

    mapping?.actions.slice(0, 3).forEach((action, actionIndex) => {
      const actionNodeId = `${nodeId}:action:${actionIndex}:${action.type}`;
      graph.nodes.push(createCanvasNode(
        actionNodeId,
        "action",
        getReadableActionLabel(action.type),
        formatAction(action),
        mappingX + 32,
        mappingY + 92 + (actionIndex * 76),
        [action.type],
      ));
      graph.edges.push({
        id: `${nodeId}->${actionNodeId}`,
        from: nodeId,
        to: actionNodeId,
        relation: "executes",
        label: "실행",
      });
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
  graph.nodes.forEach((node) => {
    const position = state.positions[node.id];
    if (position) {
      node.x = position.x;
      node.y = position.y;
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
  materializeInferredActionResourceReferences(currentEditorGraph);
  selectedCanvasNodeId = currentEditorGraph.nodes.some((node) => node.id === previousSelectedNodeId)
    ? previousSelectedNodeId
    : null;
  selectedCanvasNodeForPopover = null;
  pendingConnectionNodeId = null;
}

function getCanvasSize(graph: CanvasGraph) {
  const maxX = Math.max(
    editorCanvasMinWidth,
    ...graph.nodes.map((node) => node.x + editorCanvasNodeWidth + editorCanvasPaddingX),
  );
  const maxY = Math.max(
    editorCanvasMinHeight,
    ...graph.nodes.map((node) => node.y + editorCanvasNodeHeight + editorCanvasPaddingY),
  );

  return {
    width: maxX,
    height: maxY,
  };
}

function getEditorSummaryStats(graph: CanvasGraph | null): Array<[string, string]> {
  const resources = getActiveCharacterResources();
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
  let panStart: { id: number; x: number; y: number; scrollLeft: number; scrollTop: number; moved: boolean } | null = null;
  board.addEventListener("pointerdown", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    if (event.button !== 0 || event.target !== board) {
      return;
    }

    panStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: mappingEditorCanvas.scrollLeft,
      scrollTop: mappingEditorCanvas.scrollTop,
      moved: false,
    };
    board.dataset.panning = "true";
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointermove", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    if (!panStart) {
      return;
    }

    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      panStart.moved = true;
    }
    mappingEditorCanvas.scrollLeft = panStart.scrollLeft - dx;
    mappingEditorCanvas.scrollTop = panStart.scrollTop - dy;
  });
  board.addEventListener("pointerup", (rawEvent) => {
    const event = rawEvent as PointerEvent;
    if (panStart?.id === event.pointerId) {
      const moved = panStart.moved;
      board.releasePointerCapture(event.pointerId);
      panStart = null;
      delete board.dataset.panning;
      if (!moved && !isReadonly) {
        clearEditorCanvasSelection(false);
      }
    }
  });
  board.addEventListener("pointercancel", () => {
    panStart = null;
    delete board.dataset.panning;
  });

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
      loadMappingIntoDraft(editorSelection.mapping as NanikaMapping, { copy: true });
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

  function startQuickConnectionFromResource(node: CanvasNode) {
    const resourceKind = getCanvasNodeResourceKind(node);
    const resourceId = getCanvasNodeSourceId(node);

    if (!resourceKind || !resourceId) {
      startCanvasConnection(node);
      return;
    }

    const actionType = getDefaultActionTypeForResourceKind(resourceKind);
    const actionCatalogItem = registry.actions.find((action) => action.type === actionType);
    selectedScope = "character";
    selectedEvent = null;
    selectedActionCategory = actionCatalogItem?.category ?? null;
    selectedActionType = actionType;
    draftActionFlow = [];
    draftQuickConnectionActive = true;
    draftParameterPrefill = {
      [getDefaultParameterNameForResourceKind(resourceKind)]: resourceId,
    };
    draftTargetSelect.value = createMappingTargetValue("character", registry.character.id);
    draftMappingIdInput.value = `${registry.character.id}.${resourceKind}.${resourceId}`.replace(/[^a-zA-Z0-9_.:-]/g, ".");
    draftMappingNameInput.value = `${registry.character.name} ${node.title} 연결`;
    setEditorMode("create");
    renderStepBuilder();

    renderDraftPreview();

    renderDetailPanel(
      "액션",
      `${node.title} 빠른 연결`,
      `${getResourceKindLabel(resourceKind)} 재료를 선택했어요. 이제 2단계에서 언제 쓸지 고른 뒤, 필요하면 함께 실행할 동작을 추가하세요.`,
      [`재료: ${node.title}`, `선택값: ${resourceId}`, `추천 동작: ${getReadableActionLabel(actionType)}`],
    );
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
    const quickConnectButton = node.kind === "resource"
      ? createActionButton("새 연결로 쓰기", () => startQuickConnectionFromResource(node))
      : null;
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
    actions.append(connectButton);
    if (quickConnectButton) {
      actions.append(quickConnectButton);
    }
    actions.append(editButton, deleteButton, closeButton);
    const featureSetSummary = node.kind === "feature-set"
      ? createFeatureSetReferenceSummary(getCanvasNodeSourceId(node))
      : null;
    if (featureSetSummary) {
      popover.append(title, body, featureSetSummary, actions);
    } else {
      popover.append(title, body, actions);
    }
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
    const state = getCanvasState(currentEditorGraphKey);

    state.positions[node.id] = { x: node.x, y: node.y };
    state.extraNodes = state.extraNodes.map((extraNode) =>
      extraNode.id === node.id ? { ...extraNode, x: node.x, y: node.y } : extraNode,
    );
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
    return ["다음: 조건 또는 캐릭터", "조건을 붙이면 페이지/url/context별로 캐릭터나 기능을 나눌 수 있습니다."];
  }

  if (kind === "character") {
    return ["다음: 조건, 이벤트, 캐릭터 재료", "조건을 붙이면 같은 캐릭터 안에서도 페이지별 동작을 나눌 수 있습니다."];
  }

  if (kind === "condition") {
    return ["다음: 캐릭터, 이벤트, 저장 연결, 기능 묶음", "조건 뒤에 붙은 항목만 조건을 통과했을 때 실행됩니다."];
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
    return ["연결 가능: 매핑 카드", "사용 가능: 기능 묶음"];
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

  return ["카드 덱에서 다음에 붙일 항목을 선택하세요."];
}

function getPreferredPaletteCategoryForKind(kind: CanvasNodeKind): PaletteCategoryId {
  if (kind === "runtime") {
    return "conditions";
  }

  if (kind === "character") {
    return "conditions";
  }

  if (kind === "condition") {
    return "characters";
  }

  if (kind === "event" || kind === "feature-set") {
    return "actions";
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

function getDefaultActionTypeForResourceKind(resourceKind: NanikaResourceKind) {
  if (resourceKind === "dialogue") {
    return "speak";
  }

  if (resourceKind === "expression") {
    return "change_expression";
  }

  if (resourceKind === "surface") {
    return "surface";
  }

  if (resourceKind === "scene") {
    return "scene";
  }

  if (resourceKind === "layer") {
    return "play_layer_animation";
  }

  return "set_touched_part";
}

function getDefaultParameterNameForResourceKind(resourceKind: NanikaResourceKind) {
  if (resourceKind === "dialogue") {
    return "category";
  }

  if (resourceKind === "expression") {
    return "expression";
  }

  if (resourceKind === "surface" || resourceKind === "scene") {
    return "id";
  }

  if (resourceKind === "layer") {
    return "layerId";
  }

  return "part";
}

function getResourceKindLabel(resourceKind: NanikaResourceKind) {
  if (resourceKind === "expression") {
    return "표정";
  }

  if (resourceKind === "surface") {
    return "상태";
  }

  if (resourceKind === "scene") {
    return "무대 조합";
  }

  if (resourceKind === "layer") {
    return "파츠 움직임";
  }

  if (resourceKind === "dialogue") {
    return "대사";
  }

  return "터치 영역";
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

  if (from === "runtime" && to === "condition") {
    return "contains";
  }

  if (from === "runtime" && to === "feature-set") {
    return "references";
  }

  if (from === "condition" && to === "character") {
    return "contains";
  }

  if (from === "condition" && (to === "event" || to === "mapping")) {
    return "executes";
  }

  if (from === "condition" && to === "feature-set") {
    return "executes";
  }

  if (from === "character" && to === "condition") {
    return "references";
  }

  if (from === "character" && (to === "resource-group" || to === "event")) {
    return "references";
  }

  if (from === "character" && to === "feature-set") {
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

  if (from === "event" && (to === "action" || to === "group")) {
    return "executes";
  }

  if (from === "event" && to === "feature-set") {
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
    if (from.kind === "condition") {
      edge.label = "조건 적용";
    } else if (to.kind === "condition") {
      edge.label = "조건 분기";
    } else if (to.kind === "feature-set") {
      edge.label = "사용";
    } else if (relation === "contains") {
      edge.label = "포함";
    } else if (relation === "references") {
      edge.label = "참조";
    } else if (relation === "executes") {
      edge.label = "실행";
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

function getNextPaletteNodePosition() {
  const fallbackSize = currentEditorGraph ? getCanvasSize(currentEditorGraph) : { width: 680, height: 260 };
  const source = currentEditorGraph?.nodes.find((node) => node.id === pendingConnectionNodeId || node.id === selectedCanvasNodeForPopover?.id);

  if (!source) {
    return {
      x: Math.max(16, Math.min(fallbackSize.width - 232, Math.round(fallbackSize.width / 2) - 92)),
      y: Math.max(16, Math.min(fallbackSize.height - 112, Math.round(fallbackSize.height / 2) - 38)),
    };
  }

  const existingTargets = currentEditorGraph?.edges.filter((edge) => edge.from === source.id).length ?? 0;
  const candidateX = source.x + 260;
  const candidateY = source.y + (existingTargets * 112);

  if (candidateX <= fallbackSize.width - 232) {
    return {
      x: Math.max(16, candidateX),
      y: Math.max(16, Math.min(fallbackSize.height - 112, candidateY)),
    };
  }

  return {
    x: Math.max(16, Math.min(fallbackSize.width - 232, source.x)),
    y: Math.max(16, Math.min(fallbackSize.height - 112, source.y + 128 + (existingTargets * 112))),
  };
}

function addPaletteItemToCurrentGraph(item: PaletteItem, renderImmediately = true) {
  if (!currentEditorGraph) {
    selectCatalogInEditor(item.title, item.description, item.meta ?? [item.id], false);
    return null;
  }

  const position = getNextPaletteNodePosition();
  const node = createCanvasNodeFromPalette(
    item,
    position.x,
    position.y,
  );
  currentEditorGraph.nodes.push(node);
  getCanvasState(currentEditorGraphKey).extraNodes.push(node);
  selectedCanvasNodeId = node.id;
  if (renderImmediately) {
    renderEditorCanvas();
  }
  return node;
}

function removeDraftGuideNodeFromCurrentGraph(nodeId: string) {
  if (!currentEditorGraph) {
    return;
  }

  currentEditorGraph.nodes = currentEditorGraph.nodes.filter((node) => node.id !== nodeId);
  currentEditorGraph.edges = currentEditorGraph.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  const state = getCanvasState(currentEditorGraphKey);
  if (!state.removedNodeIds.includes(nodeId)) {
    state.removedNodeIds.push(nodeId);
  }
  state.extraEdges = state.extraEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
}

function getDefaultPaletteConnectionSourceId(item: PaletteItem) {
  if (!currentEditorGraph) {
    return null;
  }

  const selectedNode = currentEditorGraph.nodes.find((node) => node.id === selectedCanvasNodeId);
  if (selectedNode && getCanvasRelation(selectedNode.kind, item.kind)) {
    return selectedNode.id;
  }

  if (item.kind === "character") {
    const runtimeNode = currentEditorGraph.nodes.find((node) => node.kind === "runtime");

    return runtimeNode && getCanvasRelation(runtimeNode.kind, item.kind) ? runtimeNode.id : null;
  }

  if (item.kind === "event") {
    const source = currentEditorGraph.nodes.find((node) => node.kind === "target" || node.kind === "character" || node.kind === "condition");

    return source && getCanvasRelation(source.kind, item.kind) ? source.id : null;
  }

  if (item.kind === "mapping") {
    const eventNode = currentEditorGraph.nodes.find((node) => node.kind === "event");

    return eventNode && getCanvasRelation(eventNode.kind, item.kind) ? eventNode.id : null;
  }

  if (item.kind === "action" || item.kind === "group") {
    const selectedActionNode = currentEditorGraph.nodes.find((node) => node.id === selectedCanvasNodeId && (node.kind === "action" || node.kind === "group"));
    if (selectedActionNode && getCanvasRelation(selectedActionNode.kind, item.kind)) {
      return selectedActionNode.id;
    }

    const mappingNode = currentEditorGraph.nodes.find((node) => node.kind === "mapping");
    const eventNode = currentEditorGraph.nodes.find((node) => node.kind === "event");

    if (mappingNode && getCanvasRelation(mappingNode.kind, item.kind)) {
      return mappingNode.id;
    }

    return eventNode && getCanvasRelation(eventNode.kind, item.kind) ? eventNode.id : null;
  }

  if (item.kind === "resource") {
    const selectedActionNode = currentEditorGraph.nodes.find((node) => node.id === selectedCanvasNodeId && node.kind === "action");
    if (selectedActionNode && getCanvasRelation(selectedActionNode.kind, item.kind)) {
      return selectedActionNode.id;
    }

    const resourceGroup = currentEditorGraph.nodes.find((node) =>
      node.kind === "resource-group" && getCanvasNodeResourceKind(node) === item.resourceKind,
    );

    return resourceGroup && getCanvasRelation(resourceGroup.kind, item.kind) ? resourceGroup.id : null;
  }

  if (item.kind === "feature-set") {
    const preferredKinds: CanvasNodeKind[] = ["event", "condition", "character", "runtime"];
    const source = preferredKinds
      .flatMap((kind) => currentEditorGraph!.nodes.filter((node) => node.kind === kind))
      .find((node) => Boolean(getCanvasRelation(node.kind, item.kind)));

    return source?.id ?? null;
  }

  return null;
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
  selectedScope = selectedScope ?? "runtime";
  selectedPaletteCategory = selectedEvent ? "feature-sets" : "characters";
  renderDraftPreview();
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
    const knownCharacterItems = getKnownCharacterIds().map((characterId) => {
      const isCurrentCharacter = characterId === registry.character.id;

      return {
        id: characterId,
        kind: "character" as const,
        title: isCurrentCharacter ? registry.character.name : characterId,
        description: isCurrentCharacter
          ? registry.character.description
          : "캐릭터 context만 먼저 선택합니다. 이 devtool에 해당 캐릭터 자원이 로드되면 전용 재료를 사용할 수 있습니다.",
        meta: isCurrentCharacter
          ? [
            `id: ${registry.character.id}`,
            `default: ${registry.character.defaultExpression}`,
            `${registry.character.expressionCount} expressions`,
          ]
          : [
            `id: ${characterId}`,
            "전용 재료 미로드",
          ],
      };
    });

    return [
      {
        id: unassignedCharacterId,
        kind: "character",
        title: "캐릭터 미정",
        description: "특정 캐릭터를 정하지 않고 공통 이벤트와 공통 액션만 연결합니다.",
        meta: ["공통 매핑", "캐릭터 전용 재료 숨김"],
      },
      ...knownCharacterItems,
    ];
  }

  if (category === "conditions") {
    return [
      ...createSavedConditionPaletteItems(),
      ...createRuntimeConditionPaletteItems(),
      ...createCharacterConditionPaletteItems(),
    ];
  }

  if (category === "saved") {
    return savedMappings.map((mapping) => ({
      id: mapping.id,
      kind: "mapping",
      title: getDisplayMappingName(mapping),
      description: `${getReadableEventLabel(mapping.event)} · 액션 ${countNestedActions(mapping.actions)}개`,
      meta: [getMappingPortabilityLabel(mapping), mapping.id, mapping.event],
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
    return registry.actions.flatMap<PaletteItem>((action) => {
      if (action.type === "open_management_menu") {
        return internalManagementMenuPresets.map((preset) => ({
          id: `open_management_menu:${preset.id.replace(/^demo\./, "")}`,
          kind: "action" as const,
          title: `${getReadableActionLabel(action.type)} - ${preset.title}`,
          description: preset.description,
          meta: [
            action.type,
            `분류: ${getReadableActionCategoryLabel(action.category)}`,
            `menu preset: ${preset.id}`,
          ],
        }));
      }

      return {
        id: action.type,
        kind: action.type === "run_sequence" || action.type === "run_parallel" || action.type === "run_random" ? "group" : "action",
        title: getReadableActionLabel(action.type),
        description: action.description,
        meta: [action.type, `분류: ${getReadableActionCategoryLabel(action.category)}`],
      } satisfies PaletteItem;
    });
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
    if (!hasLoadedCharacterResources(pendingSource)) {
      return [];
    }

    return getCharacterResourceGroupPaletteItems().map((item) => ({
      id: item.id,
      kind: item.kind,
      resourceKind: item.resourceKind,
      title: item.title,
      description: item.description,
      meta: item.meta ?? [],
    }));
  }

  if (category === "resources" && !hasLoadedCharacterResources(getActiveCanvasCharacterNode() ?? undefined)) {
    return [];
  }

  const resources = getActiveCharacterResources();
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

  if (item.kind === "condition") {
    const conditionScope = getConditionScopeFromMeta(item.meta);

    if (source.kind === "runtime") {
      return conditionScope === "runtime";
    }

    if (source.kind === "character") {
      return conditionScope === "character";
    }
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
    { id: "conditions", label: "조건" },
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
    button.dataset.paletteCategory = category.id;
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
    card.dataset.paletteItem = item.id;
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
      const canOpenCharacterWorkspace = activeView === "overview";
      const canOpenSavedMappingWorkspace = activeView === "saved";
      const canOpenFeatureSetWorkspace = activeView === "feature-sets";

      if (item.kind === "character" && !pendingConnectionNodeId && canOpenCharacterWorkspace) {
        activeCharacterResourceId = item.id === unassignedCharacterId ? null : item.id;
        selectCharacterInEditor(false);
        selectedCanvasNodeId = "character";
        void activateCharacterResources(item.id);
        return;
      }

      if (item.kind === "mapping" && !pendingConnectionNodeId && canOpenSavedMappingWorkspace) {
        const mapping = savedMappings.find((savedMapping) => savedMapping.id === item.id);
        if (mapping) {
          selectMappingInEditor(mapping, "saved", false);
          return;
        }
      }

      if (item.kind === "feature-set" && !pendingConnectionNodeId && canOpenFeatureSetWorkspace) {
        const featureSet = getFeatureSetsForDisplay().find((savedFeatureSet) => savedFeatureSet.id === item.id);
        if (featureSet) {
          selectFeatureSetInEditor(featureSet, false);
          return;
        }
      }

      const popoverSourceId = selectedCanvasNodeForPopover && getCanvasRelation(selectedCanvasNodeForPopover.kind, item.kind)
        ? selectedCanvasNodeForPopover.id
        : null;
      let pendingSourceId = pendingConnectionNodeId ?? mappingPaletteDeck.dataset.pendingSourceId ?? popoverSourceId;
      pendingSourceId = pendingSourceId ?? getDefaultPaletteConnectionSourceId(item);
      if (!pendingSourceId && !currentEditorGraph && activeView !== "catalog") {
        mappingEditorDetail.replaceChildren(createEditorSummary(
          "연결할 위치를 먼저 선택하세요",
          "새 연결을 만들 때는 시작 영역, 이벤트, 액션을 먼저 고르거나 작업판 카드의 다음 노드 붙이기를 눌러 연결 위치를 정한 뒤 카드를 추가합니다.",
          [item.title],
        ));
        return;
      }

      const shouldConnectPending = Boolean(pendingSourceId);
      if (item.kind === "character" && activeView === "create") {
        removeDraftGuideNodeFromCurrentGraph("character-guide");
      }
      const node = addPaletteItemToCurrentGraph(item, !shouldConnectPending);

      if (pendingSourceId && node) {
        pendingConnectionNodeId = pendingSourceId;
        connectPendingNodeTo(node.id);
      }
      if (item.kind === "character") {
        if (activeView === "create") {
          selectedPaletteCategory = "events";
        }
        void activateCharacterResources(item.id);
      }
      if (item.kind === "feature-set") {
        renderFeatureSetReferenceDetail(item.id);
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
  editorLoadDraftButton.textContent = "새 연결로 불러오기";
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
    editorSaveButton.textContent = isReadonly ? "조회 전용" : "연결 파일 저장";
    appendEditorSaveGuide(
      "저장 동작",
      "현재 캐릭터 작업판에서 새로 이어 붙인 이벤트와 액션을 generated/nanika-mappings.json에 저장합니다.",
      ["파일 저장", "캐릭터 -> 이벤트 -> 액션 연결 필요", "배치만 바꾸면 브라우저 작업판 상태도 함께 저장"],
    );
    mappingEditorDetail.append(createEditorSummary(
      "이 작업판에서 바로 저장",
      "캐릭터에 이벤트 카드와 액션 카드를 이어 붙이면 이 버튼으로 generated/nanika-mappings.json에 바로 저장합니다. 연결이 없으면 배치 상태만 이 브라우저에 보존합니다.",
      ["캐릭터 -> 이벤트 -> 액션", "필수값은 재료 카드를 액션에 연결"],
    ));
    const liveRequiredIssues = getCharacterCanvasLiveRequiredIssues(currentEditorGraph!);
    if (liveRequiredIssues.length > 0) {
      mappingEditorDetail.append(createEditorSummary(
        "필수 요소 확인",
        "방금 추가한 연결 중 저장 전에 보완해야 할 항목이 있습니다.",
        liveRequiredIssues,
      ));
    }
    renderEditorStats();
    return;
  }

  if (editorSelection.type === "draft") {
    mappingEditorHelp.textContent = "새 연결 만들기에서 구성 중인 연결 흐름입니다.";
    const draftGraphKey = getEditorGraphKey(editorSelection);
    if (currentEditorGraphKey !== draftGraphKey || !currentEditorGraph) {
      const initialDraftGraph = lastDraftResult.mapping
        ? createMappingCanvasGraph(lastDraftResult.mapping, "draft")
        : createDraftSetupCanvasGraph();
      setCurrentEditorGraph(draftGraphKey, initialDraftGraph);
    }

    lastDraftResult = createDraftMapping();
    draftMappingPreview.textContent = JSON.stringify({
      mapping: lastDraftResult.mapping,
      runtimeRule: lastDraftResult.runtimeRule,
    }, null, 2);

    const canSaveDraft = Boolean(lastDraftResult.mapping && lastDraftResult.errors.length === 0);
    editorCopyGraphButton.disabled = false;
    editorSaveButton.disabled = !canSaveDraft;
    editorSaveButton.textContent = "연결 저장";
    mappingEditorCanvas.replaceChildren(renderCanvasGraph(currentEditorGraph!, { readonly: isReadonly }));
    appendEditorSaveGuide(
      "저장 동작",
      "새 연결 초안을 generated/nanika-mappings.json에 저장합니다. 기존 연결을 불러온 경우 ID를 바꾸면 다른 이름의 연결로 저장됩니다.",
      ["파일 저장", "대상 + 이벤트 + 액션 필수", "조건 값이 비어 있으면 저장 불가"],
    );

    if (!canSaveDraft) {
      mappingEditorDetail.append(createEditorSummary(
        "먼저 캐릭터를 고르세요",
        "새 연결은 런타임에서 시작하지만, 실제 기능은 캐릭터 미정 또는 특정 캐릭터 컨텍스트 아래에 붙여서 읽습니다.",
        lastDraftResult.errors.length > 0 ? lastDraftResult.errors : ["캐릭터 선택", "이벤트 선택", "액션 추가"],
      ));
    }
    draftMappingStatus.textContent = canSaveDraft
      ? "저장 가능한 매핑입니다."
      : lastDraftResult.errors.join(" / ");
    draftMappingStatus.dataset.state = canSaveDraft ? "ready" : "warning";
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
    editorLoadDraftButton.textContent = source === "saved" ? "새 연결로 복사" : "새 연결로 저장 준비";
    editorAddToFeatureSetButton.disabled = isReadonly || source !== "saved";
    editorSaveButton.disabled = isReadonly;
    editorSaveButton.textContent = isReadonly ? "조회 전용" : source === "saved" ? "수정 저장" : "작업판 저장";
    appendEditorSaveGuide(
      source === "saved" ? "저장 동작" : "조회 상태",
      source === "saved"
        ? "현재 저장 연결을 같은 ID로 수정 저장합니다. 다른 이름으로 저장하려면 '새 연결로 불러오기' 후 ID를 바꿔 저장하세요."
        : "현재 preset에서 읽은 조회용 연결입니다. 파일에 저장하려면 새 연결로 불러온 뒤 저장하세요.",
      source === "saved"
        ? ["파일 수정 저장", "같은 ID 덮어쓰기", "다른 이름 저장은 새 연결 초안에서 처리"]
        : ["조회 전용", "새 연결로 불러오기 필요"],
    );
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
    appendEditorSaveGuide(
      "저장 동작",
      "선택한 저장 연결 ID들을 하나의 기능 묶음으로 저장합니다. 묶음은 연결 자체를 복사하지 않고 저장 연결을 참조합니다.",
      ["묶음 파일 저장", "저장 연결 1개 이상 필요", "중첩 묶음 직접 포함은 보류"],
    );
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

function clearEditorCanvasSelection(render = false) {
  selectedCanvasNodeId = null;
  selectedCanvasNodeForPopover = null;
  pendingConnectionNodeId = null;
  if (render && currentEditorGraph) {
    renderEditorCanvas();
  }
  mappingEditorCanvas.querySelector(".nanika-node-popover")?.remove();
  mappingEditorCanvas.querySelectorAll<HTMLElement>(".nanika-paint-node[data-selected='true']").forEach((node) => {
    node.dataset.selected = "false";
  });
}

function createFeatureSetReferenceSummary(featureSetId: string) {
  const featureSet = getFeatureSetsForDisplay().find((candidate) => candidate.id === featureSetId);
  if (!featureSet) {
    return createEditorSummary(
      "기능 묶음을 찾지 못했어요",
      "현재 저장된 기능 묶음 목록에 없는 카드입니다.",
      [featureSetId],
    );
  }

  const mappingById = new Map(savedMappings.map((mapping) => [mapping.id, mapping]));
  const mappingLines = featureSet.mappingIds.map((mappingId) => {
    const mapping = mappingById.get(mappingId);

    return mapping
      ? `${getDisplayMappingName(mapping)} · ${getReadableEventLabel(mapping.event)} · 액션 ${countNestedActions(mapping.actions)}개`
      : `${mappingId} · 저장 연결 누락`;
  });

  return createEditorSummary(
    featureSet.name ?? featureSet.id,
    "이 기능 묶음에 포함된 저장 연결입니다. 작업판에서는 하나의 묶음 카드로 쓰고, 실제 적용 시 포함 연결들이 실행 규칙으로 풀립니다.",
    [
      `id: ${featureSet.id}`,
      getFeatureSetStatusText(featureSet),
      ...mappingLines,
    ],
  );
}

function renderFeatureSetReferenceDetail(featureSetId: string) {
  mappingEditorDetail.replaceChildren(createFeatureSetReferenceSummary(featureSetId));
}

function getCharacterResourceGroupPaletteItems(): ResourceGroupPaletteItem[] {
  const resources = getActiveCharacterResources();

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
    getActionResourceReferences(action).forEach((reference) => {
      const key = `${reference.resourceKind}:${reference.id}`;
      output.set(key, (output.get(key) ?? 0) + 1);
    });

    ["pluginId", "theme", "mode", "placement", "display"].forEach((field) => {
      const value = record[field];
      const kind = field === "pluginId" ? "plugin" : "ui";

      if (typeof value === "string" && value.trim()) {
        const key = `${kind}:${value.trim()}`;
        output.set(key, (output.get(key) ?? 0) + 1);
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

function collectActionUsageDetails(mappings: readonly (RuntimeRule | NanikaMapping)[]) {
  const details = new Map<string, ActionUsageDetail[]>();

  const visitActions = (
    mapping: RuntimeRule | NanikaMapping,
    actions: readonly RuntimeAction[],
  ) => {
    actions.forEach((action) => {
      getActionResourceReferences(action).forEach((reference) => {
        const key = `${reference.resourceKind}:${reference.id}`;
        const usage: ActionUsageDetail = {
          mappingId: mapping.id,
          mappingName: getDisplayMappingName(mapping),
          event: mapping.event,
          actionType: action.type,
          actionLabel: getReadableActionLabel(action.type),
        };
        details.set(key, [...(details.get(key) ?? []), usage]);
      });

      const record = action as Record<string, unknown>;

      if (Array.isArray(record.actions)) {
        visitActions(mapping, record.actions as RuntimeAction[]);
      }

      if (Array.isArray(record.items)) {
        record.items.forEach((item) => {
          const actions = (item as { actions?: RuntimeAction[] }).actions;
          const children = (item as { children?: Array<{ actions?: RuntimeAction[] }> }).children;

          if (Array.isArray(actions)) {
            visitActions(mapping, actions);
          }

          if (Array.isArray(children)) {
            children.forEach((child) => {
              if (Array.isArray(child.actions)) {
                visitActions(mapping, child.actions);
              }
            });
          }
        });
      }
    });
  };

  mappings.forEach((mapping) => {
    visitActions(mapping, mapping.actions);
  });

  return details;
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

function createSafeFeatureSetIdPart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "character";
}

function getFeatureSetCloneSources() {
  return getFeatureSetsForDisplay();
}

function getSelectedFeatureSetCloneSource() {
  return getFeatureSetCloneSources().find((featureSet) => featureSet.id === featureSetCloneSourceSelect.value);
}

function createDefaultFeatureSetCloneId(source: NanikaFeatureSet, characterId: string) {
  const sourceTail = source.id
    .replace(/^generic\.character\./, "")
    .replace(/^rine\./, "");

  return `${createSafeFeatureSetIdPart(characterId)}.${createSafeFeatureSetIdPart(sourceTail || source.id)}`;
}

function createDefaultFeatureSetCloneName(source: NanikaFeatureSet, characterId: string) {
  return `${characterId} - ${source.name ?? source.id}`;
}

function hasFeatureRequirementInAssets(
  requirement: NonNullable<NanikaFeatureSet["requirements"]>[number],
  assetsResult: CharacterAssetsResponse,
) {
  const assets = assetsResult.assets ?? {};

  if (requirement.kind === "expression") {
    return Boolean(assets.expressions?.[requirement.id]);
  }

  if (requirement.kind === "surface") {
    return Boolean(assets.surfaces?.[requirement.id]);
  }

  if (requirement.kind === "scene") {
    return Boolean(assets.scenes?.[requirement.id]) || (requirement.id === "default" && Boolean(assets.defaultScene));
  }

  if (requirement.kind === "layer") {
    return Object.values(assets.surfaces ?? {})
      .some((surface) => Boolean(surface.layers?.[requirement.id]));
  }

  if (requirement.kind === "hitArea") {
    return Boolean((assets as { hitAreas?: Record<string, unknown> }).hitAreas?.[requirement.id]);
  }

  return true;
}

function getTargetFeatureSetMissingRequirements(featureSet: NanikaFeatureSet, assetsResult: CharacterAssetsResponse) {
  return (featureSet.requirements ?? [])
    .filter((requirement) => requirement.required !== false)
    .filter((requirement) => !hasFeatureRequirementInAssets(requirement, assetsResult))
    .map((requirement) => `${getRequirementKindLabel(requirement.kind)}: ${requirement.label ?? requirement.id}`);
}

function syncFeatureSetCloneDefaults() {
  const source = getSelectedFeatureSetCloneSource();
  const characterId = featureSetCloneCharacterSelect.value;

  if (!source || !characterId) {
    return;
  }

  if (!featureSetCloneIdInput.value.trim() || featureSetCloneIdInput.dataset.auto === "true") {
    featureSetCloneIdInput.value = createDefaultFeatureSetCloneId(source, characterId);
    featureSetCloneIdInput.dataset.auto = "true";
  }

  if (!featureSetCloneNameInput.value.trim() || featureSetCloneNameInput.dataset.auto === "true") {
    featureSetCloneNameInput.value = createDefaultFeatureSetCloneName(source, characterId);
    featureSetCloneNameInput.dataset.auto = "true";
  }
}

function renderFeatureSetCloneControls() {
  const sources = getFeatureSetCloneSources();
  const currentSourceId = featureSetCloneSourceSelect.value;
  const currentCharacterId = featureSetCloneCharacterSelect.value;

  featureSetCloneSourceSelect.replaceChildren(...sources.map((featureSet) => (
    new Option(`${featureSet.name ?? featureSet.id} (${featureSet.mappingIds.length})`, featureSet.id)
  )));
  if (sources.some((featureSet) => featureSet.id === currentSourceId)) {
    featureSetCloneSourceSelect.value = currentSourceId;
  }

  const characterIds = Array.from(new Set([registry.character.id, ...availableCharacterIds])).filter(Boolean);
  featureSetCloneCharacterSelect.replaceChildren(...characterIds.map((characterId) => new Option(characterId, characterId)));
  if (characterIds.includes(currentCharacterId)) {
    featureSetCloneCharacterSelect.value = currentCharacterId;
  }

  syncFeatureSetCloneDefaults();
  void renderFeatureSetClonePreview();
}

async function renderFeatureSetClonePreview() {
  const requestId = ++featureSetClonePreviewRequestId;
  const source = getSelectedFeatureSetCloneSource();
  const characterId = featureSetCloneCharacterSelect.value;

  if (!source || !characterId) {
    featureSetClonePreview.replaceChildren(createCard("복제할 묶음 없음", "원본 기능 묶음과 대상 캐릭터를 먼저 선택하세요."));
    return;
  }

  syncFeatureSetCloneDefaults();
  featureSetClonePreview.replaceChildren(createCard("복제 미리보기", `${source.name ?? source.id} 묶음을 ${characterId} 캐릭터용으로 확인하는 중입니다.`, [
    `새 ID: ${featureSetCloneIdInput.value.trim()}`,
    `연결 ${source.mappingIds.length}개`,
  ]));

  try {
    const assetsResult = await fetchCharacterAssets(characterId);

    if (requestId !== featureSetClonePreviewRequestId) {
      return;
    }

    const missing = getTargetFeatureSetMissingRequirements(source, assetsResult);
    const card = createCard(
      `${featureSetCloneNameInput.value.trim() || createDefaultFeatureSetCloneName(source, characterId)}`,
      missing.length === 0
        ? "대상 캐릭터에서 필수 재료를 찾았습니다. 같은 action id를 쓰는 연결은 그대로 재사용할 수 있어요."
        : "대상 캐릭터에 없는 필수 재료가 있습니다. 저장은 가능하지만 실행 전에 캐릭터 설정이나 공통 key를 확인하세요.",
      [
        `원본: ${source.id}`,
        `대상 캐릭터: ${characterId}`,
        `새 ID: ${featureSetCloneIdInput.value.trim()}`,
        `연결 ${source.mappingIds.length}개`,
        ...(missing.length > 0 ? missing.slice(0, 6).map((item) => `미연결: ${item}`) : ["필수 재료 확인됨"]),
      ],
    );
    card.append(createFeatureSetFlow(source));
    featureSetClonePreview.replaceChildren(card);
  } catch (error) {
    if (requestId !== featureSetClonePreviewRequestId) {
      return;
    }

    featureSetClonePreview.replaceChildren(createCard(
      "대상 캐릭터 확인 실패",
      error instanceof Error ? error.message : "대상 캐릭터 자산을 불러오지 못했습니다.",
    ));
  }
}

async function loadFeatureSetCloneCharacters() {
  try {
    availableCharacterIds = await fetchCharacterList();
  } catch {
    availableCharacterIds = [registry.character.id];
  }

  renderFeatureSetCloneControls();
  renderEditorPalette();
}

async function saveClonedFeatureSet() {
  const source = getSelectedFeatureSetCloneSource();
  const characterId = featureSetCloneCharacterSelect.value.trim();
  const cloneId = featureSetCloneIdInput.value.trim();
  const cloneName = featureSetCloneNameInput.value.trim();

  if (!source || !characterId || !cloneId) {
    featureSetStatus.textContent = "복제할 기능 묶음, 대상 캐릭터, 새 ID를 먼저 확인하세요.";
    featureSetStatus.dataset.state = "warning";
    return;
  }

  const featureSet: NanikaFeatureSet = {
    id: cloneId,
    name: cloneName || createDefaultFeatureSetCloneName(source, characterId),
    description: source.description ?? `${source.name ?? source.id} 묶음을 ${characterId} 캐릭터용으로 복제했습니다.`,
    mode: "character-specific",
    sourceCharacterId: characterId,
    ...(source.requirements ? { requirements: source.requirements } : {}),
    mappingIds: source.mappingIds,
  };

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-feature-set"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureSet }),
    });
    const result = await readApiJson<NanikaFeatureSetsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "기능 묶음 복제본을 저장하지 못했어요.");
    }

    savedFeatureSets = result.featureSets ?? [];
    featureSetIdInput.value = featureSet.id;
    featureSetNameInput.value = featureSet.name ?? featureSet.id;
    renderFeatureSets(result.path);
    refreshOverview();
    selectFeatureSetInEditor(featureSet);
    featureSetStatus.textContent = `${featureSet.id} 기능 묶음 복제본을 저장했어요.`;
    featureSetStatus.dataset.state = "ready";
  } catch (error) {
    featureSetStatus.textContent = error instanceof Error ? error.message : "기능 묶음 복제본을 저장하지 못했어요.";
    featureSetStatus.dataset.state = "warning";
  }
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

const characterSpecificResourceKinds = new Set<NanikaResourceKind>([
  "expression",
  "surface",
  "scene",
  "layer",
  "hitArea",
]);

function actionUsesCharacterSpecificResource(action: RuntimeAction): boolean {
  if (getActionResourceReferences(action).some((reference) => characterSpecificResourceKinds.has(reference.resourceKind))) {
    return true;
  }

  const record = action as Record<string, unknown>;
  const nestedActions = record.actions;
  if (Array.isArray(nestedActions) && nestedActions.some((nestedAction) => actionUsesCharacterSpecificResource(nestedAction as RuntimeAction))) {
    return true;
  }

  const menuItems = record.items;
  if (Array.isArray(menuItems)) {
    return menuItems.some((item) => {
      const menuItem = item as { actions?: RuntimeAction[]; children?: Array<{ actions?: RuntimeAction[] }> };

      return menuItem.actions?.some(actionUsesCharacterSpecificResource)
        || menuItem.children?.some((child) => child.actions?.some(actionUsesCharacterSpecificResource));
    });
  }

  return false;
}

function mappingUsesCharacterSpecificResources(mapping: RuntimeRule | NanikaMapping) {
  return mapping.actions.some(actionUsesCharacterSpecificResource);
}

function stripCurrentCharacterPrefix(label: string) {
  const characterNames = Array.from(new Set([
    registry.character.name,
    registry.character.id,
    "Rine",
    "리네",
  ].filter(Boolean)));

  return characterNames.reduce((current, name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return current.replace(new RegExp(`^${escaped}[\\s:·_-]+`, "i"), "");
  }, label).trim();
}

function getDisplayMappingName(mapping: RuntimeRule | NanikaMapping) {
  const originalName = (mapping as NanikaMapping).name ?? mapping.id;
  return mappingUsesCharacterSpecificResources(mapping)
    ? originalName
    : stripCurrentCharacterPrefix(originalName) || originalName;
}

function getMappingPortabilityLabel(mapping: RuntimeRule | NanikaMapping) {
  return mappingUsesCharacterSpecificResources(mapping) ? "캐릭터 전용" : "공통 연결 후보";
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
    title: getDisplayMappingName(mapping),
    description: `${getReadableEventLabel(mapping.event)}에서 ${mapping.actions.length}개 최상위 액션을 실행합니다.`,
    meta: [
      mapping.id,
      getMappingPortabilityLabel(mapping),
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
    appendFlowStep(flow, createFlowNode("동작 없음", "동작을 추가하면 여기서 흐름을 확인합니다.", "missing"));
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
      draftParameterPrefill = {};
      draftQuickConnectionActive = false;
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
      if (!draftQuickConnectionActive) {
        selectedActionCategory = null;
        selectedActionType = null;
        draftParameterPrefill = {};
      }
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
      meta: [`동작 ${registry.actions.filter((action) => action.category === category.id).length}개`],
    },
    "실행 영역",
    selectedActionCategory === category.id,
    () => {
      selectedActionCategory = category.id;
      selectedActionType = null;
      draftParameterPrefill = {};
      draftQuickConnectionActive = false;
      renderDetailPanel("실행 영역", category.title, category.description);
      renderStepBuilder();
    },
  )));
}

function renderActionOptions() {
  const actions = getActionsForSelectedCategory();

  if (!selectedActionCategory) {
    draftActionHelp.textContent = "동작 종류를 선택하면 구체적인 동작이 나타납니다.";
    draftActionOptions.replaceChildren(createCard("대기 중", "먼저 동작 종류를 선택하세요."));
    return;
  }

  draftActionHelp.textContent = `${actions.length}개 동작 중 하나를 선택하세요.`;
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
      draftParameterPrefill = {};
      draftQuickConnectionActive = false;
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
    empty.textContent = "동작을 선택하면 입력할 값이 나타납니다.";
    draftActionParameters.append(empty);
    return;
  }

  if (selectedAction.parameters.length === 0) {
    const empty = document.createElement("p");
    empty.className = "asset-lab-help";
    empty.textContent = "이 동작은 따로 입력할 값이 없습니다.";
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

    const prefilledValue = draftParameterPrefill[parameter.name];
    if (prefilledValue !== undefined) {
      if (input instanceof HTMLSelectElement && prefilledValue && !Array.from(input.options).some((option) => option.value === prefilledValue)) {
        input.append(new Option(`직접 입력: ${prefilledValue}`, prefilledValue));
      }
      input.value = prefilledValue;
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
    errors.push("동작을 선택하세요.");
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
        errors.push(`필수 값 누락: ${getReadableParameterLabel(parameter.name)}`);
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
      "동작 없음",
      "선택 동작 설정에서 동작을 추가하면 여기에 쌓입니다. 2개 이상 쌓은 뒤 실행 방식을 고를 수 있습니다.",
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
          draftMappingStatus.textContent = `동작 흐름은 최대 ${maxActionFlowSteps}개까지 추가할 수 있습니다.`;
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
    draftMappingStatus.textContent = `동작 흐름은 최대 ${maxActionFlowSteps}개까지 추가할 수 있습니다.`;
    draftMappingStatus.dataset.state = "warning";
    renderDraftPreview();
    return;
  }

  const action = createActionFromSelectedInputs(errors);

  if (!action) {
    draftMappingStatus.textContent = errors.join(" / ") || "추가할 동작이 없습니다.";
    draftMappingStatus.dataset.state = "warning";
    renderDraftPreview();
    return;
  }

  draftActionFlow.push(action);
  draftParameterPrefill = {};
  draftQuickConnectionActive = false;
  renderActionFlow();
  renderDraftFlowPreview();
  renderDraftPreview();
  draftMappingStatus.textContent = `${getReadableActionLabel(action.type)} 동작을 흐름에 추가했어요.`;
  draftMappingStatus.dataset.state = "ready";
}

function wrapCurrentActionFlow(type: "run_sequence" | "run_parallel" | "run_random") {
  if (draftActionFlow.length < 2) {
    draftMappingStatus.textContent = "묶음으로 만들려면 동작 흐름에 동작을 2개 이상 추가하세요.";
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

function getCanvasEventName(node: CanvasNode | undefined): RuntimeEventName | null {
  if (!node) {
    return null;
  }

  const eventMeta = node.meta?.find((item) => item.startsWith("event: "));
  if (eventMeta) {
    return eventMeta.slice("event: ".length) as RuntimeEventName;
  }

  const sourceId = getCanvasNodeSourceId(node);
  return registry.events.some((event) => event.event === sourceId)
    ? sourceId as RuntimeEventName
    : null;
}

function getDraftCanvasEventName(): RuntimeEventName | null {
  if (editorSelection.type !== "draft" || !currentEditorGraph) {
    return null;
  }

  return getCanvasEventName(currentEditorGraph.nodes.find((node) => node.kind === "event"));
}

function getDraftCanvasTargetOption(): MappingTargetOption | null | undefined {
  if (editorSelection.type !== "draft" || !currentEditorGraph) {
    return undefined;
  }

  const characterNode = currentEditorGraph.nodes.find((node) => node.kind === "character");
  const characterId = getCanvasCharacterId(characterNode);
  if (!characterId) {
    return undefined;
  }

  if (characterId === unassignedCharacterId) {
    return null;
  }

  const isCurrentCharacter = characterId === registry.character.id;
  return {
    scope: "character",
    id: characterId,
    label: `캐릭터: ${isCurrentCharacter ? registry.character.name : characterId}`,
    description: isCurrentCharacter
      ? registry.character.description
      : "현재 devtool에 자원이 로드되지 않은 캐릭터 context입니다.",
  };
}

function getDraftCanvasActions(): RuntimeAction[] {
  if (editorSelection.type !== "draft" || !currentEditorGraph) {
    return [];
  }

  const graph = currentEditorGraph;
  const mappingNode = graph.nodes.find((node) => node.kind === "mapping");
  const eventNode = graph.nodes.find((node) => node.kind === "event");
  const actionSourceId = mappingNode?.id ?? eventNode?.id;
  if (!actionSourceId) {
    return [];
  }

  return graph.edges
    .filter((edge) => edge.relation === "executes" && edge.from === actionSourceId)
    .map((edge) => graph.nodes.find((node) => node.id === edge.to))
    .filter((node): node is CanvasNode => Boolean(node && (node.kind === "action" || node.kind === "group")))
    .sort((left, right) => (left.x - right.x) || (left.y - right.y))
    .map((node) => createRuntimeActionFromCanvasNode(graph, node))
    .filter((action): action is RuntimeAction => Boolean(action));
}

function getDraftCanvasConditions(): RuntimeCondition[] {
  if (editorSelection.type !== "draft" || !currentEditorGraph) {
    return [];
  }

  const graph = currentEditorGraph;
  const mappingNode = graph.nodes.find((node) => node.kind === "mapping");
  const eventNode = graph.nodes.find((node) => node.kind === "event");
  const targetIds = [mappingNode?.id, eventNode?.id].filter((nodeId): nodeId is string => Boolean(nodeId));

  return collectRuntimeConditionsForTargets(graph, targetIds);
}

function getInvalidDraftCanvasActionLabels(): string[] {
  if (editorSelection.type !== "draft" || !currentEditorGraph) {
    return [];
  }

  const graph = currentEditorGraph;
  const mappingNode = graph.nodes.find((node) => node.kind === "mapping");
  const eventNode = graph.nodes.find((node) => node.kind === "event");
  const actionSourceId = mappingNode?.id ?? eventNode?.id;
  if (!actionSourceId) {
    return [];
  }

  return graph.edges
    .filter((edge) => edge.relation === "executes" && edge.from === actionSourceId)
    .map((edge) => graph.nodes.find((node) => node.id === edge.to))
    .filter((node): node is CanvasNode => Boolean(node && (node.kind === "action" || node.kind === "group")))
    .filter((node) => !createRuntimeActionFromCanvasNode(graph, node))
    .map((node) => getCanvasNodeActionType(node) ?? node.sourceId)
    .filter((actionType): actionType is string => Boolean(actionType))
    .map((actionType) => getReadableActionLabel(actionType));
}

function createDraftMapping(): DraftMappingResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const mappingId = draftMappingIdInput.value.trim() || "new.mapping";
  const canvasEvent = getDraftCanvasEventName();
  const effectiveEvent = canvasEvent ?? selectedEvent;
  const canvasActions = getDraftCanvasActions();
  const effectiveActions = canvasActions.length > 0 ? canvasActions : draftActionFlow;
  const canvasConditions = getDraftCanvasConditions();
  const invalidCanvasActionLabels = getInvalidDraftCanvasActionLabels();
  const canvasTarget = getDraftCanvasTargetOption();
  const selectedTarget = canvasTarget === undefined ? getSelectedTargetOption() : canvasTarget;

  if (!selectedScope) {
    errors.push("대상을 선택하세요.");
  }

  if (!effectiveEvent) {
    errors.push("이벤트를 선택하세요.");
  }

  if (!selectedTarget) {
    errors.push("연결 대상을 선택하세요.");
  }

  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(mappingId)) {
    errors.push("매핑 ID는 영문, 숫자, -, _, ., : 조합으로 입력하세요.");
  }

  if (effectiveActions.length === 0 && invalidCanvasActionLabels.length > 0) {
    errors.push(`필수값이 비어 저장할 수 없는 액션: ${invalidCanvasActionLabels.join(", ")}`);
  }

  if (effectiveActions.length === 0 && invalidCanvasActionLabels.length === 0) {
    errors.push("동작 흐름에 동작을 하나 이상 추가하세요.");
  }

  if (effectiveActions.length > maxActionFlowSteps) {
    errors.push(`동작 흐름은 최대 ${maxActionFlowSteps}개까지만 저장할 수 있습니다.`);
  }

  if (!effectiveEvent) {
    return { mapping: null, runtimeRule: null, warnings, errors };
  }

  const draftName = draftMappingNameInput.value.trim();
  const mapping: NanikaMapping = {
    id: mappingId,
    event: effectiveEvent,
    actions: [...effectiveActions],
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

  if (canvasConditions.length > 0) {
    mapping.conditions = canvasConditions;
  }

  const saveIssues = getMappingSaveIssues(mapping, { requireTarget: true });
  errors.push(...getBlockingSaveIssueMessages(saveIssues));
  warnings.push(...getWarningSaveIssueMessages(saveIssues));

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

function refreshDraftResultForSave() {
  lastDraftResult = createDraftMapping();
  draftMappingPreview.textContent = JSON.stringify({
    mapping: lastDraftResult.mapping,
    runtimeRule: lastDraftResult.runtimeRule,
  }, null, 2);
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

function syncConditionOperatorVisibility() {
  const isUrlCondition = conditionTypeSelect.value === "url";
  const wasDisabled = conditionOperatorSelect.disabled;
  conditionOperatorSelect.disabled = !isUrlCondition;

  if (!isUrlCondition) {
    conditionOperatorSelect.value = "equals";
  } else if (wasDisabled && conditionOperatorSelect.value === "equals") {
    conditionOperatorSelect.value = "contains";
  }
}

async function copyText(text: string, statusElement: HTMLElement, message: string) {
  await navigator.clipboard.writeText(text);
  statusElement.textContent = message;
  statusElement.dataset.state = "ready";
}

function readConditionForm(): NanikaCondition {
  const type = conditionTypeSelect.value === "url" ? "url" : "pageId";

  return {
    id: conditionIdInput.value.trim(),
    name: conditionNameInput.value.trim(),
    scope: conditionScopeSelect.value === "character" ? "character" : "runtime",
    type,
    operator: type === "url"
      ? normalizeConditionOperator(conditionOperatorSelect.value)
      : "equals",
    value: conditionValueInput.value.trim(),
    description: conditionDescriptionInput.value.trim(),
  };
}

function renderConditions(savedPath?: string) {
  if (savedConditions.length === 0) {
    conditionList.replaceChildren(createCard("저장된 조건 없음", "URL이나 pageId 조건을 저장하면 조건 카드덱에서 재사용할 수 있어요."));
    conditionStatus.textContent = savedPath
      ? `${savedPath}에 저장된 조건이 없습니다.`
      : "저장된 조건이 없습니다.";
    conditionStatus.dataset.state = "ready";
    return;
  }

  conditionList.replaceChildren(...savedConditions.map((condition) => {
    const card = createCard(
      condition.name ?? condition.id,
      condition.description || `${getReadableConditionTypeLabel(condition)}: ${condition.value}`,
      [
        `id: ${condition.id}`,
        `scope: ${condition.scope}`,
        `${getConditionOperator(condition)} ${condition.type}: ${condition.value}`,
      ],
    );
    const controls = document.createElement("div");
    controls.className = "asset-lab-button-row";

    controls.append(
      createActionButton("수정", () => {
        conditionIdInput.value = condition.id;
        conditionNameInput.value = condition.name ?? "";
        conditionScopeSelect.value = condition.scope;
        conditionTypeSelect.value = condition.type;
        conditionOperatorSelect.value = getConditionOperator(condition);
        conditionValueInput.value = condition.value;
        conditionDescriptionInput.value = condition.description ?? "";
        syncConditionOperatorVisibility();
      }),
      createActionButton("삭제", () => {
        void deleteCondition(condition.id);
      }),
    );
    card.append(controls);

    return card;
  }));
  conditionStatus.textContent = savedPath
    ? `${savedPath}에서 ${savedConditions.length}개 조건을 불러왔어요.`
    : `${savedConditions.length}개 조건을 불러왔어요.`;
  conditionStatus.dataset.state = "ready";
}

async function loadConditions() {
  conditionStatus.textContent = "조건을 불러오는 중입니다.";
  conditionStatus.dataset.state = "ready";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/nanika-conditions"));
    const result = await readApiJson<NanikaConditionsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "조건을 불러오지 못했습니다.");
    }

    savedConditions = result.conditions ?? [];
    renderConditions(result.path);
    renderEditorPalette();
    refreshOverview();
  } catch (error) {
    savedConditions = [];
    renderConditions();
    renderEditorPalette();
    refreshOverview();
    conditionStatus.textContent = error instanceof Error ? error.message : "조건을 불러오지 못했습니다.";
    conditionStatus.dataset.state = "warning";
  }
}

async function saveCondition() {
  const condition = readConditionForm();

  if (!condition.id || !condition.value) {
    conditionStatus.textContent = "조건 ID와 조건 값을 입력하세요.";
    conditionStatus.dataset.state = "warning";
    return;
  }

  saveConditionButton.disabled = true;
  conditionStatus.textContent = "조건을 저장하는 중입니다.";

  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/save-nanika-condition"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    const result = await readApiJson<NanikaConditionsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "조건을 저장하지 못했습니다.");
    }

    savedConditions = result.conditions ?? [];
    renderConditions(result.path);
    renderEditorPalette();
    refreshOverview();
    conditionStatus.textContent = `${condition.id} 조건을 저장했어요.`;
    conditionStatus.dataset.state = "ready";
  } catch (error) {
    conditionStatus.textContent = error instanceof Error ? error.message : "조건을 저장하지 못했습니다.";
    conditionStatus.dataset.state = "warning";
  } finally {
    saveConditionButton.disabled = false;
  }
}

async function deleteCondition(conditionId: string) {
  try {
    const response = await fetch(createDevtoolsApiPath("/api/devtools/delete-nanika-condition"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conditionId }),
    });
    const result = await readApiJson<NanikaConditionsResponse>(response);

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? result.error ?? "조건을 삭제하지 못했습니다.");
    }

    savedConditions = result.conditions ?? [];
    renderConditions(result.path);
    renderEditorPalette();
    refreshOverview();
    conditionStatus.textContent = `${conditionId} 조건을 삭제했어요.`;
    conditionStatus.dataset.state = "ready";
  } catch (error) {
    conditionStatus.textContent = error instanceof Error ? error.message : "조건을 삭제하지 못했습니다.";
    conditionStatus.dataset.state = "warning";
  }
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
  clearEditorCanvasSelection(true);
  refreshDraftResultForSave();

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
    clearEditorCanvasSelection(false);
    renderEditorCanvas();
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

function loadMappingIntoDraft(mapping: NanikaMapping, options: { copy?: boolean } = {}) {
  const [firstAction] = mapping.actions;
  const firstActionType = firstAction?.type;
  const actionCatalogItem = registry.actions.find((action) => action.type === firstActionType);

  canvasStateByKey.delete("draft");
  draftParameterPrefill = {};
  draftQuickConnectionActive = false;
  selectedCanvasNodeId = null;
  selectedCanvasNodeForPopover = null;
  pendingConnectionNodeId = null;
  selectedScope = getEventScope(mapping.event);
  selectedEvent = mapping.event;
  selectedActionCategory = actionCatalogItem?.category ?? null;
  selectedActionType = firstActionType ?? null;
  draftActionFlow = [...mapping.actions];
  draftMappingIdInput.value = options.copy ? createUniqueMappingCopyId(mapping.id) : mapping.id;
  draftMappingNameInput.value = options.copy
    ? `${mapping.name ?? mapping.id} copy`
    : mapping.name ?? mapping.id;
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
  draftMappingStatus.textContent = options.copy
    ? `${mapping.id} 연결을 새 초안으로 복사했어요. ID를 확인한 뒤 저장하세요.`
    : `${mapping.id} 매핑을 편집기로 불러왔어요.`;
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
      getDisplayMappingName(mapping),
      `${mapping.event} 이벤트에서 ${mapping.actions.length}개 액션을 실행합니다.`,
      [
        `id: ${mapping.id}`,
        getMappingPortabilityLabel(mapping),
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
      createActionButton("새 연결로 복사", () => loadMappingIntoDraft(mapping, { copy: true })),
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
    title.textContent = getDisplayMappingName(mapping);

    const description = document.createElement("small");
    const actionDetail = document.createElement("small");
    actionDetail.textContent = `실행: ${mapping.actions.slice(0, 3).map((action) => getReadableActionLabel(action.type)).join(" -> ")}`;
    description.textContent = `${getReadableEventLabel(mapping.event)} → ${mapping.actions.length}개 액션 · ${getMappingPortabilityLabel(mapping)}`;

    text.append(title, description, actionDetail);
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
  renderFeatureSetCloneControls();
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
      ...mappingsOutsideFeatureSets.map((mapping) => getDisplayMappingName(mapping)),
    ]),
    ...displayFeatureSets.map((featureSet) => {
    const missingMappingIds = featureSet.mappingIds.filter((mappingId) => !savedMappings.some((mapping) => mapping.id === mappingId));
    const compatibility = checkFeatureSetCompatibility(featureSet);
    const mappingById = new Map(savedMappings.map((mapping) => [mapping.id, mapping]));
    const actionSummary = featureSet.mappingIds
      .map((mappingId) => {
        const mapping = mappingById.get(mappingId);
        if (!mapping) {
          return `${mappingId}: 연결 누락`;
        }

        return `${getDisplayMappingName(mapping)}: ${mapping.actions.slice(0, 3).map((action) => getReadableActionLabel(action.type)).join(" -> ")}`;
      });
    const card = createCard(
      featureSet.name ?? featureSet.id,
      `${featureSet.mappingIds.length}개 기능 연결을 포함합니다. ${getFeatureSetStatusText(featureSet)}`,
      [
        `id: ${featureSet.id}`,
        featureSet.mode === "character-template" ? "캐릭터 미지정 템플릿" : "캐릭터 전용 묶음",
        `호환 상태: ${compatibility.status === "ready" ? "사용 가능" : compatibility.status === "partial" ? "일부 사용 불가" : "사용 불가"}`,
        ...featureSet.mappingIds.map((mappingId) => `연결: ${mappingId}`),
        ...actionSummary.slice(0, 5).map((summary) => `실행: ${summary}`),
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
  const previousGraph = currentEditorGraph
    ? JSON.parse(JSON.stringify(currentEditorGraph)) as CanvasGraph
    : createMappingCanvasGraph(mapping, "saved");
  const nextMapping = createMappingFromCanvasState(mapping);
  const saveIssues = getMappingSaveIssues(nextMapping, { requireTarget: true });
  const blockingIssues = getBlockingSaveIssueMessages(saveIssues);

  if (blockingIssues.length > 0) {
    savedMappingStatus.textContent = blockingIssues.join(" / ");
    savedMappingStatus.dataset.state = "warning";
    mappingEditorDetail.replaceChildren(createEditorSummary(
      "저장 전 확인 필요",
      "이 연결은 파일에 저장하기 전에 보완해야 할 항목이 있습니다.",
      blockingIssues,
    ));
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
    syncSavedMappingCanvasStateAfterSave(previousGraph, nextMapping);
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

  if (editorSelection.type === "character") {
    try {
      await saveMappingsFromCharacterCanvas();
    } catch (error) {
      mappingEditorDetail.replaceChildren(createEditorSummary(
        "연결 파일 저장 실패",
        error instanceof Error ? error.message : "캐릭터 작업판의 연결을 매핑 파일에 저장하지 못했어요.",
        [currentEditorGraphKey],
      ));
    }
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
    saveCanvasStatesToStorage();
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
    loadMappingIntoDraft(mapping as NanikaMapping, { copy: true });
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
  saveConditionButton.addEventListener("click", () => {
    void saveCondition();
  });
  conditionTypeSelect.addEventListener("change", syncConditionOperatorVisibility);
  saveFeatureSetButton.addEventListener("click", () => {
    void saveFeatureSet();
  });
  featureSetIdInput.addEventListener("input", renderFeatureSetDraftPreview);
  featureSetNameInput.addEventListener("input", renderFeatureSetDraftPreview);
  featureSetCloneSourceSelect.addEventListener("change", () => {
    featureSetCloneIdInput.dataset.auto = "true";
    featureSetCloneNameInput.dataset.auto = "true";
    syncFeatureSetCloneDefaults();
    void renderFeatureSetClonePreview();
  });
  featureSetCloneCharacterSelect.addEventListener("change", () => {
    featureSetCloneIdInput.dataset.auto = "true";
    featureSetCloneNameInput.dataset.auto = "true";
    syncFeatureSetCloneDefaults();
    void renderFeatureSetClonePreview();
  });
  featureSetCloneIdInput.addEventListener("input", () => {
    featureSetCloneIdInput.dataset.auto = "false";
    void renderFeatureSetClonePreview();
  });
  featureSetCloneNameInput.addEventListener("input", () => {
    featureSetCloneNameInput.dataset.auto = "false";
    void renderFeatureSetClonePreview();
  });
  saveFeatureSetCloneButton.addEventListener("click", () => {
    void saveClonedFeatureSet();
  });
  refreshFeatureSetsButton.addEventListener("click", () => {
    void loadFeatureSets();
  });

  renderStepBuilder();
  syncConditionOperatorVisibility();
  renderFeatureSetMappingPicker();
  renderFeatureSets();
  void loadFeatureSetCloneCharacters();
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
      `조건 ${savedConditions.length}`,
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
    createCard("저장됐지만 미적용", `${savedStatus.savedOnly.length}개 연결은 저장되어 있지만 현재 preset에는 들어가 있지 않습니다.`, savedStatus.savedOnly.map((mapping) => getDisplayMappingName(mapping))),
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
void loadConditions();
void loadSavedMappings();
void loadFeatureSets();
