import type {
  CharacterDefinition,
  CharacterExpressionAsset,
  CharacterLayerId,
  CharacterSurface,
  CharacterVisualSource,
  ManagementMenuItem,
} from "../../core/types.js";

/**
 * Creates a readable label for a visual source used in demo menus.
 */
function getVisualSourceLabel(source: string | CharacterVisualSource) {
  return typeof source === "string"
    ? source
    : source.type === "image"
      ? source.src
      : `scene:${source.sceneId}`;
}

/**
 * Summarizes expression visual candidates without assuming they are image paths.
 */
function getExpressionAssetDescription(asset: CharacterExpressionAsset) {
  return Array.isArray(asset)
    ? `${asset.length}개 visual 후보`
    : getVisualSourceLabel(asset);
}

/**
 * Creates a compact label for one registered surface.
 */
function getSurfaceLabel(surface: CharacterSurface) {
  return `${surface.expression ?? "surface"} ${surface.id}`;
}

/**
 * Counts image frames available on one layer.
 */
function getLayerFrameCount(layer: NonNullable<CharacterSurface["layers"]>[CharacterLayerId]) {
  if (!layer) {
    return 0;
  }

  return Math.max(layer.frames?.length ?? 0, layer.image ? 1 : 0);
}

/**
 * Estimates a test playback duration from layer timing.
 */
function getLayerTestDurationMs(layer: NonNullable<CharacterSurface["layers"]>[CharacterLayerId]) {
  if (!layer) {
    return 0;
  }

  return Math.max(layer.intervalMs ?? 140, 40) * Math.max(getLayerFrameCount(layer), 1);
}

/**
 * Builds expression test menu entries from assets.expressions.
 */
function createExpressionAssetItems(character: CharacterDefinition): ManagementMenuItem {
  const expressions = Object.entries(character.assets?.expressions ?? {});

  if (expressions.length === 0) {
    return {
      id: "asset-test-expressions",
      label: "Expressions",
      description: "등록된 expression 에셋이 없어요.",
      actions: [
        { type: "log", label: "management.asset_test.expressions.empty" },
      ],
    };
  }

  return {
    id: "asset-test-expressions",
    label: "Expressions",
    description: "캐릭터 assets.expressions에 등록된 표정을 직접 확인해요.",
    children: expressions.map(([expression, asset]) => ({
      id: `asset-test-expression-${expression}`,
      label: expression,
      description: getExpressionAssetDescription(asset),
      actions: [
        { type: "change_expression" as const, expression, clearTouchedPart: true },
        { type: "log", label: `management.asset_test.expression.${expression}` },
      ],
    })),
  };
}

/**
 * Builds layer test entries under one surface.
 */
function createLayerAssetItems(surface: CharacterSurface): ManagementMenuItem[] {
  return Object.entries(surface.layers ?? {}).map(([layerId, layer]) => {
    const frameCount = getLayerFrameCount(layer);
    const depthLabel = layer?.depth === undefined ? "" : ` / depth ${layer.depth}`;

    return {
      id: `asset-test-surface-${surface.id}-layer-${layerId}`,
      label: `${layerId} (${frameCount} frame${depthLabel})`,
      description: layer?.placement
        ? `placement x ${layer.placement.x}%, y ${layer.placement.y}%, w ${layer.placement.width}%, h ${layer.placement.height}%`
        : "전체 이미지 레이어",
      actions: [
        { type: "surface", id: surface.id, startIdleLayers: false },
        ...(layerId === "base"
          ? []
          : [{
              type: "play_layer_animation" as const,
              layerId: layerId as CharacterLayerId,
              duration: getLayerTestDurationMs(layer),
            }]),
        { type: "log", label: `management.asset_test.surface.${surface.id}.layer.${layerId}` },
      ],
    };
  });
}

/**
 * Builds surface and layer test menu entries.
 */
function createSurfaceAssetItems(character: CharacterDefinition): ManagementMenuItem {
  const surfaces = Object.values(character.assets?.surfaces ?? {});

  if (surfaces.length === 0) {
    return {
      id: "asset-test-surfaces",
      label: "Surfaces / Layers",
      description: "등록된 surface 에셋이 없어요.",
      actions: [
        { type: "log", label: "management.asset_test.surfaces.empty" },
      ],
    };
  }

  return {
    id: "asset-test-surfaces",
    label: "Surfaces / Layers",
    description: "캐릭터 assets.surfaces와 그 안의 layers를 직접 확인해요.",
    children: surfaces.map((surface) => {
      const layerItems = createLayerAssetItems(surface);

      return {
        id: `asset-test-surface-${surface.id}`,
        label: getSurfaceLabel(surface),
        description: surface.alt ?? `${character.profile.name} surface ${surface.id}`,
        children: [
          {
            id: `asset-test-surface-${surface.id}-show`,
            label: "Surface 표시",
            description: surface.image ?? surface.layers?.base?.image ?? "base 이미지 없음",
            actions: [
              { type: "surface", id: surface.id },
              { type: "log", label: `management.asset_test.surface.${surface.id}` },
            ],
          },
          ...layerItems,
        ],
      };
    }),
  };
}

/**
 * Builds the top-level asset test menu item.
 */
function createAssetTestMenuItem(character: CharacterDefinition | undefined): ManagementMenuItem {
  if (!character?.assets) {
    return {
      id: "asset-test",
      label: "에셋 테스트",
      description: "현재 캐릭터에 등록된 assets 정보가 있는지 확인해요.",
      actions: [
        { type: "log", label: "management.asset_test.empty" },
      ],
    };
  }

  return {
    id: "asset-test",
    label: "에셋 테스트",
    description: "캐릭터 assets 안의 expressions, surfaces, layers를 직접 확인해요.",
    children: [
      createExpressionAssetItems(character),
      createSurfaceAssetItems(character),
    ],
  };
}

/**
 * Creates demo menu items for character motion, visibility, and developer tools.
 */
export function createCharacterMenuItems(character?: CharacterDefinition): ManagementMenuItem[] {
  return [
    {
      id: "jump",
      label: "점프",
      description: "캐릭터 sprite 애니메이션을 실행해요.",
      actions: [
        { type: "play_animation", animation: "jump", duration: 460 },
        { type: "speak_text", text: "가볍게 뛰어볼게요." },
        { type: "log", label: "management.animation.jump" },
      ],
    },
    createAssetTestMenuItem(character),
    {
      id: "change-character",
      label: "캐릭터 변경",
      description: "호스트 앱에 캐릭터 교체 요청을 보냅니다. 앱은 이 이벤트를 받아 런타임을 다시 생성할 수 있어요.",
      actions: [
        {
          type: "request_character_change",
          characterId: character?.profile.id,
          reason: "management_menu",
        },
        { type: "speak_text", text: "캐릭터 변경 요청을 보냈어요." },
        { type: "log", label: "management.character_change.request" },
      ],
    },
    {
      id: "hide",
      label: "숨기기",
      description: "캐릭터를 잠시 숨기고 배지로 다시 부를 수 있어요.",
      actions: [
        { type: "toggle_hidden" },
        { type: "speak", category: "onHide" },
        { type: "log", label: "management.hide" },
      ],
    },
    {
      id: "close",
      label: "나가기",
      description: "열려 있는 메뉴를 닫아요.",
      actions: [
        { type: "close_management_menu" },
        { type: "change_expression", expression: "neutral" },
        { type: "speak_text", text: "메뉴를 닫을게요." },
        { type: "log", label: "management.close" },
      ],
    },
  ];
}
