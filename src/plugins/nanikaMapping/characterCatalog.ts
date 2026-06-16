import type {
  CharacterDefinition,
  CharacterLayer,
  CharacterSurface,
  RuntimeScene,
} from "../../core/types.js";

export type CharacterCatalogItem = {
  id: string;
  name: string;
  description: string;
  defaultExpression: string;
  expressionCount: number;
  surfaceCount: number;
  sceneCount: number;
  hitAreaCount: number;
};

export type CharacterResourceCatalogOption = {
  id: string;
  label: string;
  description?: string;
};

export type CharacterResourceCatalog = {
  expressions: CharacterResourceCatalogOption[];
  surfaces: CharacterResourceCatalogOption[];
  scenes: CharacterResourceCatalogOption[];
  layers: CharacterResourceCatalogOption[];
  dialogueCategories: CharacterResourceCatalogOption[];
  touchParts: CharacterResourceCatalogOption[];
};

const expressionLabelMap: Record<string, string> = {
  neutral: "기본 표정",
  happy: "기쁜 표정",
  thinking: "생각하는 표정",
  surprised: "놀란 표정",
};

const dialogueCategoryLabelMap: Record<string, string> = {
  onMount: "처음 등장할 때",
  onClick: "캐릭터를 클릭했을 때",
  onTouchHead: "머리를 터치했을 때",
  onTouchFace: "얼굴을 터치했을 때",
  onTouchBody: "몸을 터치했을 때",
  onHoverRuntimeTitle: "런타임 제목에 마우스를 올렸을 때",
  onHoverEventLog: "이벤트 로그에 마우스를 올렸을 때",
  onHoverCommandMenu: "명령 메뉴에 마우스를 올렸을 때",
  onHoverExtensionCommand: "확장 기능 버튼에 마우스를 올렸을 때",
  onHoverLineCommand: "한마디 버튼에 마우스를 올렸을 때",
  onHoverHideCommand: "숨기기 버튼에 마우스를 올렸을 때",
  onRandomPrompt: "랜덤으로 먼저 말을 걸 때",
  onIdle: "가만히 대기 중일 때",
  onLine: "한마디 버튼을 눌렀을 때",
  onHide: "캐릭터를 숨길 때",
  onShow: "캐릭터를 다시 보일 때",
};

const touchPartLabelMap: Record<string, string> = {
  head: "머리",
  face: "얼굴",
  body: "몸",
};

const layerLabelMap: Record<string, string> = {
  base: "기본 이미지 영역",
  eyes: "눈 깜빡임",
  mouth: "입 모양",
};

function getReadableResourceLabel(id: string, labels: Record<string, string>) {
  return labels[id] ?? id;
}

/**
 * Converts a character definition into display-friendly catalog metadata.
 */
export function createCharacterCatalogItem(character: CharacterDefinition): CharacterCatalogItem {
  const assets = character.assets;

  return {
    id: character.profile.id,
    name: character.profile.name,
    description: character.profile.description,
    defaultExpression: character.profile.defaultExpression,
    expressionCount: Object.keys(assets?.expressions ?? {}).length,
    surfaceCount: Object.keys(assets?.surfaces ?? {}).length,
    sceneCount: Object.keys(assets?.scenes ?? {}).length,
    hitAreaCount: Object.keys(assets?.hitAreas ?? {}).length,
  };
}

function createExpressionOption(id: string): CharacterResourceCatalogOption {
  const label = getReadableResourceLabel(id, expressionLabelMap);

  return {
    id,
    label,
    description: `저장 키: ${id}`,
  };
}

function createSurfaceOption(id: string, surface: CharacterSurface): CharacterResourceCatalogOption {
  const parts = [
    surface.expression ? `표정 키: ${surface.expression}` : undefined,
    surface.visual?.type ? `기준 화면: ${surface.visual.type === "scene" ? "장면 조합" : surface.visual.type}` : undefined,
    surface.layers ? `파츠 ${Object.keys(surface.layers).length}개` : undefined,
  ].filter(Boolean);

  return {
    id,
    label: surface.alt ? `${id} - ${surface.alt}` : id,
    description: parts.length > 0 ? parts.join(" / ") : `저장 키: ${id}`,
  };
}

function createSceneOption(id: string, scene: RuntimeScene): CharacterResourceCatalogOption {
  const backgroundCount = scene.layers.filter((layer) => layer.role === "background").length;
  const propCount = scene.layers.filter((layer) => layer.role === "prop").length;
  const effectCount = scene.layers.filter((layer) => layer.role === "effect" || layer.role === "foreground").length;
  const parts = [
    `저장 키: ${id}`,
    `무대 요소 ${scene.layers.length}개`,
    backgroundCount > 0 ? `배경 ${backgroundCount}개` : undefined,
    propCount > 0 ? `소품 ${propCount}개` : undefined,
    effectCount > 0 ? `FX/전경 ${effectCount}개` : undefined,
  ].filter(Boolean);

  return {
    id,
    label: `${id} 무대 조합`,
    description: `${parts.join(" / ")} / scene 또는 scene_overlay 액션에서 사용`,
  };
}

function createLayerOption(surfaceId: string, layerId: string, layer: CharacterLayer): CharacterResourceCatalogOption {
  const label = getReadableResourceLabel(layerId, layerLabelMap);
  const parts = [
    `캐릭터 상태 ${surfaceId}`,
    layer.frames ? `프레임 ${layer.frames.length}개` : undefined,
    layer.image ? "단일 이미지" : undefined,
    layer.idleIntervalMs ? `대기 애니메이션 ${layer.idleIntervalMs}ms` : undefined,
  ].filter(Boolean);

  return {
    id: layerId,
    label: `${label} (${surfaceId})`,
    description: parts.join(" / "),
  };
}

function uniqueOptions(options: CharacterResourceCatalogOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }

    seen.add(option.id);
    return true;
  });
}

/**
 * Builds selectable character resources from the active character definition.
 */
export function createCharacterResourceCatalog(character: CharacterDefinition): CharacterResourceCatalog {
  const assets = character.assets;
  const surfaces = Object.entries(assets?.surfaces ?? {});
  const hitAreas = Object.keys(assets?.hitAreas ?? {});

  return {
    expressions: Object.keys(assets?.expressions ?? {}).map(createExpressionOption),
    surfaces: surfaces.map(([id, surface]) => createSurfaceOption(id, surface)),
    scenes: Object.entries(assets?.scenes ?? {}).map(([id, scene]) => createSceneOption(id, scene)),
    layers: uniqueOptions(surfaces.flatMap(([surfaceId, surface]) => (
      Object.entries(surface.layers ?? {}).flatMap(([layerId, layer]) => (
        layer ? [createLayerOption(surfaceId, layerId, layer)] : []
      ))
    ))),
    dialogueCategories: Object.keys(character.lines).map((id) => ({
      id,
      label: getReadableResourceLabel(id, dialogueCategoryLabelMap),
      description: `저장 키: ${id} / 대사 ${character.lines[id]?.length ?? 0}개`,
    })),
    touchParts: hitAreas.map((id) => ({
      id,
      label: getReadableResourceLabel(id, touchPartLabelMap),
      description: `저장 키: ${id} / 터치 영역`,
    })),
  };
}
