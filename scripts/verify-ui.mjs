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

async function collectTextFitMetrics(page, rootSelector = "body") {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document.body;
    const targets = Array.from(root.querySelectorAll([
      "button",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "strong",
      "small",
      ".asset-lab-status",
      ".asset-small-button",
      ".asset-layer-summary-item dt",
      ".asset-layer-summary-item dd",
      ".nanika-paint-node",
      ".nanika-palette-card",
      ".nanika-flow-board-node",
      ".nanika-result-flow-node",
      ".nanika-graph-node",
    ].join(",")));

    const visibleTargets = targets.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return rect.width > 0
        && rect.height > 0
        && style.visibility !== "hidden"
        && style.display !== "none";
    });

    const textOverflow = visibleTargets.filter((element) => (
      element.scrollWidth > element.clientWidth + 2
      || element.scrollHeight > element.clientHeight + 8
    ));

    const narrowKoreanControls = visibleTargets.filter((element) => {
      const text = element.textContent?.trim() ?? "";
      const rect = element.getBoundingClientRect();
      const isControl = ["BUTTON", "A"].includes(element.tagName);
      const isCardTitle = element.tagName === "STRONG"
        && Boolean(element.closest([
          ".nanika-paint-node",
          ".nanika-palette-card",
          ".nanika-flow-board-node",
          ".nanika-result-flow-node",
          ".nanika-graph-node",
          ".asset-layer-summary-item",
        ].join(",")));

      return /[가-힣]{2,}/.test(text)
        && rect.width < 44
        && (isControl || isCardTitle);
    });
    const crampedInfoCards = Array.from(root.querySelectorAll(".asset-step-result-map article"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const text = element.textContent?.trim() ?? "";
        const style = getComputedStyle(element);

        return rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width < 132
          && text.length > 24;
      });

    const sample = (element) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === "string" ? element.className : "",
      text: (element.textContent?.trim() ?? "").slice(0, 80),
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    });

    return {
      checkedCount: visibleTargets.length,
      textOverflowCount: textOverflow.length,
      narrowKoreanControlCount: narrowKoreanControls.length,
      crampedInfoCardCount: crampedInfoCards.length,
      textOverflowSamples: textOverflow.slice(0, 8).map(sample),
      narrowKoreanSamples: narrowKoreanControls.slice(0, 8).map(sample),
      crampedInfoCardSamples: crampedInfoCards.slice(0, 8).map(sample),
    };
  }, rootSelector);
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
    initialConditionNodeCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='condition']").length,
    initialResourceGroupCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group']").length,
    initialCanvasEdgeCount: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-edges path[marker-end]").length,
    initialStatsCount: document.querySelectorAll("#mappingEditorStats span").length,
    initialZoomText: document.querySelector("#mappingEditorStats")?.textContent ?? "",
    runtimeProfileCardCount: document.querySelectorAll("#runtimeProfileOverview .nanika-runtime-profile-card").length,
    runtimeProfileText: document.querySelector("#runtimeProfileOverview")?.textContent ?? "",
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
  const overviewTextFit = await collectTextFitMetrics(page, ".asset-lab-shell");
  await page.locator("#editorZoomInButton").click();
  const editorZoomMetrics = await page.evaluate(() => ({
    zoomText: document.querySelector("#mappingEditorStats")?.textContent ?? "",
    viewportWidth: document.querySelector("#mappingEditorCanvas .nanika-paint-viewport")?.getBoundingClientRect().width ?? 0,
    canvasWidth: document.querySelector("#mappingEditorCanvas .nanika-paint-canvas")?.getBoundingClientRect().width ?? 0,
  }));
  await page.locator("#editorZoomResetButton").click();
  await page.locator("#mappingPaletteTabs button").first().click();
  const conditionPaletteMetrics = await page.evaluate(() => ({
    hasConditionTab: Array.from(document.querySelectorAll("#mappingPaletteTabs button"))
      .some((button) => button.textContent?.trim().length > 0)
      && Boolean(document.querySelector("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']")),
    conditionCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']").length,
    runtimeConditionCardCount: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']"))
      .filter((card) => card.textContent?.includes("scope: runtime")).length,
    characterConditionCardCount: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']"))
      .filter((card) => card.textContent?.includes("scope: character")).length,
  }));
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='runtime']").first().click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
  const runtimeConditionPathMetrics = await page.evaluate(() => ({
    activePaletteText: document.querySelector("#mappingPaletteTabs button[data-active='true']")?.textContent?.trim() ?? "",
    visibleConditionScopes: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']"))
      .map((card) => card.textContent ?? "")
      .filter(Boolean)
      .map((text) => (text.includes("scope: runtime") ? "runtime" : text.includes("scope: character") ? "character" : "unknown")),
  }));
  await page.locator("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']").first().click();
  await page.locator("#mappingPaletteTabs button").nth(1).click();
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
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='character']").first().click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
  const characterConditionPathMetrics = await page.evaluate(() => ({
    activePaletteText: document.querySelector("#mappingPaletteTabs button[data-active='true']")?.textContent?.trim() ?? "",
    visibleConditionScopes: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='condition']"))
      .map((card) => card.textContent ?? "")
      .filter(Boolean)
      .map((text) => (text.includes("scope: character") ? "character" : text.includes("scope: runtime") ? "runtime" : "unknown")),
  }));
  await page.locator("#mappingPaletteTabs button").last().click();
  const characterSceneGroupPathMetrics = await page.evaluate(() => ({
    hasCharacterPopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    activePaletteText: document.querySelector("#mappingPaletteTabs button[data-active='true']")?.textContent?.trim() ?? "",
    visibleGroupKinds: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='resource-group']"))
      .map((card) => card.getAttribute("data-resource-kind"))
      .filter(Boolean),
    sceneGroupCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='resource-group'][data-resource-kind='scene']").length,
  }));
  const groupNodeCountBeforeSceneAdd = await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group'][data-resource-kind='scene']").count();
  const edgeCountBeforeSceneAdd = await page.locator("#mappingEditorCanvas .nanika-paint-edges path").count();
  await page.locator("#mappingPaletteDeck .nanika-palette-card[data-kind='resource-group'][data-resource-kind='scene']").first().click();
  const characterSceneGroupConnectMetrics = await page.evaluate(({ beforeGroupCount, beforeEdgeCount }) => ({
    sceneGroupNodeAdded: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group'][data-resource-kind='scene']").length > beforeGroupCount,
    edgeAdded: document.querySelectorAll("#mappingEditorCanvas .nanika-paint-edges path").length > beforeEdgeCount,
    pendingCleared: !document.querySelector("#mappingPaletteDeck")?.getAttribute("data-pending-source-id"),
  }), { beforeGroupCount: groupNodeCountBeforeSceneAdd, beforeEdgeCount: edgeCountBeforeSceneAdd });
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='resource-group'][data-resource-kind='scene']").last().click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
  const sceneGroupFilterMetrics = await page.evaluate(() => ({
    hasSceneGroupPopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    visibleResourceKinds: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card"))
      .map((card) => card.getAttribute("data-resource-kind"))
      .filter(Boolean),
    sceneResourceCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-resource-kind='scene']").length,
  }));
  await page.locator("#mappingPaletteDeck .nanika-palette-card[data-resource-kind='scene']").first().click();
  await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='resource'][data-resource-kind='scene']").last().click();
  await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
  const sceneResourceActionFilterMetrics = await page.evaluate(() => ({
    hasSceneResourcePopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
    visibleActionTypes: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card"))
      .map((card) => card.textContent ?? "")
      .filter(Boolean),
    visibleActionMeta: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card .nanika-editor-meta span"))
      .map((meta) => meta.textContent ?? ""),
    actionCardCount: document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card[data-kind='action']").length,
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
  const catalogFlowTextFit = await collectTextFitMetrics(page, ".asset-lab-shell");
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
  const catalogListTextFit = await collectTextFitMetrics(page, ".asset-lab-shell");

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
  const sceneActionCount = await page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='action']").filter({ hasText: "?? ??" }).count();
  let sceneActionResourceFilterMetrics = {
    hasSceneActionPopover: false,
    visibleResourceKinds: [],
    visibleCardText: "",
    skippedBecauseSceneActionDisabled: sceneActionCount === 0,
  };
  if (sceneActionCount > 0) {
    const sceneActionNode = page.locator("#mappingEditorCanvas .nanika-paint-node[data-kind='action']").filter({ hasText: "?? ??" }).first();
    await sceneActionNode.click();
    await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").first().click();
    sceneActionResourceFilterMetrics = await page.evaluate(() => ({
      hasSceneActionPopover: Boolean(document.querySelector("#mappingEditorCanvas .nanika-node-popover")),
      visibleResourceKinds: Array.from(document.querySelectorAll("#mappingPaletteDeck .nanika-palette-card"))
        .map((card) => card.getAttribute("data-resource-kind"))
        .filter(Boolean),
      visibleCardText: document.querySelector("#mappingPaletteDeck")?.textContent ?? "",
      skippedBecauseSceneActionDisabled: false,
    }));
    await page.locator("#mappingEditorCanvas .nanika-node-popover .asset-small-button").last().click();
  }
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
    hasFeatureSetClonePanel: Boolean(document.querySelector("#featureSetCloneSourceSelect") && document.querySelector("#featureSetCloneCharacterSelect")),
    featureSetCloneSourceCount: document.querySelectorAll("#featureSetCloneSourceSelect option").length,
    featureSetCloneCharacterCount: document.querySelectorAll("#featureSetCloneCharacterSelect option").length,
    featureSetClonePreviewText: document.querySelector("#featureSetClonePreview")?.textContent?.trim() ?? "",
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
    overviewTextFit,
    editorZoomMetrics,
    conditionPaletteMetrics,
    runtimeConditionPathMetrics,
    defaultDeleteMetrics: {
      ...defaultDeleteMetrics,
      deleteButtonWasEnabled: defaultNodeDeleteButtonEnabled,
    },
    characterPaletteMetrics,
    characterSelectionMetrics,
    characterConditionPathMetrics,
    characterSceneGroupPathMetrics,
    characterSceneGroupConnectMetrics,
    sceneGroupFilterMetrics,
    sceneResourceActionFilterMetrics,
    editorAppliedMetrics,
    catalogListTextFit,
    catalogSummaryMetrics,
    overviewScreenshot,
    flowScreenshot,
    catalogFlowMetrics,
    catalogFlowTextFit,
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
  await page.waitForFunction((sceneId) => (
    document.querySelector("#sceneSelect")?.value === sceneId
    && document.querySelector("#sceneIdInput")?.value === sceneId
  ), smokeSceneId);
  const savedSmokeSceneVisible = await page.evaluate((sceneId) => (
    Array.from(document.querySelectorAll("#sceneSelect option")).some((option) => option.value === sceneId)
      && Boolean(document.querySelector(`#sceneList .asset-scene-list-card[data-selected="true"]`))
  ), smokeSceneId);
  const savedSmokeSceneDefaultMetrics = await page.evaluate((sceneId) => {
    const output = document.querySelector("#sceneOutput")?.textContent ?? "{}";
    let parsed = {};

    try {
      parsed = JSON.parse(output);
    } catch {
      parsed = {};
    }

    return {
      checkboxChecked: document.querySelector("#defaultSceneInput")?.checked ?? true,
      outputDefaultScene: parsed.defaultScene,
      selectedOptionLabel: Array.from(document.querySelectorAll("#sceneSelect option"))
        .find((option) => option.value === sceneId)?.textContent ?? "",
    };
  }, smokeSceneId);
  await page.locator("#deleteSceneButton").click();
  await page.waitForFunction((sceneId) => (
    !Array.from(document.querySelectorAll("#sceneSelect option")).some((option) => option.value === sceneId)
  ), smokeSceneId);

  const metrics = await page.evaluate(([savedVisible, defaultMetrics]) => ({
    title: document.title,
    hasSceneSelect: Boolean(document.querySelector("#sceneSelect")),
    hasSceneList: Boolean(document.querySelector("#sceneList")),
    sceneCardCount: document.querySelectorAll("#sceneList .asset-scene-list-card").length,
    hasDemoSceneOption: Array.from(document.querySelectorAll("#sceneSelect option"))
      .some((option) => option.value === "rine-demo-scene"),
    hasDeleteButton: Boolean(document.querySelector("#deleteSceneButton")),
    uncheckedDefaultSceneStayedUnchecked: !defaultMetrics.checkboxChecked,
    uncheckedDefaultSceneOutputCleared: defaultMetrics.outputDefaultScene === "",
    uncheckedSceneLabelDoesNotShowDefault: !defaultMetrics.selectedOptionLabel.includes("default"),
    hasWorkbenchTitle: document.querySelector(".asset-scene-tool-grid .asset-lab-output-header h2")?.textContent?.trim() === "무대 작업판",
    hasWorkbenchGuide: document.querySelectorAll(".asset-scene-tool-grid .asset-workbench-guide span").length >= 3,
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
  }), [savedSmokeSceneVisible, savedSmokeSceneDefaultMetrics]);
  const textFit = await collectTextFitMetrics(page, ".asset-lab-shell");

  const screenshot = await capturePage(page, "dev-character-scene");

  return {
    metrics,
    textFit,
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
      hasWorkbenchTitle: document.querySelector("#layerPreviewSection .asset-lab-output-header h2")?.textContent?.trim() === "파츠 작업판",
      hasWorkbenchGuide: document.querySelectorAll("#layerPreviewSection .asset-workbench-guide span").length >= 3,
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
  const textFit = await collectTextFitMetrics(page, ".asset-lab-shell");

  const screenshot = await capturePage(page, "dev-assets-layer");

  return {
    metrics,
    textFit,
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
      hasWorkbenchTitle: document.querySelector(".asset-crop-tool-grid .asset-lab-output-header h2")?.textContent?.trim() === "영역 작업판",
      hasStepwiseReveal: document.querySelector("#cropAdjustSection")?.hidden === false
        && document.querySelector("#cropActionSection")?.hidden === false,
      previewOnRight: Boolean(formPanel && previewPanel && previewPanel.left > formPanel.left),
      previewHasStableArea: Boolean(preview && preview.height >= 420),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  const textFit = await collectTextFitMetrics(page, ".asset-lab-shell");

  const screenshot = await capturePage(page, "dev-assets-crop");

  return {
    initialStepMetrics,
    metrics,
    textFit,
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

    let expressionPickerMetrics = null;
    if (pageName === "dev-character-expression.html") {
      await page.waitForSelector("#expressionAssetChoiceGrid");
      expressionPickerMetrics = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("#expressionAssetChoiceGrid .asset-image-choice-card"));
        const nativeSelect = document.querySelector("#expressionAssetSelect");

        return {
          hasChoiceGrid: Boolean(document.querySelector("#expressionAssetChoiceGrid")),
          cardCount: cards.length,
          nativeSelectHidden: Boolean(nativeSelect && getComputedStyle(nativeSelect).opacity === "0"),
          initialSelectedCount: cards.filter((card) => card.getAttribute("data-selected") === "true").length,
        };
      });

      const firstUncheckedCard = page.locator("#expressionAssetChoiceGrid .asset-image-choice-card").filter({
        has: page.locator("input:not(:checked)"),
      }).first();

      if (await firstUncheckedCard.count()) {
        await firstUncheckedCard.click();
      } else {
        await page.locator("#expressionAssetChoiceGrid .asset-image-choice-card").first().click();
      }

      expressionPickerMetrics = {
        ...expressionPickerMetrics,
        ...await page.evaluate(() => ({
          selectedCountAfterClick: document.querySelectorAll("#expressionAssetChoiceGrid .asset-image-choice-card[data-selected='true']").length,
          selectedOptionCountAfterClick: document.querySelectorAll("#expressionAssetSelect option:checked").length,
          previewCardCountAfterClick: document.querySelectorAll("#expressionPreviewGrid .asset-expression-preview-card").length,
        })),
      };
    }

    const metrics = await page.evaluate((name) => ({
      page: name,
      title: document.title,
      hasHeading: Boolean(document.querySelector("h1")),
      hasMain: Boolean(document.querySelector("main")),
      hasProductionFlow: document.querySelectorAll(".asset-production-flow li").length === 5,
      hasConceptMap: name === "dev-character.html"
        ? document.querySelectorAll(".asset-character-concept-map article").length >= 5
        : true,
      hasProductionModel: name === "dev-character.html"
        ? document.querySelectorAll(".asset-production-model article").length === 4
        : true,
      hasProductionLanes: name === "dev-character.html"
        ? document.querySelectorAll(".asset-production-lane").length === 4
        : true,
      hasLockedOrNextStep: name === "dev-character.html"
        ? Boolean(document.querySelector(".asset-character-step-card[data-state='locked'], .asset-character-step-card[data-state='next'], .asset-character-step-card[data-state='complete']"))
        : true,
      hasReadinessMap: name === "dev-character.html"
        ? document.querySelectorAll(".asset-character-readiness-map article").length >= 7
        : true,
      hasCommonKeyRegistry: name === "dev-character.html"
        ? document.querySelectorAll("#commonKeyRegistry .asset-common-key-card").length >= 10
        : true,
      hasBoundCommonKey: name === "dev-character.html"
        ? document.querySelectorAll("#commonKeyRegistry .asset-common-key-card[data-state='bound']").length > 0
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
    }), pageName);
    const textFit = await collectTextFitMetrics(page, ".asset-lab-shell");
    const screenshot = pageName === "dev-character.html"
      ? await capturePage(page, "dev-character-home")
      : null;

    results.push({
      ...metrics,
      expressionPickerMetrics,
      textFit,
      screenshot,
    });
  }

  return results;
}

async function verifyRuntimeDemo(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "ghostNest:rine:runtimeUi.options",
      JSON.stringify({ balloonTheme: "dark_magic" }),
    );
    window.localStorage.setItem(
      "ghostNest:rine:managementMenu.options",
      JSON.stringify({ defaultDisplay: "panel" }),
    );
  });
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const initialSceneId = await page.evaluate(() => document.querySelector("#characterStage")?.getAttribute("data-scene-id") ?? "");
  await page.locator("[data-runtime-test-action='rine-demo-scene']").click();
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-id") === "rine-demo-scene");
  await page.locator("[data-runtime-test-action='scene-overlay']").click();
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "1");
  const overlayVisible = await page.evaluate(() => Boolean(document.querySelector(".scene-layer-root .scene-layer[data-scene-overlay-slot='demo-overlay']")));
  await page.waitForFunction(() => document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "0");
  await page.locator("[data-runtime-test-action='panel-menu']").click();
  await page.waitForFunction(() => {
    const menus = Array.from(document.querySelectorAll("#balloonActionMenu, #panelActionMenu"));

    return menus.some((menu) => !menu.hidden && menu.querySelectorAll("button").length > 0);
  });

  const metrics = await page.evaluate(({ wasOverlayVisible, initialSceneId }) => ({
    title: document.title,
    hasStage: Boolean(document.querySelector("#characterStage")),
    hasSprite: Boolean(document.querySelector("#characterSprite")),
    hasSpeechBalloon: Boolean(document.querySelector("#speechBalloon")),
    ignoredStoredRuntimeTheme: document.querySelector("#characterStage")?.getAttribute("data-balloon-theme") !== "dark_magic",
    initialSceneId,
    sceneId: document.querySelector("#characterStage")?.getAttribute("data-scene-id"),
    hasSceneLayer: Boolean(document.querySelector(".scene-layer-root .scene-layer[data-layer-id='background']")),
    overlayVisible: wasOverlayVisible,
    overlayRemoved: document.querySelector("#characterStage")?.getAttribute("data-scene-overlay-count") === "0",
    visibleManagementMenuId: Array.from(document.querySelectorAll("#balloonActionMenu, #panelActionMenu"))
      .find((menu) => !menu.hidden)?.id ?? "",
    managementMenuVisible: Array.from(document.querySelectorAll("#balloonActionMenu, #panelActionMenu"))
      .some((menu) => !menu.hidden),
    managementMenuButtonCount: Array.from(document.querySelectorAll("#balloonActionMenu:not([hidden]) button, #panelActionMenu:not([hidden]) button")).length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  }), { wasOverlayVisible: overlayVisible, initialSceneId });
  const textFit = await collectTextFitMetrics(page, ".app-shell");

  const screenshot = await capturePage(page, "runtime-demo");

  return {
    metrics,
    textFit,
    screenshot,
  };
}

async function verifyFortuneEmbed(page) {
  await page.setViewportSize({ width: 447, height: 845 });
  await page.goto(`${baseUrl}/dev-fortune-embed.html`, { waitUntil: "load" });
  await page.waitForSelector("#fortuneNanikaRuntime .fortune-nanika-stage.ghostnest-runtime");
  await page.waitForFunction(() => document.querySelector("#fortuneRuntimeStatus")?.textContent?.includes("ready"));

  async function collectEmbedMetrics() {
    return page.evaluate(() => {
      const screen = document.querySelector(".fortune-screen");
      const mount = document.querySelector("#fortuneNanikaRuntime");
      const stage = mount?.querySelector(".fortune-nanika-stage");
      const runtimeRoots = Array.from(document.querySelectorAll(".ghostnest-runtime"));
      const runtimeRootOutsideCount = runtimeRoots.filter((node) => !mount?.contains(node)).length;
      const stageOutsideCount = Array.from(document.querySelectorAll(".fortune-nanika-stage"))
        .filter((node) => !mount?.contains(node)).length;
      const speechOutsideCount = Array.from(document.querySelectorAll(".speech-balloon, .fortune-nanika-speech"))
        .filter((node) => !mount?.contains(node)).length;
      const spriteOutsideCount = Array.from(document.querySelectorAll(".character-sprite, .fortune-nanika-sprite"))
        .filter((node) => !mount?.contains(node)).length;
      const sceneLayerOutsideCount = Array.from(document.querySelectorAll(".scene-layer-root"))
        .filter((node) => !mount?.contains(node)).length;
      const menuOutsideCount = Array.from(document.querySelectorAll(".balloon-action-menu, .management-panel-menu, .fortune-nanika-actions"))
        .filter((node) => !mount?.contains(node)).length;
      const screenRect = screen?.getBoundingClientRect();
      const mountRect = mount?.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      const speech = mount?.querySelector(".fortune-nanika-speech");
      const speechRect = speech?.getBoundingClientRect();

      return {
        title: document.title,
        hasMount: Boolean(mount),
        hasStage: Boolean(stage),
        hasSprite: Boolean(mount?.querySelector(".fortune-nanika-sprite")),
        hasSpeechBalloon: Boolean(mount?.querySelector(".fortune-nanika-speech")),
        runtimeRootCount: runtimeRoots.length,
        runtimeRootOutsideCount,
        stageCountInsideMount: mount?.querySelectorAll(".fortune-nanika-stage").length ?? 0,
        stageOutsideCount,
        speechOutsideCount,
        spriteOutsideCount,
        sceneLayerOutsideCount,
        menuOutsideCount,
        sceneLayerRootCount: mount?.querySelectorAll(".scene-layer-root").length ?? 0,
        sceneLayerCount: mount?.querySelectorAll(".scene-layer-root .scene-layer").length ?? 0,
        bootText: document.querySelector("#fortuneRuntimeStatus")?.textContent?.trim() ?? "",
        sceneId: stage?.getAttribute("data-scene-id") ?? "",
        speechAnchor: stage?.getAttribute("data-speech-anchor") ?? "",
        speechLayout: stage?.getAttribute("data-speech-layout") ?? "",
        speechPlacement: stage?.getAttribute("data-speech-placement") ?? "",
        surfaceId: mount?.querySelector(".fortune-nanika-sprite")?.getAttribute("data-surface-id") ?? "",
        speechText: mount?.querySelector(".fortune-nanika-text")?.textContent?.trim() ?? "",
        speechWithinStage: Boolean(
          stageRect
          && speechRect
          && speechRect.left >= stageRect.left - 1
          && speechRect.right <= stageRect.right + 1
          && speechRect.top >= stageRect.top - 1
          && speechRect.bottom <= stageRect.bottom + 1,
        ),
        speechAnchoredRight: Boolean(
          stageRect
          && speechRect
          && Math.abs(stageRect.right - speechRect.right) <= 2,
        ),
        bodyClassName: document.body.className,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        mountWithinScreen: Boolean(
          screenRect
          && mountRect
          && mountRect.left >= screenRect.left - 1
          && mountRect.right <= screenRect.right + 1
          && mountRect.top >= screenRect.top - 1
          && mountRect.bottom <= screenRect.bottom + 1,
        ),
        stageWithinMount: Boolean(
          mountRect
          && stageRect
          && stageRect.left >= mountRect.left - 1
          && stageRect.right <= mountRect.right + 1
          && stageRect.top >= mountRect.top - 1
          && stageRect.bottom <= mountRect.bottom + 1,
        ),
      };
    });
  }

  const initial = await collectEmbedMetrics();

  await page.locator("[data-fortune-page='zodiac']").click();
  await page.waitForFunction(() => document.querySelector("#fortuneRuntimeStatus")?.textContent?.includes("ready #2"));
  await page.waitForFunction(() => document.querySelector("#fortuneNanikaRuntime .fortune-nanika-sprite")?.getAttribute("data-surface-id") === "8");
  const afterZodiac = await collectEmbedMetrics();
  const zodiacSpeechText = afterZodiac.speechText;

  await page.locator("[data-fortune-event='fortune:menu:selected']").first().click();
  await page.waitForFunction((previousText) => {
    const text = document.querySelector("#fortuneNanikaRuntime .fortune-nanika-text")?.textContent ?? "";

    return text.trim().length > 0 && text.trim() !== previousText;
  }, zodiacSpeechText);
  const afterHostEvent = await collectEmbedMetrics();

  await page.locator("#fortuneRuntimeRestart").click();
  await page.waitForFunction(() => document.querySelector("#fortuneRuntimeStatus")?.textContent?.includes("ready #3"));
  const afterRestart = await collectEmbedMetrics();
  const textFit = await collectTextFitMetrics(page, ".fortune-screen");
  const screenshot = await capturePage(page, "dev-fortune-embed");

  return {
    initial,
    afterZodiac,
    afterHostEvent,
    afterRestart,
    textFit,
    screenshot,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const result = await response.json();

  if (!response.ok || result.ok === false) {
    throw new Error(`${url} failed: ${JSON.stringify(result)}`);
  }

  return result;
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function verifyDevtoolsApiReadiness() {
  const workspace = await fetchJson("/api/devtools/character-workspace");
  const characters = await fetchJson("/api/devtools/characters");
  const assets = await fetchJson("/api/devtools/character-assets?characterId=rine");
  const assetFiles = await fetchJson("/api/devtools/asset-files?characterId=rine");
  const mappings = await fetchJson("/api/devtools/nanika-mappings");
  const featureSets = await fetchJson("/api/devtools/nanika-feature-sets");
  const characterIds = (characters.characters ?? [])
    .map((character) => (typeof character === "string" ? character : character.id))
    .filter(Boolean);

  return {
    workspaceHasSourceDirectory: Boolean(workspace.workspace?.sourceCharacters ?? workspace.workspace?.resolved?.sourceCharacters),
    workspaceHasBrowserPrefix: Boolean(workspace.workspace?.browserSourcePrefix),
    characterCount: characterIds.length,
    hasRine: characterIds.includes("rine"),
    rineExpressionCount: Object.keys(assets.assets?.expressions ?? {}).length,
    rineSurfaceCount: Object.keys(assets.assets?.surfaces ?? {}).length,
    rineSceneCount: Object.keys(assets.assets?.scenes ?? {}).length,
    assetFileCount: assetFiles.files?.length ?? 0,
    hasSeparatedAssetKinds: new Set((assetFiles.files ?? []).map((file) => file.kind)).size >= 2,
    mappingCount: mappings.mappings?.length ?? 0,
    featureSetCount: featureSets.featureSets?.length ?? 0,
  };
}

async function verifyCharacterProductionSmoke() {
  const characterId = `codex_smoke_${Date.now()}`;
  const image = "/src/characters/rine/layer_org/rine.png";
  const surfaceId = "neutral";
  const layerId = "smoke_part";
  const expressionId = "smoke_expression";
  const sceneId = "smoke_scene";

  let created = false;

  try {
    await postJson("/api/devtools/create-character", {
      characterId,
      name: "Codex Smoke",
      description: "Temporary character for production flow smoke test.",
      tone: "smoke",
    });
    created = true;

    await postJson("/api/devtools/save-character-expression", {
      characterId,
      expression: expressionId,
      assets: [image],
    });

    await postJson("/api/devtools/save-character-surface", {
      characterId,
      surface: {
        surfaceId,
        surface: {
          id: surfaceId,
          image,
          expression: expressionId,
          alt: "Smoke neutral",
        },
      },
    });

    await postJson("/api/devtools/save-character-layer", {
      characterId,
      layer: {
        surfaceId,
        layerId,
        layer: {
          id: layerId,
          image,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          depth: 1,
          frames: [{ image, durationMs: 120 }],
          animation: {
            idleIntervalMs: 0,
            frameDurationMs: 120,
            loop: false,
          },
        },
      },
    });

    await postJson("/api/devtools/save-character-scene", {
      characterId,
      scene: {
        sceneId,
        scene: {
          id: sceneId,
          backgroundColor: "#ffffff",
          characterDepth: 10,
          layers: [{
            id: "smoke_stage",
            image,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            depth: 0,
            opacity: 1,
          }],
        },
      },
    });

    const savedAssets = await fetchJson(`/api/devtools/character-assets?characterId=${encodeURIComponent(characterId)}`);
    const hasSavedFlow = Boolean(
      savedAssets.assets?.expressions?.[expressionId]
      && savedAssets.assets?.surfaces?.[surfaceId]?.layers?.[layerId]
      && savedAssets.assets?.scenes?.[sceneId],
    );

    await postJson("/api/devtools/delete-character-layer", { characterId, surfaceId, layerId });
    await postJson("/api/devtools/delete-character-scene", { characterId, sceneId });
    await postJson("/api/devtools/delete-character-expression", { characterId, expression: expressionId });
    await postJson("/api/devtools/delete-character-surface", { characterId, surfaceId });

    const cleanedAssets = await fetchJson(`/api/devtools/character-assets?characterId=${encodeURIComponent(characterId)}`);
    const hasCleanedFlow = !cleanedAssets.assets?.expressions?.[expressionId]
      && !cleanedAssets.assets?.surfaces?.[surfaceId]
      && !cleanedAssets.assets?.scenes?.[sceneId];

    await postJson("/api/devtools/delete-character", { characterId });
    created = false;

    const characters = await fetchJson("/api/devtools/characters");

    return {
      characterId,
      hasSavedFlow,
      hasCleanedFlow,
      characterDeleted: !(characters.characters ?? [])
        .some((character) => (typeof character === "string" ? character : character.id) === characterId),
    };
  } finally {
    if (created) {
      try {
        await postJson("/api/devtools/delete-character", { characterId });
      } catch {
        // The main assertions will report the earlier failure; cleanup is best effort.
      }
    }
  }
}

async function verifyNanikaMappingRoundTrip() {
  const mappingId = `codex.roundtrip.${Date.now()}`;

  try {
    await postJson("/api/devtools/save-nanika-mapping", {
      mapping: {
        id: mappingId,
        name: "Codex round-trip mapping",
        target: {
          scope: "character",
          id: "rine",
          label: "Rine",
        },
        event: "codex:roundtrip",
        actions: [
          { type: "scene", id: "rine-demo-scene" },
          { type: "log", label: "codex.roundtrip" },
        ],
      },
    });

    const afterSave = await fetchJson("/api/devtools/nanika-mappings");
    const savedMapping = (afterSave.mappings ?? []).find((mapping) => mapping.id === mappingId);

    await postJson("/api/devtools/delete-nanika-mapping", { id: mappingId });
    const afterDelete = await fetchJson("/api/devtools/nanika-mappings");

    return {
      mappingId,
      saved: Boolean(savedMapping),
      savedSceneAction: savedMapping?.actions?.some((action) => action.type === "scene" && action.id === "rine-demo-scene") ?? false,
      savedLogAction: savedMapping?.actions?.some((action) => action.type === "log" && action.label === "codex.roundtrip") ?? false,
      deleted: !(afterDelete.mappings ?? []).some((mapping) => mapping.id === mappingId),
    };
  } catch (error) {
    try {
      await postJson("/api/devtools/delete-nanika-mapping", { id: mappingId });
    } catch {
      // The main failure is more useful than a cleanup failure here.
    }

    throw error;
  }
}

async function verifyCompactDesktopLayouts(page) {
  const pages = [
    "dev-character.html",
    "dev-character-expression.html",
    "dev-character-set.html",
    "dev-assets-layer.html",
    "dev-character-scene.html",
    "dev-nanika-mapping.html",
  ];
  const results = [];

  for (const pageName of pages) {
    await page.goto(`${baseUrl}/${pageName}`, { waitUntil: "load" });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(180);

    if (pageName === "dev-assets-layer.html") {
      await page.waitForSelector("#surfaceSelect");
    }

    const metrics = await page.evaluate((name) => {
      const shell = document.querySelector(".asset-lab-shell") ?? document.body;
      const main = document.querySelector("main") ?? document.body;
      const workbench = document.querySelector(".asset-lab-output-panel, #mappingEditorCanvas");
      const deck = document.querySelector(".nanika-editor-palette, #mappingPaletteDeck");

      return {
        page: name,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        shellHeight: Math.round(shell.getBoundingClientRect().height),
        mainHeight: Math.round(main.getBoundingClientRect().height),
        workbenchHeight: Math.round(workbench?.getBoundingClientRect().height ?? 0),
        deckHeight: Math.round(deck?.getBoundingClientRect().height ?? 0),
        hasVisibleHeading: Boolean(document.querySelector("h1")?.getBoundingClientRect().height),
        productionFlowCount: document.querySelectorAll(".asset-production-flow li").length,
        mappingDeckScrollsInternally: name === "dev-nanika-mapping.html"
          ? Boolean(deck && deck.scrollHeight >= deck.clientHeight)
          : true,
      };
    }, pageName);
    const textFit = await collectTextFitMetrics(page, ".asset-lab-shell");
    const screenshot = ["dev-assets-layer.html", "dev-character-scene.html", "dev-nanika-mapping.html"].includes(pageName)
      ? await capturePage(page, `${pageName.replace(".html", "")}-compact`)
      : null;

    results.push({ ...metrics, textFit, screenshot });
  }

  return results;
}

function assertMetric(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertTextFit(metrics, label) {
  assertMetric(metrics.textOverflowCount === 0, `${label} has text overflowing its container: ${JSON.stringify(metrics.textOverflowSamples)}`);
  assertMetric(metrics.narrowKoreanControlCount === 0, `${label} has Korean text squeezed into too narrow a control: ${JSON.stringify(metrics.narrowKoreanSamples)}`);
  assertMetric(metrics.crampedInfoCardCount === 0, `${label} has info cards squeezed too narrow to read comfortably: ${JSON.stringify(metrics.crampedInfoCardSamples)}`);
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
      const fortuneEmbed = await verifyFortuneEmbed(page);
      const apiReadiness = await verifyDevtoolsApiReadiness();
      const productionSmoke = await verifyCharacterProductionSmoke();
      const mappingRoundTrip = await verifyNanikaMappingRoundTrip();
      const compactLayouts = await verifyCompactDesktopLayouts(page);

      assertMetric(mapping.overviewMetrics.activeTab === "작업판", "Mapping workspace tab did not load.");
      assertTextFit(mapping.overviewTextFit, "Mapping overview");
      assertMetric(mapping.overviewMetrics.hasConnectionMap, "Connection map is missing.");
      assertMetric(mapping.overviewMetrics.hasEditorPanel, "Shared mapping editor panel is missing.");
      assertMetric(mapping.overviewMetrics.initialRuntimeCanvas, "Default editor canvas does not start from runtime.");
      assertMetric(mapping.overviewMetrics.initialCharacterCanvas, "Default editor canvas does not show the actual Rine character.");
      assertMetric(mapping.overviewMetrics.initialConditionNodeCount >= 2, "Default editor canvas does not show runtime/character condition cards.");
      assertMetric(mapping.overviewMetrics.initialResourceGroupCount >= 4, "Default editor canvas does not split character resources into groups.");
      assertMetric(mapping.overviewMetrics.initialCanvasEdgeCount > 0, "Default editor canvas edges do not render arrow markers.");
      assertMetric(mapping.overviewMetrics.initialStatsCount >= 6, "Editor summary stats are missing.");
      assertMetric(mapping.overviewMetrics.initialZoomText.includes("100%"), "Editor summary stats do not show zoom state.");
      assertMetric(mapping.overviewMetrics.runtimeProfileCardCount >= 2, "Runtime profile overview cards are missing.");
      assertMetric(mapping.overviewMetrics.runtimeProfileText.includes("fortune.home.rine"), "Runtime profile overview does not show the home profile.");
      assertMetric(mapping.overviewMetrics.runtimeProfileText.includes("fortune.zodiac.rine"), "Runtime profile overview does not show the zodiac profile.");
      assertMetric(!mapping.overviewMetrics.overviewAuxGraphVisible, "Auxiliary graph should not be visible on the main editor workspace.");
      assertMetric(mapping.editorZoomMetrics.zoomText.includes("110%"), "Editor zoom-in control did not update summary zoom state.");
      assertMetric(mapping.editorZoomMetrics.canvasWidth > mapping.editorZoomMetrics.viewportWidth * 0.95, "Editor zoom-in control did not scale the canvas.");
      assertMetric(mapping.defaultDeleteMetrics.deleteButtonWasEnabled, "Existing/default canvas cards should be deletable.");
      assertMetric(mapping.defaultDeleteMetrics.nodeRemoved, "Deleting an existing/default canvas card did not remove it from the board.");
      assertMetric(mapping.defaultDeleteMetrics.removedGroupMissing, "Deleted default canvas card is still visible.");
      assertMetric(mapping.conditionPaletteMetrics.hasConditionTab, "Condition card deck tab is missing.");
      assertMetric(mapping.conditionPaletteMetrics.conditionCardCount >= 2, "Condition card deck does not list runtime/character conditions.");
      assertMetric(mapping.conditionPaletteMetrics.runtimeConditionCardCount > 0, "Condition card deck does not show runtime conditions.");
      assertMetric(mapping.conditionPaletteMetrics.characterConditionCardCount > 0, "Condition card deck does not show character conditions.");
      assertMetric(mapping.runtimeConditionPathMetrics.visibleConditionScopes.length > 0, "Starting from runtime does not show condition cards.");
      assertMetric(mapping.runtimeConditionPathMetrics.visibleConditionScopes.every((scope) => scope === "runtime"), "Runtime connection path should show only runtime conditions.");
      assertMetric(mapping.characterPaletteMetrics.hasCharacterTab, "Character selection category is missing from the card deck.");
      assertMetric(mapping.characterPaletteMetrics.characterCardCount >= 1, "Character selection cards are missing from the editor deck.");
      assertMetric(mapping.characterSelectionMetrics.hasCharacterCanvasNode, "Selecting a character did not keep the character graph visible.");
      assertMetric(mapping.characterSelectionMetrics.characterNodeSelected, "Selected character was not highlighted on the editor canvas.");
      assertMetric(mapping.characterConditionPathMetrics.visibleConditionScopes.length > 0, "Starting from character does not show condition cards.");
      assertMetric(mapping.characterConditionPathMetrics.visibleConditionScopes.every((scope) => scope === "character"), "Character connection path should show only character conditions.");
      assertMetric(mapping.characterSceneGroupPathMetrics.hasCharacterPopover, "Character card did not open a connection popover.");
      assertMetric(mapping.characterSceneGroupPathMetrics.sceneGroupCardCount > 0, "Starting from the character card did not show the scene resource group.");
      assertMetric(mapping.characterSceneGroupPathMetrics.visibleGroupKinds.includes("scene"), "Character connection path did not expose stage/scene composition resources.");
      assertMetric(mapping.characterSceneGroupConnectMetrics.sceneGroupNodeAdded, "Selecting a scene resource group from the character path did not add it to the canvas.");
      assertMetric(mapping.characterSceneGroupConnectMetrics.edgeAdded, `Selecting a scene resource group from the character path did not connect it: ${JSON.stringify(mapping.characterSceneGroupConnectMetrics)}`);
      assertMetric(mapping.characterSceneGroupConnectMetrics.pendingCleared, "Character-to-scene group connection did not clear pending connection state.");
      assertMetric(mapping.sceneGroupFilterMetrics.hasSceneGroupPopover, "Scene resource group did not open a connection popover.");
      assertMetric(mapping.sceneGroupFilterMetrics.sceneResourceCardCount > 0, "Scene resource group did not show saved scene cards.");
      assertMetric(mapping.sceneGroupFilterMetrics.visibleResourceKinds.every((kind) => kind === "scene"), "Scene resource group should show only scene resources.");
      assertMetric(mapping.sceneResourceActionFilterMetrics.hasSceneResourcePopover, "Scene resource card did not open a connection popover.");
      assertMetric(mapping.sceneResourceActionFilterMetrics.actionCardCount > 0, "Scene resource card did not show compatible scene actions.");
      assertMetric(
        mapping.sceneResourceActionFilterMetrics.visibleActionMeta.every((item) => item !== "change_expression" && item !== "surface"),
        "Scene resource card should not show expression or surface actions.",
      );
      assertMetric(mapping.editorAppliedMetrics.hasSelectedFlow, "Applied mapping selection did not render in the shared editor.");
      assertTextFit(mapping.catalogListTextFit, "Catalog list diagram");
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
      assertTextFit(mapping.catalogFlowTextFit, "Catalog flow");
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
      if (!mapping.sceneActionResourceFilterMetrics.skippedBecauseSceneActionDisabled) {
        assertMetric(mapping.sceneActionResourceFilterMetrics.hasSceneActionPopover, "Scene action did not open a local connection popover.");
        assertMetric(mapping.sceneActionResourceFilterMetrics.visibleResourceKinds.length > 0, "Scene action did not show any scene resources.");
        assertMetric(mapping.sceneActionResourceFilterMetrics.visibleResourceKinds.every((kind) => kind === "scene"), "Scene action resource candidates should include only saved scenes.");
      }
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
      assertMetric(mapping.featureSetMetrics.hasFeatureSetClonePanel, "Feature set clone panel is missing.");
      assertMetric(mapping.featureSetMetrics.featureSetCloneSourceCount > 0, "Feature set clone source list is empty.");
      assertMetric(mapping.featureSetMetrics.featureSetCloneCharacterCount > 0, "Feature set clone character list is empty.");
      assertMetric(mapping.featureSetMetrics.featureSetClonePreviewText.length > 0, "Feature set clone preview is empty.");
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
      assertTextFit(sceneEditor.textFit, "Scene editor");
      assertMetric(sceneEditor.metrics.hasSceneSelect, "Scene selector is missing.");
      assertMetric(sceneEditor.metrics.hasSceneList, "Scene list is missing.");
      assertMetric(sceneEditor.metrics.sceneCardCount > 0, "Scene list has no saved scene cards.");
      assertMetric(sceneEditor.metrics.hasDemoSceneOption, "Rine demo scene option is missing.");
      assertMetric(sceneEditor.metrics.hasDeleteButton, "Scene delete button is missing.");
      assertMetric(sceneEditor.metrics.hasWorkbenchTitle, "Scene editor should label the right panel as a workbench.");
      assertMetric(sceneEditor.metrics.hasWorkbenchGuide, "Scene editor workbench guide is missing.");
      assertMetric(sceneEditor.metrics.previewHasNoSaveActions, "Scene preview panel should stay focused on preview instead of duplicating save/delete actions.");
      assertMetric(sceneEditor.metrics.previewPanelOnRight, "Scene preview panel should sit to the right on desktop.");
      assertMetric(sceneEditor.metrics.previewHasStableArea, "Scene preview area is too small.");
      assertMetric(sceneEditor.metrics.savedSmokeSceneVisible, "Scene editor did not show a newly saved scene.");
      assertMetric(sceneEditor.metrics.uncheckedDefaultSceneStayedUnchecked, "Scene editor rechecked an explicitly non-default scene after save.");
      assertMetric(sceneEditor.metrics.uncheckedDefaultSceneOutputCleared, "Scene editor preview still reports an unchecked scene as default.");
      assertMetric(sceneEditor.metrics.uncheckedSceneLabelDoesNotShowDefault, "Scene selector labels an unchecked scene as default.");
      assertMetric(sceneEditor.metrics.smokeSceneDeleted, "Scene editor did not remove a deleted scene from the selector.");
      assertMetric(!sceneEditor.metrics.overflowX, "Scene editor has horizontal overflow.");
      assertTextFit(layerEditor.textFit, "Layer editor");
      assertMetric(layerEditor.metrics.hasSurfaceSelect, "Layer editor surface selector is missing.");
      assertMetric(layerEditor.metrics.hasPreviewPanel, "Layer editor preview panel did not open after selecting a surface.");
      assertMetric(layerEditor.metrics.hasWorkbenchTitle, "Layer editor should label the right panel as a workbench.");
      assertMetric(layerEditor.metrics.hasWorkbenchGuide, "Layer editor workbench guide is missing.");
      assertMetric(layerEditor.metrics.hasPlaybackControls, "Layer editor playback controls are missing.");
      assertMetric(layerEditor.metrics.hasZoomControls, "Layer editor zoom controls are missing.");
      assertMetric(layerEditor.metrics.hasSaveActions, "Layer editor save/delete actions are missing.");
      assertMetric(layerEditor.metrics.hasStepwiseReveal, "Layer editor controls should reveal after selecting a surface and part.");
      assertMetric(layerEditor.metrics.previewOnRight, "Layer editor preview panel should sit to the right on desktop.");
      assertMetric(layerEditor.metrics.previewHasStableArea, "Layer editor preview area is too small.");
      assertMetric(layerEditor.metrics.controlsOnLeft, "Layer editor controls should stay in the left settings flow.");
      assertMetric(layerEditor.metrics.previewPanelHasNoControls, "Layer editor preview panel should not contain form or action controls.");
      assertMetric(!layerEditor.metrics.overflowX, "Layer editor has horizontal overflow.");
      assertTextFit(cropEditor.textFit, "Crop editor");
      assertMetric(cropEditor.initialStepMetrics.adjustHiddenBeforeImage, "Crop editor region controls should stay hidden before selecting an image.");
      assertMetric(cropEditor.initialStepMetrics.actionHiddenBeforeImage, "Crop editor actions should stay hidden before selecting an image.");
      assertMetric(cropEditor.metrics.hasRecipeSelect, "Crop editor recipe selector is missing.");
      assertMetric(cropEditor.metrics.hasRegionInputs, "Crop editor region inputs are missing.");
      assertMetric(cropEditor.metrics.hasDownloadAction, "Crop editor download action is missing.");
      assertMetric(cropEditor.metrics.hasWorkbenchTitle, "Crop editor should label the right panel as a workbench.");
      assertMetric(cropEditor.metrics.hasStepwiseReveal, "Crop editor controls should reveal after selecting an image.");
      assertMetric(cropEditor.metrics.previewOnRight, "Crop editor preview panel should sit to the right on desktop.");
      assertMetric(cropEditor.metrics.previewHasStableArea, "Crop editor preview area is too small.");
      assertMetric(!cropEditor.metrics.overflowX, "Crop editor has horizontal overflow.");
      characterEditors.forEach((editor) => {
        assertMetric(editor.hasHeading, `${editor.page} has no heading.`);
        assertMetric(editor.hasMain, `${editor.page} has no main shell.`);
        assertMetric(editor.hasProductionFlow, `${editor.page} is missing the left-to-right production flow.`);
        assertMetric(editor.hasConceptMap, `${editor.page} is missing the character concept map.`);
        assertMetric(editor.hasProductionModel, `${editor.page} is missing the production model.`);
        assertMetric(editor.hasProductionLanes, `${editor.page} is missing production lanes.`);
        assertMetric(editor.hasLockedOrNextStep, `${editor.page} does not show locked/next/complete step guidance.`);
        assertMetric(editor.hasReadinessMap, `${editor.page} is missing the character readiness map.`);
        assertMetric(editor.hasCommonKeyRegistry, `${editor.page} is missing the common role key registry.`);
        assertMetric(editor.hasBoundCommonKey, `${editor.page} does not show any bound common role key.`);
        assertMetric(editor.hasResultMap, `${editor.page} is missing the step result map.`);
        if (editor.page === "dev-character-expression.html") {
          assertMetric(editor.expressionPickerMetrics?.hasChoiceGrid, "Expression editor image choice grid is missing.");
          assertMetric(editor.expressionPickerMetrics?.cardCount > 0, "Expression editor does not show image choice cards.");
          assertMetric(editor.expressionPickerMetrics?.nativeSelectHidden, "Expression editor native multi-select should be hidden behind card choices.");
          assertMetric(
            editor.expressionPickerMetrics?.selectedCountAfterClick === editor.expressionPickerMetrics?.selectedOptionCountAfterClick,
            "Expression card selection did not stay synced with the saved select values.",
          );
          assertMetric(editor.expressionPickerMetrics?.previewCardCountAfterClick > 0, "Expression card selection did not update preview cards.");
        }
        assertMetric(!editor.overflowX, `${editor.page} has horizontal overflow.`);
        assertTextFit(editor.textFit, editor.page);
      });
      assertTextFit(runtime.textFit, "Runtime demo");
      assertMetric(runtime.metrics.hasStage, "Runtime character stage is missing.");
      assertMetric(runtime.metrics.hasSprite, "Runtime character sprite is missing.");
      assertMetric(runtime.metrics.hasSpeechBalloon, "Runtime speech balloon is missing.");
      assertMetric(runtime.metrics.ignoredStoredRuntimeTheme, "Runtime applied stale stored balloon theme over mapped preset options.");
      assertMetric(!runtime.metrics.initialSceneId, "Runtime applied a scene before an explicit scene action.");
      assertMetric(runtime.metrics.sceneId === "rine-demo-scene", "Runtime did not apply the Rine demo scene.");
      assertMetric(runtime.metrics.hasSceneLayer, "Runtime scene layer did not render.");
      assertMetric(runtime.metrics.overlayVisible, "Runtime scene overlay did not render.");
      assertMetric(runtime.metrics.overlayRemoved, "Runtime scene overlay did not auto-remove.");
      assertMetric(runtime.metrics.managementMenuVisible, "Runtime management menu did not open.");
      assertMetric(runtime.metrics.visibleManagementMenuId === "balloonActionMenu", "Runtime applied stale stored management menu display over mapped preset options.");
      assertMetric(runtime.metrics.managementMenuButtonCount > 0, "Runtime management menu opened without actionable items.");
      assertMetric(!runtime.metrics.overflowX, "Runtime demo has horizontal overflow.");
      assertTextFit(fortuneEmbed.textFit, "Fortune embed");
      assertMetric(fortuneEmbed.initial.hasMount, "Fortune embed mount is missing.");
      assertMetric(fortuneEmbed.initial.hasStage, "Fortune embed stage is missing.");
      assertMetric(fortuneEmbed.initial.hasSprite, "Fortune embed sprite is missing.");
      assertMetric(fortuneEmbed.initial.hasSpeechBalloon, "Fortune embed speech balloon is missing.");
      assertMetric(fortuneEmbed.initial.speechLayout === "dialogue-box", "Fortune embed should use the dialogue-box layout.");
      assertMetric(fortuneEmbed.initial.speechPlacement === "overlay-bottom", "Fortune embed should use the bottom overlay placement.");
      assertMetric(fortuneEmbed.initial.speechAnchor === "right", "Fortune embed should anchor the dialogue overlay to the right.");
      assertMetric(fortuneEmbed.initial.speechWithinStage, "Fortune embed speech balloon escaped the stage boundary.");
      assertMetric(fortuneEmbed.initial.speechAnchoredRight, "Fortune embed speech balloon is not visually anchored to the right.");
      assertMetric(fortuneEmbed.initial.runtimeRootCount === 1, "Fortune embed should create exactly one runtime root.");
      assertMetric(fortuneEmbed.initial.runtimeRootOutsideCount === 0, "Fortune embed runtime root escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.stageOutsideCount === 0, "Fortune embed stage escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.speechOutsideCount === 0, "Fortune embed speech UI escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.spriteOutsideCount === 0, "Fortune embed sprite escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.sceneLayerOutsideCount === 0, "Fortune embed scene layers escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.menuOutsideCount === 0, "Fortune embed menus escaped the mount boundary.");
      assertMetric(fortuneEmbed.initial.mountWithinScreen, "Fortune embed mount does not stay inside the host screen.");
      assertMetric(fortuneEmbed.initial.stageWithinMount, "Fortune embed stage does not stay inside the mount.");
      assertMetric(!fortuneEmbed.initial.overflowX, "Fortune embed initial page has horizontal overflow.");
      assertMetric(
        fortuneEmbed.initial.sceneId === "desk-room" || fortuneEmbed.initial.sceneId === "desk-room-default",
        `Fortune embed did not apply the home initial scene: ${fortuneEmbed.initial.sceneId}`,
      );
      assertMetric(fortuneEmbed.initial.sceneLayerCount > 0, "Fortune embed initial scene did not render any scene layers.");
      assertMetric(fortuneEmbed.afterZodiac.bootText.includes("ready #2"), "Fortune embed did not recreate runtime for the zodiac page.");
      assertMetric(fortuneEmbed.afterZodiac.runtimeRootCount === 1, "Fortune embed duplicated runtime roots after page movement.");
      assertMetric(fortuneEmbed.afterZodiac.stageCountInsideMount === 1, "Fortune embed duplicated stages after page movement.");
      assertMetric(fortuneEmbed.afterZodiac.surfaceId === "8", "Fortune embed did not apply the zodiac initial surface.");
      assertMetric(fortuneEmbed.afterHostEvent.speechText.length > 0, "Fortune embed host event did not drive Nanika speech.");
      assertMetric(fortuneEmbed.afterRestart.bootText.includes("ready #3"), "Fortune embed restart did not recreate the runtime.");
      assertMetric(fortuneEmbed.afterRestart.runtimeRootCount === 1, "Fortune embed duplicated runtime roots after restart.");
      assertMetric(fortuneEmbed.afterRestart.stageCountInsideMount === 1, "Fortune embed duplicated stages after restart.");
      assertMetric(fortuneEmbed.afterRestart.sceneLayerRootCount <= 1, "Fortune embed duplicated scene layer roots after restart.");
      assertMetric(!fortuneEmbed.afterRestart.overflowX, "Fortune embed restart caused horizontal overflow.");
      assertMetric(apiReadiness.workspaceHasSourceDirectory, "Character workspace source directory is missing.");
      assertMetric(apiReadiness.workspaceHasBrowserPrefix, "Character workspace browser prefix is missing.");
      assertMetric(apiReadiness.characterCount >= 2, "Character list is unexpectedly small.");
      assertMetric(apiReadiness.hasRine, "Rine character is missing from the devtools character list.");
      assertMetric(apiReadiness.rineExpressionCount > 0, "Rine expressions did not load through the character assets API.");
      assertMetric(apiReadiness.rineSurfaceCount > 0, "Rine surfaces did not load through the character assets API.");
      assertMetric(apiReadiness.rineSceneCount > 0, "Rine scenes did not load through the character assets API.");
      assertMetric(apiReadiness.assetFileCount > 0, "Character asset file list did not load.");
      assertMetric(apiReadiness.hasSeparatedAssetKinds, "Character asset file list does not expose separated asset kinds.");
      assertMetric(apiReadiness.mappingCount > 0, "Nanika mapping list did not load.");
      assertMetric(apiReadiness.featureSetCount > 0, "Nanika feature set list did not load.");
      assertMetric(productionSmoke.hasSavedFlow, "New character production smoke did not save expression/surface/layer/scene data.");
      assertMetric(productionSmoke.hasCleanedFlow, "New character production smoke did not delete saved expression/surface/layer/scene data.");
      assertMetric(productionSmoke.characterDeleted, "Temporary smoke character was not deleted.");
      assertMetric(mappingRoundTrip.saved, "Temporary Nanika mapping was not saved.");
      assertMetric(mappingRoundTrip.savedSceneAction, "Temporary Nanika mapping did not persist the scene action.");
      assertMetric(mappingRoundTrip.savedLogAction, "Temporary Nanika mapping did not persist the log action.");
      assertMetric(mappingRoundTrip.deleted, "Temporary Nanika mapping was not deleted.");
      compactLayouts.forEach((layout) => {
        assertMetric(layout.hasVisibleHeading, `${layout.page} heading is not visible at 1366x768.`);
        assertMetric(!layout.overflowX, `${layout.page} has horizontal overflow at 1366x768.`);
        assertMetric(layout.productionFlowCount === 5 || layout.page === "dev-nanika-mapping.html", `${layout.page} lost the five-step character flow at 1366x768.`);
        assertMetric(layout.mappingDeckScrollsInternally, `${layout.page} card deck does not scroll internally at 1366x768.`);
        assertTextFit(layout.textFit, `${layout.page} compact desktop`);
      });

      console.log(JSON.stringify({
        ok: true,
        baseUrl,
        mapping,
        sceneEditor,
        layerEditor,
        cropEditor,
        characterEditors,
        runtime,
        fortuneEmbed,
        apiReadiness,
        productionSmoke,
        mappingRoundTrip,
        compactLayouts,
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
