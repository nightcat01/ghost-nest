import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const port = Number(process.env.GHOSTNEST_VERIFY_PORT ?? 4183);
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = path.join(os.tmpdir(), "ghostnest-ui-check");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 10000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready or the timeout expires.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function startServer() {
  return spawn(process.execPath, ["server.cjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

async function stopServer(server) {
  if (!server.killed) {
    server.kill();
  }

  await wait(250);
}

async function capturePage(page, name) {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${name}.png`);

  await page.screenshot({
    path: filePath,
    fullPage: false,
  });

  return filePath;
}

async function verifyMappingEditor(page) {
  await page.goto(`${baseUrl}/dev-nanika-mapping.html`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });

  const overviewMetrics = await page.evaluate(() => ({
    title: document.title,
    activeTab: document.querySelector("[data-view-target][data-active='true']")?.textContent?.trim(),
    activeEditorMode: document.querySelector("[data-editor-mode-target][data-active='true'] strong")?.textContent?.trim(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    hasConnectionMap: Boolean(document.querySelector("#connectionMap")),
    hasEditorPanel: Boolean(document.querySelector("#mappingEditorCanvas")),
    editorHelpText: document.querySelector("#mappingEditorHelp")?.textContent?.trim() ?? "",
    initialCharacterCanvas: document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='character']")?.textContent?.includes("리네") ?? false,
    initialRuntimeCanvas: Boolean(document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='runtime']")),
    initialResourceGroupCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group']").length,
    initialCanvasEdgeCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-edges path[marker-end]").length,
    initialStatsCount: document.querySelectorAll("#mappingEditorStats span").length,
    initialZoomText: document.querySelector("#mappingEditorStats")?.textContent ?? "",
    hasFlowBoard: Boolean(document.querySelector("#mappingFlowBoard")),
    overviewAuxGraphVisible: Boolean(document.querySelector("#mappingGraphPanel")?.offsetParent),
    flowBoardColumnCount: document.querySelectorAll("#mappingFlowBoard .nanika-flow-board-column").length,
    flowBoardNodeCount: document.querySelectorAll("#mappingFlowBoard .nanika-flow-board-node").length,
    hasGraphPanel: Boolean(document.querySelector("#mappingGraphPanel")),
    graphColumnCount: document.querySelectorAll("#mappingGraphViewport .nanika-graph-column").length,
    graphResourceNodeCount: document.querySelectorAll("#mappingGraphViewport .nanika-graph-node[data-kind='resource']").length,
    graphCharacterText: document.querySelector("#mappingGraphViewport")?.textContent?.includes("캐릭터: 리네") ?? false,
    hasMermaidSource: Boolean(document.querySelector(".nanika-mermaid-source #mappingMermaidPreview")),
    hasFeatureSetTab: Boolean(document.querySelector("[data-view-target='feature-sets']")),
    hasFeatureSetMode: Boolean(document.querySelector("[data-editor-mode-target='feature-sets']")),
    topModeTabCount: document.querySelectorAll("[data-view-target='create'], [data-view-target='saved'], [data-view-target='feature-sets']").length,
    editorModeCount: document.querySelectorAll("[data-editor-mode-target]").length,
    canvasHeight: document.querySelector("#mappingEditorCanvas")?.getBoundingClientRect().height ?? 0,
    paletteHeight: document.querySelector(".nanika-editor-palette")?.getBoundingClientRect().height ?? 0,
    paletteOnRight: (() => {
      const canvas = document.querySelector("#mappingEditorCanvas")?.getBoundingClientRect();
      const palette = document.querySelector(".nanika-editor-palette")?.getBoundingClientRect();
      return Boolean(canvas && palette && palette.left > canvas.left);
    })(),
    paletteScrollsInternally: (() => {
      const deck = document.querySelector("#mappingPaletteDeck");
      return Boolean(deck && deck.scrollHeight > deck.clientHeight);
    })(),
    canvasNodeOverlapCount: (() => {
      const nodes = Array.from(document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node"))
        .map((node) => node.getBoundingClientRect());
      let overlaps = 0;
      for (let index = 0; index < nodes.length; index += 1) {
        for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
          const a = nodes[index];
          const b = nodes[nextIndex];
          const separated = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          if (!separated) {
            overlaps += 1;
          }
        }
      }
      return overlaps;
    })(),
    hasMermaidPreview: Boolean(document.querySelector("#mappingMermaidPreview")),
    mermaidIncludesRine: document.querySelector("#mappingMermaidPreview")?.textContent?.includes("rine.") ?? false,
    mermaidHasFeatureSetEdge: /feature_set|세트:|템플릿:|포함/.test(document.querySelector("#mappingMermaidPreview")?.textContent ?? ""),
    materialFlowArrowCount: document.querySelectorAll("#materialMap .nanika-result-flow-arrow").length,
    materialGroupCount: document.querySelectorAll("#materialMap .nanika-material-group").length,
    ruleCardCount: document.querySelectorAll("#mappingList .nanika-mapping-card").length,
  }));
  await page.locator("#editorZoomInButton").click();
  const editorZoomMetrics = await page.evaluate(() => ({
    zoomText: document.querySelector("#mappingEditorStats")?.textContent ?? "",
    viewportWidth: document.querySelector("#mappingEditorCanvas .nanika-paint-viewport")?.getBoundingClientRect().width ?? 0,
    canvasWidth: document.querySelector("#mappingEditorCanvas .nanika-paint-canvas")?.getBoundingClientRect().width ?? 0,
  }));
  await page.locator("#editorZoomResetButton").click();
  await page.locator("#mappingPaletteTabs button").first().click();
  const characterPaletteMetrics = await page.evaluate(() => ({
    hasCharacterTab: Array.from(document.querySelectorAll("#mappingPaletteTabs button"))
      .some((button) => button.textContent?.trim() === "캐릭터"),
    characterCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='character']").length,
    characterDeckText: document.querySelector("#mappingPaletteDeck")?.textContent ?? "",
  }));
  await page.locator("#mappingPaletteDeck .nanika-palette-card[data-kind='character']").first().click();
  const characterSelectionMetrics = await page.evaluate(() => ({
    characterNodeSelected: document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='character'][data-selected='true']") !== null,
    hasCharacterCanvasNode: document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='character']") !== null,
  }));
  const nodeCountBeforeDelete = await page.locator("#mappingEditorCanvas .nanika-paint-node").count();
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group']").first().click();
  const defaultNodeDeleteButtonEnabled = await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").filter({ hasText: "삭제" }).first().isEnabled();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").filter({ hasText: "삭제" }).first().click();
  const defaultDeleteMetrics = await page.evaluate((beforeCount) => ({
    deleteButtonWasEnabled: true,
    nodeRemoved: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node").length < beforeCount,
    removedGroupMissing: !Array.from(document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group']")).some((node) => node.textContent?.includes("Expressions")),
  }), nodeCountBeforeDelete);
  const overviewScreenshot = await capturePage(page, "dev-nanika-mapping-overview");
  await page.locator("[data-view-target='catalog']").click();
  const catalogSummaryMetrics = await page.evaluate(() => ({
    hasCatalogTabs: document.querySelectorAll("[data-catalog-target]").length === 4,
    hasGraphTab: Boolean(document.querySelector("[data-catalog-target='graph']")),
    activeCatalogTab: document.querySelector("[data-catalog-target][data-active='true']")?.getAttribute("data-catalog-target"),
    visibleCatalogSections: Array.from(document.querySelectorAll("[data-catalog-section]")).filter((section) => !section.hidden).length,
    editorPanelHidden: document.querySelector(".nanika-editor-panel")?.hidden ?? false,
    summaryVisible: !document.querySelector("[data-catalog-section='summary']")?.hidden,
    flowHidden: document.querySelector("[data-catalog-section='flow']")?.hidden ?? false,
    graphHidden: document.querySelector("[data-catalog-section='graph']")?.hidden ?? false,
  }));
  await page.locator("[data-catalog-target='flow']").click();
  await page.waitForTimeout(100);
  const flowScreenshot = await capturePage(page, "dev-nanika-mapping-flow");
  const catalogFlowMetrics = await page.evaluate(() => ({
    activeCatalogTab: document.querySelector("[data-catalog-target][data-active='true']")?.getAttribute("data-catalog-target"),
    visibleCatalogSections: Array.from(document.querySelectorAll("[data-catalog-section]")).filter((section) => !section.hidden).length,
    editorPanelHidden: document.querySelector(".nanika-editor-panel")?.hidden ?? false,
    flowBoardIsScrollable: (() => {
      const board = document.querySelector("#mappingFlowBoard");
      return Boolean(board && board.clientHeight > 0 && board.scrollHeight > board.clientHeight);
    })(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await page.locator("[data-catalog-target='list']").click();
  const catalogListBeforeSelectMetrics = await page.evaluate(() => ({
    editorPanelHidden: document.querySelector(".nanika-editor-panel")?.hidden ?? true,
    saveHidden: document.querySelector("#editorSaveButton")?.offsetParent === null,
    paletteHidden: getComputedStyle(document.querySelector(".nanika-editor-palette")).display === "none",
    readonlyCanvas: document.querySelector("#mappingEditorCanvas .nanika-paint-canvas")?.getAttribute("data-readonly") === "true",
    hasZoomControls: ["editorZoomOutButton", "editorZoomInButton", "editorZoomResetButton"]
      .every((id) => document.getElementById(id)?.offsetParent !== null),
    copyHidden: document.querySelector("#editorCopyGraphButton")?.offsetParent === null,
    hasCatalogMaterialMap: !document.querySelector("#catalogMaterialMap")?.closest("section")?.hidden,
  }));
  await page.locator("#mappingList .asset-small-button").first().click();
  const editorAppliedMetrics = await page.evaluate(() => ({
    hasSelectedFlow: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node").length >= 3,
    hasPaintEdges: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-edges path").length >= 2,
    loadButtonDisabled: document.querySelector("#editorLoadDraftButton")?.disabled ?? false,
    addToSetDisabled: document.querySelector("#editorAddToFeatureSetButton")?.disabled ?? false,
    saveHidden: document.querySelector("#editorSaveButton")?.offsetParent === null,
    paletteHidden: getComputedStyle(document.querySelector(".nanika-editor-palette")).display === "none",
    readonlyCanvas: document.querySelector("#mappingEditorCanvas .nanika-paint-canvas")?.getAttribute("data-readonly") === "true",
    hasNodePopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    editorFocused: document.querySelector(".nanika-editor-panel")?.getAttribute("data-focused") === "true",
  }));

  await page.locator("[data-view-target='overview']").click();
  await page.locator("[data-editor-mode-target='create']").click();
  const createMetrics = await page.evaluate(() => ({
    activeTab: document.querySelector("[data-view-target][data-active='true']")?.textContent?.trim(),
    activeEditorMode: document.querySelector("[data-editor-mode-target][data-active='true'] strong")?.textContent?.trim(),
    visibleSections: Array.from(document.querySelectorAll(".nanika-view-section")).filter((section) => !section.hidden).length,
    hasTargetSelect: Boolean(document.querySelector("#draftTargetSelect")),
    hasWrapButtons: ["wrapSequenceButton", "wrapParallelButton", "wrapRandomButton"]
      .every((id) => Boolean(document.getElementById(id))),
    hasDraftFlowPreview: Boolean(document.querySelector("#draftFlowPreview .nanika-result-flow")),
    editorShowsDraft: Boolean(document.querySelector("#mappingEditorCanvas .nanika-editor-summary, #mappingEditorCanvas .nanika-paint-canvas")),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));

  await page.locator("[data-editor-mode-target='saved']").click();
  await page.locator("#mappingPaletteDeck .nanika-palette-card").first().click();
  const savedEditorBeforeSetMetrics = await page.evaluate(() => ({
    addToSetEnabled: !(document.querySelector("#editorAddToFeatureSetButton")?.disabled ?? true),
    selectedNodeCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node").length,
    paletteTabCount: document.querySelectorAll("#mappingPaletteTabs button").length,
    paletteCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card").length,
    visibleSections: Array.from(document.querySelectorAll(".nanika-view-section")).filter((section) => !section.hidden).length,
  }));
  const sceneActionNode = page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='action']").filter({ hasText: "무대 조합" }).first();
  await sceneActionNode.click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
  const sceneActionResourceFilterMetrics = await page.evaluate(() => ({
    hasSceneActionPopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    visibleResourceKinds: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card"))
      .map((card) => card.getAttribute("data-resource-kind"))
      .filter(Boolean),
    visibleCardText: document.querySelector("#mappingPaletteDeck")?.textContent ?? "",
  }));
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").last().click();
  await page.locator("#mappingPaletteTabs button").filter({ hasText: "액션" }).click();
  const nodeCountBeforeDrop = await page.locator("#mappingEditorCanvas .nanika-paint-node").count();
  await page.locator("#mappingPaletteDeck .nanika-palette-card").first().dragTo(page.locator("#mappingEditorCanvas"), {
    targetPosition: { x: 460, y: 250 },
  });
  const paletteDropMetrics = await page.evaluate((beforeCount) => ({
    nodeAdded: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node").length > beforeCount,
    hasDroppedAction: Boolean(document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='action'], #mappingEditorCanvas .nanika-paint-node[data-kind='group']")),
  }), nodeCountBeforeDrop);
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='mapping']").first().click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").filter({ hasText: "연결 시작" }).first().click();
  const filteredPaletteMetrics = await page.evaluate(() => ({
    hasPopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    visiblePaletteKinds: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card")).map((card) => card.getAttribute("data-kind")),
  }));
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='action']").last().click();
  const manualConnectionMetrics = await page.evaluate(() => ({
    edgeCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-edges path").length,
    canCopyGraph: !(document.querySelector("#editorCopyGraphButton")?.disabled ?? true),
  }));
  const dragMetrics = await page.evaluate(() => {
    const node = document.querySelector("#mappingEditorCanvas .nanika-paint-node");
    if (!node) {
      return { moved: false };
    }
    const before = node.getBoundingClientRect();
    return { beforeLeft: before.left, beforeTop: before.top };
  });
  await page.locator("#mappingEditorCanvas .nanika-paint-node").first().dragTo(page.locator("#mappingEditorCanvas"), {
    targetPosition: { x: 420, y: 180 },
  });
  const dragAfterMetrics = await page.evaluate((before) => {
    const node = document.querySelector("#mappingEditorCanvas .nanika-paint-node");
    if (!node || typeof before.beforeLeft !== "number") {
      return { moved: false };
    }
    const after = node.getBoundingClientRect();
    return {
      moved: Math.abs(after.left - before.beforeLeft) > 8 || Math.abs(after.top - before.beforeTop) > 8,
      selected: node.getAttribute("data-selected") === "true",
    };
  }, dragMetrics);
  await page.locator("#editorAddToFeatureSetButton").click();
  const savedMetrics = await page.evaluate(() => ({
    activeTab: document.querySelector("[data-view-target][data-active='true']")?.textContent?.trim(),
    hasSnippetFeatureSetPicker: Boolean(document.querySelector("#snippetFeatureSetPicker")),
    hasSavedFlowBoard: Boolean(document.querySelector("#savedFlowBoard")),
    resultFlowCount: document.querySelectorAll(".nanika-result-flow").length,
    savedCardCount: document.querySelectorAll("#savedMappingList .nanika-mapping-card").length,
    savedGroupCount: document.querySelectorAll("#savedMappingList .nanika-saved-group").length,
    editorShowsSaved: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node").length >= 3,
    movedToFeatureSet: document.querySelector("[data-editor-mode-target][data-active='true'] strong")?.textContent?.trim() === "기능 묶음",
    visibleSections: Array.from(document.querySelectorAll(".nanika-view-section")).filter((section) => !section.hidden).length,
    featureSetCandidateChecked: document.querySelectorAll("#featureSetMappingPicker input[type='checkbox']:checked").length > 0,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));

  await page.locator("[data-editor-mode-target='feature-sets']").click();
  await page.locator("#mappingPaletteDeck .nanika-palette-card").first().click();
  const featureSetMetrics = await page.evaluate(() => ({
    activeTab: document.querySelector("[data-view-target][data-active='true']")?.textContent?.trim(),
    activeEditorMode: document.querySelector("[data-editor-mode-target][data-active='true'] strong")?.textContent?.trim(),
    hasFeatureSetForm: Boolean(document.querySelector("#featureSetIdInput")),
    hasFeatureSetPicker: Boolean(document.querySelector("#featureSetMappingPicker")),
    hasFeatureSetPreview: Boolean(document.querySelector("#featureSetPreview")),
    hasFeatureSetFlowBoard: Boolean(document.querySelector("#featureSetFlowBoard")),
    featureSetOptionHasDescription: Boolean(document.querySelector("#featureSetMappingPicker .nanika-feature-set-option small")),
    featureSetContainArrowCount: document.querySelectorAll("#featureSetList .nanika-result-flow[data-relation='contains'] .nanika-result-flow-arrow").length,
    editorShowsFeatureSet: document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='feature-set']") !== null,
    hasGenericTemplate: document.querySelector("#featureSetList")?.textContent?.includes("캐릭터 미지정") ?? false,
    hasCompatibilityStatus: document.querySelector("#featureSetList")?.textContent?.includes("호환 상태") ?? false,
    visibleSections: Array.from(document.querySelectorAll(".nanika-view-section")).filter((section) => !section.hidden).length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));

  await page.locator("[data-view-target='catalog']").click();
  await page.locator("[data-catalog-target='list']").click();
  await page.locator("#characterList .asset-small-button").first().click();
  const catalogMetrics = await page.evaluate(() => ({
    activeTab: document.querySelector("[data-view-target][data-active='true']")?.textContent?.trim(),
    editorShowsCharacter: document.querySelector("#mappingEditorHelp")?.textContent?.includes("캐릭터 중심 작업판") ?? false,
    hasCharacterCanvasNode: document.querySelector("#mappingEditorCanvas .nanika-paint-node[data-kind='character']") !== null,
    hasResourceGroupNodes: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group']").length >= 4,
    paletteHidden: getComputedStyle(document.querySelector(".nanika-editor-palette")).display === "none",
    readonlyCanvas: document.querySelector("#mappingEditorCanvas .nanika-paint-canvas")?.getAttribute("data-readonly") === "true",
    saveHidden: document.querySelector("#editorSaveButton")?.offsetParent === null,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));

  const screenshot = await capturePage(page, "dev-nanika-mapping");

  return {
    overviewMetrics,
    editorZoomMetrics,
    defaultDeleteMetrics: {
      ...defaultDeleteMetrics,
      deleteButtonWasEnabled: defaultNodeDeleteButtonEnabled,
    },
    characterPaletteMetrics,
    characterSelectionMetrics,
    editorAppliedMetrics,
    catalogSummaryMetrics,
    overviewScreenshot,
    flowScreenshot,
    catalogFlowMetrics,
    catalogListBeforeSelectMetrics,
    createMetrics,
    savedEditorBeforeSetMetrics,
    sceneActionResourceFilterMetrics,
    paletteDropMetrics,
    filteredPaletteMetrics,
    manualConnectionMetrics,
    dragAfterMetrics,
    savedMetrics,
    featureSetMetrics,
    catalogMetrics,
    screenshot,
  };
}

async function verifySceneEditor(page) {
  await page.goto(`${baseUrl}/dev-character-scene.html`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector("#sceneList");
  const smokeSceneId = "codex-ui-smoke-scene";

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

  await page.locator("#sceneSelect").selectOption("__new_scene__");
  await page.locator("#sceneIdInput").fill(smokeSceneId);
  await page.locator("#defaultSceneInput").uncheck();
  await page.locator("#backgroundColorInput").fill("#ffffff");
  await page.locator("#characterDepthInput").fill("20");
  await page.locator("#saveSceneButton").click();
  await page.waitForFunction((sceneId) => (
    Array.from(document.querySelectorAll("#sceneSelect option")).some((option) => option.value === sceneId)
  ), smokeSceneId);
  await page.locator("#sceneSelect").selectOption(smokeSceneId);
  const savedSmokeSceneVisible = await page.evaluate((sceneId) => (
    Array.from(document.querySelectorAll("#sceneSelect option")).some((option) => option.value === sceneId)
      && Boolean(document.querySelector(`#sceneList .asset-scene-list-card[data-selected="true"]`))
  ), smokeSceneId);
  await page.locator("#deleteSceneButton").click();
  await page.waitForFunction((sceneId) => (
    !Array.from(document.querySelectorAll("#sceneSelect option")).some((option) => option.value === sceneId)
  ), smokeSceneId);

  const metrics = await page.evaluate((savedVisible) => ({
    title: document.title,
    hasSceneSelect: Boolean(document.querySelector("#sceneSelect")),
    hasSceneList: Boolean(document.querySelector("#sceneList")),
    sceneCardCount: document.querySelectorAll("#sceneList .asset-scene-list-card").length,
    hasDemoSceneOption: Array.from(document.querySelectorAll("#sceneSelect option"))
      .some((option) => option.value === "rine-demo-scene"),
    hasDeleteButton: Boolean(document.querySelector("#deleteSceneButton")),
    previewHasNoSaveActions: document.querySelectorAll(".asset-scene-summary [data-scene-action-proxy]").length === 0,
    previewPanelOnRight: (() => {
      const formPanel = document.querySelector(".asset-scene-tool-grid > .asset-lab-panel")?.getBoundingClientRect();
      const previewPanel = document.querySelector(".asset-scene-tool-grid > .asset-lab-output-panel")?.getBoundingClientRect();

      return Boolean(formPanel && previewPanel && previewPanel.left > formPanel.left);
    })(),
    previewHasStableArea: (document.querySelector("#scenePreview")?.getBoundingClientRect().height ?? 0) >= 320,
    savedSmokeSceneVisible: savedVisible,
    smokeSceneDeleted: !Array.from(document.querySelectorAll("#sceneSelect option"))
      .some((option) => option.value === "codex-ui-smoke-scene"),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }), savedSmokeSceneVisible);

  const screenshot = await capturePage(page, "dev-character-scene");

  return {
    metrics,
    screenshot,
  };
}

async function verifyLayerEditor(page) {
  await page.goto(`${baseUrl}/dev-assets-layer.html`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector("#surfaceSelect");
  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll("#surfaceSelect option"))
      .some((option) => option.value && option.value !== "__new_surface__")
  ));

  const surfaceValue = await page.evaluate(() => (
    Array.from(document.querySelectorAll("#surfaceSelect option"))
      .map((option) => option.value)
      .find((value) => value && value !== "__new_surface__") ?? ""
  ));

  await page.locator("#surfaceSelect").selectOption(surfaceValue);
  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll("#existingLayerSelect option"))
      .some((option) => option.value && option.value !== "__new_layer__")
  ));
  const layerValue = await page.evaluate(() => (
    Array.from(document.querySelectorAll("#existingLayerSelect option"))
      .map((option) => option.value)
      .find((value) => value && value !== "__new_layer__") ?? ""
  ));
  await page.locator("#existingLayerSelect").selectOption(layerValue);
  await page.waitForFunction(() => document.querySelector("#layerPreviewSection")?.hidden === false);

  const metrics = await page.evaluate(() => {
    const formPanel = document.querySelector(".asset-layer-tool-grid > .asset-lab-panel")?.getBoundingClientRect();
    const previewPanel = document.querySelector("#layerPreviewSection")?.getBoundingClientRect();
    const preview = document.querySelector("#layerPreview")?.getBoundingClientRect();
    const editSection = document.querySelector("#layerEditSection")?.getBoundingClientRect();
    const controlSection = document.querySelector("#layerControlSection")?.getBoundingClientRect();

    return {
      title: document.title,
      hasSurfaceSelect: Boolean(document.querySelector("#surfaceSelect")),
      hasPreviewPanel: document.querySelector("#layerPreviewSection")?.hidden === false,
      hasPlaybackControls: document.querySelectorAll(".asset-layer-playback-controls button").length === 3,
      hasZoomControls: Boolean(document.querySelector("#previewZoomOutButton"))
        && Boolean(document.querySelector("#previewSizeInput"))
        && Boolean(document.querySelector("#previewZoomInButton")),
      hasSaveActions: Boolean(document.querySelector("#saveLayerConfigButton"))
        && Boolean(document.querySelector("#deleteLayerConfigButton")),
      hasStepwiseReveal: document.querySelector("#layerEditSection")?.hidden === false
        && document.querySelector("#layerControlSection")?.hidden === false,
      previewOnRight: Boolean(formPanel && previewPanel && previewPanel.left > formPanel.left),
      previewHasStableArea: Boolean(preview && preview.height >= 320),
      controlsOnLeft: Boolean(formPanel && editSection && controlSection
        && editSection.left >= formPanel.left
        && controlSection.left >= formPanel.left
        && editSection.right <= formPanel.right + 1
        && controlSection.right <= formPanel.right + 1),
      previewPanelHasNoControls: document.querySelectorAll("#layerPreviewSection button, #layerPreviewSection select, #layerPreviewSection input").length === 0,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  const screenshot = await capturePage(page, "dev-assets-layer");

  return {
    metrics,
    screenshot,
  };
}

async function verifyCropEditor(page) {
  await page.goto(`${baseUrl}/dev-assets-crop.html`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector("#cropPreview");
  const initialStepMetrics = await page.evaluate(() => ({
    adjustHiddenBeforeImage: document.querySelector("#cropAdjustSection")?.hidden === true,
    actionHiddenBeforeImage: document.querySelector("#cropActionSection")?.hidden === true,
  }));
  await page.locator("#baseImageInput").setInputFiles(path.join(root, "src/characters/rine/layer_org/rine.png"));
  await page.waitForFunction(() => document.querySelector("#cropAdjustSection")?.hidden === false);

  const metrics = await page.evaluate(() => {
    const formPanel = document.querySelector(".asset-crop-tool-grid > .asset-lab-panel")?.getBoundingClientRect();
    const previewPanel = document.querySelector(".asset-crop-tool-grid > .asset-lab-output-panel")?.getBoundingClientRect();
    const preview = document.querySelector("#cropPreview")?.getBoundingClientRect();

    return {
      title: document.title,
      hasRecipeSelect: Boolean(document.querySelector("#partRecipeSelect")),
      hasRegionInputs: document.querySelectorAll(".asset-lab-region-grid input").length >= 4,
      hasDownloadAction: Boolean(document.querySelector("#downloadCropButton")),
      hasStepwiseReveal: document.querySelector("#cropAdjustSection")?.hidden === false
        && document.querySelector("#cropActionSection")?.hidden === false,
      previewOnRight: Boolean(formPanel && previewPanel && previewPanel.left > formPanel.left),
      previewHasStableArea: Boolean(preview && preview.height >= 420),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  const screenshot = await capturePage(page, "dev-assets-crop");

  return {
    initialStepMetrics,
    metrics,
    screenshot,
  };
}

async function verifyCharacterEditors(page) {
  const pages = [
    "dev-character.html",
    "dev-character-create.html",
    "dev-character-expression.html",
    "dev-character-set.html",
    "dev-assets-layer.html",
    "dev-character-composition.html",
    "dev-character-scene.html",
  ];
  const results = [];

  for (const pageName of pages) {
    await page.goto(`${baseUrl}/${pageName}`, { waitUntil: "load" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(150);

    results.push(await page.evaluate((name) => ({
      page: name,
      title: document.title,
      hasHeading: Boolean(document.querySelector("h1")),
      hasMain: Boolean(document.querySelector("main")),
      hasConceptMap: name === "dev-character.html"
        ? document.querySelectorAll(".asset-character-concept-map article").length >= 5
        : true,
      hasReadinessMap: name === "dev-character.html"
        ? document.querySelectorAll(".asset-character-readiness-map article").length >= 7
        : true,
      hasResultMap: [
        "dev-character-create.html",
        "dev-character-expression.html",
        "dev-character-set.html",
        "dev-assets-layer.html",
        "dev-character-scene.html",
      ].includes(name)
        ? document.querySelectorAll(".asset-step-result-map article").length >= 3
        : true,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    }), pageName));
  }

  return results;
}

async function verifyRuntimeDemo(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-runtime-test-action='rine-demo-scene']").click();
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-id") === "rine-demo-scene");
  await page.locator("[data-runtime-test-action='scene-overlay']").click();
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "1");
  const overlayVisible = await page.evaluate(() => Boolean(document.querySelector(".scene-layer-root .scene-layer[data-scene-overlay-slot='demo-overlay']")));
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "0");

  const metrics = await page.evaluate((wasOverlayVisible) => ({
    title: document.title,
    hasStage: Boolean(document.querySelector("#characterStage")),
    hasSprite: Boolean(document.querySelector("#characterSprite")),
    hasSpeechBalloon: Boolean(document.querySelector("#speechBalloon")),
    sceneId: document.querySelector("#characterStage")?.getAttribute("data-scene-id"),
    hasSceneLayer: Boolean(document.querySelector(".scene-layer-root .scene-layer[data-layer-id='desk-line']")),
    overlayVisible: wasOverlayVisible,
    overlayRemoved: document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "0",
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  }), overlayVisible);

  const screenshot = await capturePage(page, "runtime-demo");

  return {
    metrics,
    screenshot,
  };
}

function assertMetric(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const server = startServer();
  const stderrChunks = [];

  server.stderr.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  try {
    await waitForHttp(`${baseUrl}/dev-nanika-mapping.html`);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      const mapping = await verifyMappingEditor(page);
      const sceneEditor = await verifySceneEditor(page);
      const layerEditor = await verifyLayerEditor(page);
      const cropEditor = await verifyCropEditor(page);
      const characterEditors = await verifyCharacterEditors(page);
      const runtime = await verifyRuntimeDemo(page);

      assertMetric(mapping.overviewMetrics.activeTab === "작업판", "Mapping workspace tab did not load.");
      assertMetric(mapping.overviewMetrics.hasConnectionMap, "Connection map is missing.");
      assertMetric(mapping.overviewMetrics.hasEditorPanel, "Shared mapping editor panel is missing.");
      assertMetric(mapping.overviewMetrics.initialRuntimeCanvas, "Default editor canvas does not start from runtime.");
      assertMetric(mapping.overviewMetrics.initialCharacterCanvas, "Default editor canvas does not show the actual Rine character.");
      assertMetric(mapping.overviewMetrics.initialResourceGroupCount >= 4, "Default editor canvas does not split character resources into groups.");
      assertMetric(mapping.overviewMetrics.initialCanvasEdgeCount > 0, "Default editor canvas edges do not render arrow markers.");
      assertMetric(mapping.overviewMetrics.initialStatsCount >= 6, "Editor summary stats are missing.");
      assertMetric(mapping.overviewMetrics.initialZoomText.includes("100%"), "Editor summary stats do not show zoom state.");
      assertMetric(!mapping.overviewMetrics.overviewAuxGraphVisible, "Auxiliary graph should not be visible on the main editor workspace.");
      assertMetric(mapping.editorZoomMetrics.zoomText.includes("110%"), "Editor zoom-in control did not update summary zoom state.");
      assertMetric(mapping.editorZoomMetrics.canvasWidth > mapping.editorZoomMetrics.viewportWidth * 0.95, "Editor zoom-in control did not scale the canvas.");
      assertMetric(mapping.defaultDeleteMetrics.deleteButtonWasEnabled, "Existing/default canvas cards should be deletable.");
      assertMetric(mapping.defaultDeleteMetrics.nodeRemoved, "Deleting an existing/default canvas card did not remove it from the board.");
      assertMetric(mapping.defaultDeleteMetrics.removedGroupMissing, "Deleted default canvas card is still visible.");
      assertMetric(mapping.characterPaletteMetrics.hasCharacterTab, "Character selection category is missing from the card deck.");
      assertMetric(mapping.characterPaletteMetrics.characterCardCount >= 1, "Character selection cards are missing from the editor deck.");
      assertMetric(mapping.characterSelectionMetrics.hasCharacterCanvasNode, "Selecting a character did not keep the character graph visible.");
      assertMetric(mapping.characterSelectionMetrics.characterNodeSelected, "Selected character was not highlighted on the editor canvas.");
      assertMetric(mapping.editorAppliedMetrics.hasSelectedFlow, "Applied mapping selection did not render in the shared editor.");
      assertMetric(mapping.editorAppliedMetrics.hasPaintEdges, "Applied mapping graph edges are missing.");
      assertMetric(mapping.editorAppliedMetrics.loadButtonDisabled, "Catalog mapping view should not expose draft loading.");
      assertMetric(mapping.editorAppliedMetrics.addToSetDisabled, "Catalog mapping view should not expose feature-set editing.");
      assertMetric(mapping.editorAppliedMetrics.saveHidden, "Catalog mapping view should hide save controls.");
      assertMetric(mapping.editorAppliedMetrics.paletteHidden, "Catalog mapping view should hide the card deck.");
      assertMetric(mapping.editorAppliedMetrics.readonlyCanvas, "Catalog mapping diagram should be readonly.");
      assertMetric(!mapping.editorAppliedMetrics.hasNodePopover, "Readonly catalog diagram should not open node action popovers.");
      assertMetric(mapping.editorAppliedMetrics.editorFocused, "Selecting a mapping did not focus the shared editor panel.");
      assertMetric(mapping.catalogSummaryMetrics.hasCatalogTabs, "Catalog purpose tabs are missing.");
      assertMetric(!mapping.catalogSummaryMetrics.hasGraphTab, "Catalog graph tab should be removed while material/flow tabs cover that purpose.");
      assertMetric(mapping.catalogSummaryMetrics.activeCatalogTab === "summary", "Catalog should open on the summary view.");
      assertMetric(mapping.catalogSummaryMetrics.visibleCatalogSections === 2, "Catalog summary should show only the summary section group.");
      assertMetric(mapping.catalogSummaryMetrics.editorPanelHidden, "Catalog summary should not keep the editor panel visible.");
      assertMetric(mapping.catalogSummaryMetrics.summaryVisible, "Catalog summary sections are not visible.");
      assertMetric(mapping.catalogSummaryMetrics.flowHidden, "Catalog flow section should be hidden until selected.");
      assertMetric(mapping.catalogSummaryMetrics.graphHidden, "Catalog graph section should be hidden until selected.");
      assertMetric(mapping.overviewMetrics.hasFlowBoard, "Mapping flow board is missing.");
      assertMetric(mapping.overviewMetrics.flowBoardColumnCount >= 5, "Mapping flow board columns are missing.");
      assertMetric(mapping.overviewMetrics.flowBoardNodeCount >= 10, "Mapping flow board nodes are missing.");
      assertMetric(mapping.overviewMetrics.hasGraphPanel, "Mapping graph panel is missing.");
      assertMetric(mapping.overviewMetrics.graphColumnCount >= 7, "Mapping graph columns are missing.");
      assertMetric(mapping.overviewMetrics.graphResourceNodeCount >= 8, "Mapping graph resource nodes are missing.");
      assertMetric(mapping.overviewMetrics.graphCharacterText, "Mapping graph is not centered on the active character.");
      assertMetric(mapping.overviewMetrics.hasMermaidSource, "Mermaid source details are missing.");
      assertMetric(mapping.catalogFlowMetrics.activeCatalogTab === "flow", "Catalog flow tab did not activate.");
      assertMetric(mapping.catalogFlowMetrics.visibleCatalogSections === 1, "Catalog flow view should show only the flow section.");
      assertMetric(mapping.catalogFlowMetrics.editorPanelHidden, "Catalog flow view should not keep the editor panel visible.");
      assertMetric(mapping.catalogFlowMetrics.flowBoardIsScrollable, "Catalog flow board should scroll internally.");
      assertMetric(!mapping.catalogFlowMetrics.overflowX, "Catalog flow view caused horizontal overflow.");
      assertMetric(!mapping.catalogListBeforeSelectMetrics.editorPanelHidden, "Catalog list should keep the readonly diagram panel available.");
      assertMetric(mapping.catalogListBeforeSelectMetrics.saveHidden, "Catalog list diagram should hide save controls before selecting an item.");
      assertMetric(mapping.catalogListBeforeSelectMetrics.paletteHidden, "Catalog list diagram should hide the card deck before selecting an item.");
      assertMetric(mapping.catalogListBeforeSelectMetrics.readonlyCanvas, "Catalog list diagram should be readonly before selecting an item.");
      assertMetric(mapping.catalogListBeforeSelectMetrics.hasZoomControls, "Catalog list diagram should keep zoom controls.");
      assertMetric(mapping.catalogListBeforeSelectMetrics.copyHidden, "Catalog list diagram should hide edit-state copy controls.");
      assertMetric(!mapping.catalogListBeforeSelectMetrics.hasCatalogMaterialMap, "Catalog list should not repeat the material map.");
      assertMetric(mapping.overviewMetrics.hasFeatureSetMode, "Feature set editor mode is missing.");
      assertMetric(mapping.overviewMetrics.topModeTabCount === 0, "Create/saved/feature set controls should not remain in the top navigation.");
      assertMetric(mapping.overviewMetrics.editorModeCount >= 4, "Editor mode controls are missing from the card deck.");
      assertMetric(mapping.overviewMetrics.canvasHeight >= 420, "Editor canvas does not keep a stable working height.");
      assertMetric(Math.abs(mapping.overviewMetrics.canvasHeight - mapping.overviewMetrics.paletteHeight) < 24, "Card deck height should be constrained to the editor height.");
      assertMetric(mapping.overviewMetrics.paletteOnRight, "Card deck should be positioned to the right of the canvas.");
      assertMetric(mapping.overviewMetrics.paletteScrollsInternally, "Card deck should scroll internally instead of extending the page.");
      assertMetric(mapping.overviewMetrics.canvasNodeOverlapCount === 0, "Default editor canvas has overlapping cards.");
      assertMetric(mapping.overviewMetrics.hasMermaidPreview, "Mapping Mermaid preview is missing.");
      assertMetric(mapping.overviewMetrics.mermaidIncludesRine, "Mapping Mermaid preview does not include Rine flows.");
      assertMetric(!mapping.overviewMetrics.mermaidHasFeatureSetEdge, "Mermaid preview includes feature set/reference edges as execution flow.");
      assertMetric(mapping.overviewMetrics.materialFlowArrowCount === 0, "Material catalog should not render sequence arrows.");
      assertMetric(mapping.overviewMetrics.materialGroupCount >= 4, "Material map groups are missing.");
      assertMetric(mapping.overviewMetrics.ruleCardCount >= 10, "Rine runtime mappings are not fully visible.");
      assertMetric(!mapping.overviewMetrics.overflowX, "Mapping overview has horizontal overflow.");
      assertMetric(mapping.createMetrics.hasTargetSelect, "Mapping target selector is missing.");
      assertMetric(mapping.createMetrics.visibleSections === 0, "Create mode should not navigate away from the editor workspace.");
      assertMetric(mapping.createMetrics.hasWrapButtons, "Action flow wrap buttons are missing.");
      assertMetric(mapping.createMetrics.hasDraftFlowPreview, "Draft flow preview is missing.");
      assertMetric(mapping.createMetrics.editorShowsDraft, "Draft view does not update the shared editor.");
      assertMetric(!mapping.createMetrics.overflowX, "Mapping create view has horizontal overflow.");
      assertMetric(mapping.savedMetrics.hasSnippetFeatureSetPicker, "Snippet feature set picker is missing.");
      assertMetric(mapping.savedMetrics.hasSavedFlowBoard, "Saved mapping flow board is missing.");
      assertMetric(mapping.savedMetrics.savedGroupCount > 0, "Saved mapping groups are missing.");
      assertMetric(mapping.savedEditorBeforeSetMetrics.addToSetEnabled, "Saved mapping should be addable to a feature set.");
      assertMetric(mapping.savedEditorBeforeSetMetrics.visibleSections === 0, "Saved mode should not navigate away from the editor workspace.");
      assertMetric(mapping.savedEditorBeforeSetMetrics.selectedNodeCount >= 3, "Saved mapping did not render as canvas nodes.");
      assertMetric(mapping.savedEditorBeforeSetMetrics.paletteTabCount >= 5, "Editor palette category buttons are missing.");
      assertMetric(mapping.savedEditorBeforeSetMetrics.paletteCardCount > 0, "Editor palette cards are missing.");
      assertMetric(mapping.sceneActionResourceFilterMetrics.hasSceneActionPopover, "Scene action did not open a local connection popover.");
      assertMetric(mapping.sceneActionResourceFilterMetrics.visibleResourceKinds.length > 0, "Scene action did not show any scene resources.");
      assertMetric(mapping.sceneActionResourceFilterMetrics.visibleResourceKinds.every((kind) => kind === "scene"), "Scene action resource candidates should include only saved scenes.");
      assertMetric(mapping.paletteDropMetrics.nodeAdded, "Dragging a palette card did not add a canvas node.");
      assertMetric(mapping.paletteDropMetrics.hasDroppedAction, "Dropped palette card did not render as an action/group node.");
      assertMetric(mapping.filteredPaletteMetrics.hasPopover, "Selecting a canvas card did not show a local floating action popover.");
      assertMetric(mapping.filteredPaletteMetrics.visiblePaletteKinds.every((kind) => kind === "action" || kind === "group"), "Connection start should filter the card deck to connectable action cards.");
      assertMetric(mapping.manualConnectionMetrics.edgeCount > 0, "Manual canvas connection did not render an edge.");
      assertMetric(mapping.manualConnectionMetrics.canCopyGraph, "Editor graph draft cannot be copied.");
      assertMetric(mapping.dragAfterMetrics.moved, "Canvas node drag did not move a card.");
      assertMetric(mapping.dragAfterMetrics.selected, "Canvas node was not selected after drag.");
      assertMetric(mapping.savedMetrics.movedToFeatureSet, "Adding a saved mapping to a feature set did not move to the feature set view.");
      assertMetric(mapping.savedMetrics.visibleSections === 0, "Feature set mode should stay in the editor workspace after adding a mapping.");
      assertMetric(mapping.savedMetrics.featureSetCandidateChecked, "Adding a saved mapping did not check it in the feature set picker.");
      assertMetric(!mapping.savedMetrics.overflowX, "Saved mapping view has horizontal overflow.");
      assertMetric(mapping.featureSetMetrics.hasFeatureSetForm, "Feature set form is missing.");
      assertMetric(mapping.featureSetMetrics.hasFeatureSetPicker, "Feature set picker is missing.");
      assertMetric(mapping.featureSetMetrics.hasFeatureSetPreview, "Feature set preview is missing.");
      assertMetric(mapping.featureSetMetrics.hasFeatureSetFlowBoard, "Feature set flow board is missing.");
      assertMetric(mapping.featureSetMetrics.featureSetOptionHasDescription, "Feature set mapping options are missing readable descriptions.");
      assertMetric(mapping.featureSetMetrics.featureSetContainArrowCount === 0, "Feature set contains view should not render sequence arrows.");
      assertMetric(mapping.featureSetMetrics.editorShowsFeatureSet, "Feature set selection did not render in the shared editor.");
      assertMetric(mapping.featureSetMetrics.hasGenericTemplate, "Generic character template feature set is missing.");
      assertMetric(mapping.featureSetMetrics.hasCompatibilityStatus, "Feature set compatibility status is missing.");
      assertMetric(mapping.featureSetMetrics.visibleSections === 0, "Feature set mode should not navigate away from the editor workspace.");
      assertMetric(!mapping.featureSetMetrics.overflowX, "Feature set view has horizontal overflow.");
      assertMetric(mapping.catalogMetrics.editorShowsCharacter, "Character selection did not return to the character workspace.");
      assertMetric(mapping.catalogMetrics.hasCharacterCanvasNode, "Character workspace did not render the actual character card.");
      assertMetric(mapping.catalogMetrics.hasResourceGroupNodes, "Character workspace did not show resource groups.");
      assertMetric(mapping.catalogMetrics.paletteHidden, "Catalog character diagram should hide the card deck.");
      assertMetric(mapping.catalogMetrics.readonlyCanvas, "Catalog character diagram should be readonly.");
      assertMetric(mapping.catalogMetrics.saveHidden, "Catalog character diagram should hide save controls.");
      assertMetric(!mapping.catalogMetrics.overflowX, "Catalog view has horizontal overflow.");
      assertMetric(sceneEditor.metrics.hasSceneSelect, "Scene selector is missing.");
      assertMetric(sceneEditor.metrics.hasSceneList, "Scene list is missing.");
      assertMetric(sceneEditor.metrics.sceneCardCount > 0, "Scene list has no saved scene cards.");
      assertMetric(sceneEditor.metrics.hasDemoSceneOption, "Rine demo scene option is missing.");
      assertMetric(sceneEditor.metrics.hasDeleteButton, "Scene delete button is missing.");
      assertMetric(sceneEditor.metrics.previewHasNoSaveActions, "Scene preview panel should stay focused on preview instead of duplicating save/delete actions.");
      assertMetric(sceneEditor.metrics.previewPanelOnRight, "Scene preview panel should sit to the right on desktop.");
      assertMetric(sceneEditor.metrics.previewHasStableArea, "Scene preview area is too small.");
      assertMetric(sceneEditor.metrics.savedSmokeSceneVisible, "Scene editor did not show a newly saved scene.");
      assertMetric(sceneEditor.metrics.smokeSceneDeleted, "Scene editor did not remove a deleted scene from the selector.");
      assertMetric(!sceneEditor.metrics.overflowX, "Scene editor has horizontal overflow.");
      assertMetric(layerEditor.metrics.hasSurfaceSelect, "Layer editor surface selector is missing.");
      assertMetric(layerEditor.metrics.hasPreviewPanel, "Layer editor preview panel did not open after selecting a surface.");
      assertMetric(layerEditor.metrics.hasPlaybackControls, "Layer editor playback controls are missing.");
      assertMetric(layerEditor.metrics.hasZoomControls, "Layer editor zoom controls are missing.");
      assertMetric(layerEditor.metrics.hasSaveActions, "Layer editor save/delete actions are missing.");
      assertMetric(layerEditor.metrics.hasStepwiseReveal, "Layer editor controls should reveal after selecting a surface and part.");
      assertMetric(layerEditor.metrics.previewOnRight, "Layer editor preview panel should sit to the right on desktop.");
      assertMetric(layerEditor.metrics.previewHasStableArea, "Layer editor preview area is too small.");
      assertMetric(layerEditor.metrics.controlsOnLeft, "Layer editor controls should stay in the left settings flow.");
      assertMetric(layerEditor.metrics.previewPanelHasNoControls, "Layer editor preview panel should not contain form or action controls.");
      assertMetric(!layerEditor.metrics.overflowX, "Layer editor has horizontal overflow.");
      assertMetric(cropEditor.initialStepMetrics.adjustHiddenBeforeImage, "Crop editor region controls should stay hidden before selecting an image.");
      assertMetric(cropEditor.initialStepMetrics.actionHiddenBeforeImage, "Crop editor actions should stay hidden before selecting an image.");
      assertMetric(cropEditor.metrics.hasRecipeSelect, "Crop editor recipe selector is missing.");
      assertMetric(cropEditor.metrics.hasRegionInputs, "Crop editor region inputs are missing.");
      assertMetric(cropEditor.metrics.hasDownloadAction, "Crop editor download action is missing.");
      assertMetric(cropEditor.metrics.hasStepwiseReveal, "Crop editor controls should reveal after selecting an image.");
      assertMetric(cropEditor.metrics.previewOnRight, "Crop editor preview panel should sit to the right on desktop.");
      assertMetric(cropEditor.metrics.previewHasStableArea, "Crop editor preview area is too small.");
      assertMetric(!cropEditor.metrics.overflowX, "Crop editor has horizontal overflow.");
      characterEditors.forEach((editor) => {
        assertMetric(editor.hasHeading, `${editor.page} has no heading.`);
        assertMetric(editor.hasMain, `${editor.page} has no main shell.`);
        assertMetric(editor.hasConceptMap, `${editor.page} is missing the character concept map.`);
        assertMetric(editor.hasReadinessMap, `${editor.page} is missing the character readiness map.`);
        assertMetric(editor.hasResultMap, `${editor.page} is missing the step result map.`);
        assertMetric(!editor.overflowX, `${editor.page} has horizontal overflow.`);
      });
      assertMetric(runtime.metrics.hasStage, "Runtime character stage is missing.");
      assertMetric(runtime.metrics.hasSprite, "Runtime character sprite is missing.");
      assertMetric(runtime.metrics.hasSpeechBalloon, "Runtime speech balloon is missing.");
      assertMetric(runtime.metrics.sceneId === "rine-demo-scene", "Runtime did not apply the Rine demo scene.");
      assertMetric(runtime.metrics.hasSceneLayer, "Runtime scene layer did not render.");
      assertMetric(runtime.metrics.overlayVisible, "Runtime scene overlay did not render.");
      assertMetric(runtime.metrics.overlayRemoved, "Runtime scene overlay did not auto-remove.");
      assertMetric(!runtime.metrics.overflowX, "Runtime demo has horizontal overflow.");

      console.log(JSON.stringify({
        ok: true,
        baseUrl,
        mapping,
        sceneEditor,
        layerEditor,
        cropEditor,
        characterEditors,
        runtime,
      }, null, 2));
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      baseUrl,
      error: error instanceof Error ? error.message : String(error),
      serverStderr: stderrChunks.join("").slice(-2000),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await stopServer(server);
  }
}

await main();
