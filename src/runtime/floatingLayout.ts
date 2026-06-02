import type { RuntimeElements } from "./domElements.js";

type FloatingLayoutOptions = {
  elements: RuntimeElements;
};

const topMargin = 16;
const defaultStageGap = 12;
const minContentHeight = 96;
const minPanelContentHeight = 48;

function getObservedElements(elements: RuntimeElements) {
  return [
    elements.speechBalloon,
    elements.balloonActionMenu,
    elements.panelActionMenu,
  ].filter((element): element is HTMLElement => Boolean(element));
}

function getStageGap(elements: RuntimeElements) {
  const styles = window.getComputedStyle(elements.stage);
  const rowGap = Number.parseFloat(styles.rowGap);

  if (Number.isFinite(rowGap)) {
    return rowGap;
  }

  const gap = Number.parseFloat(styles.gap);
  return Number.isFinite(gap) ? gap : defaultStageGap;
}

function getLayoutBounds(elements: RuntimeElements) {
  if (elements.root instanceof Element) {
    return elements.root.getBoundingClientRect();
  }

  const offsetParent = elements.stage.offsetParent;

  if (offsetParent instanceof HTMLElement) {
    return offsetParent.getBoundingClientRect();
  }

  return document.documentElement.getBoundingClientRect();
}

function refreshRuntimeAreaVariables(elements: RuntimeElements) {
  const layoutBounds = getLayoutBounds(elements);

  elements.stage.style.setProperty("--runtime-area-width", `${Math.max(0, Math.floor(layoutBounds.width))}px`);
  elements.stage.style.setProperty("--runtime-area-height", `${Math.max(0, Math.floor(layoutBounds.height))}px`);
}

function getBottomAnchoredAvailableHeight(elements: RuntimeElements) {
  const layoutBounds = getLayoutBounds(elements);
  const stageRect = elements.stage.getBoundingClientRect();
  const spriteRect = elements.sprite.getBoundingClientRect();
  const bottomGap = Math.max(0, layoutBounds.bottom - stageRect.bottom);

  return layoutBounds.height - bottomGap - spriteRect.height - getStageGap(elements) - topMargin;
}

function getCustomAvailableHeight(elements: RuntimeElements) {
  const layoutBounds = getLayoutBounds(elements);
  const spriteRect = elements.sprite.getBoundingClientRect();

  return spriteRect.top - layoutBounds.top - topMargin;
}

function refreshManagementPanelMaxHeight(elements: RuntimeElements) {
  const panelElement = elements.panelActionMenu;

  if (!panelElement || panelElement.hidden) {
    panelElement?.style.removeProperty("--management-panel-max-height");
    return;
  }

  const layoutBounds = getLayoutBounds(elements);
  const spriteRect = elements.sprite.getBoundingClientRect();
  const availableHeight = Math.min(spriteRect.height, layoutBounds.height - topMargin * 2);
  const maxHeight = Math.max(0, Math.floor(availableHeight));

  panelElement.style.setProperty(
    "--management-panel-max-height",
    `${Math.max(minPanelContentHeight, maxHeight)}px`,
  );
}

export function initFloatingLayout({ elements }: FloatingLayoutOptions) {
  let animationFrameId: number | null = null;

  function refresh() {
    animationFrameId = null;
    refreshRuntimeAreaVariables(elements);

    const rawAvailableHeight = elements.stage.dataset.positionMode === "custom"
      ? getCustomAvailableHeight(elements)
      : getBottomAnchoredAvailableHeight(elements);
    const layoutBounds = getLayoutBounds(elements);
    const boundsLimitedHeight = Math.min(rawAvailableHeight, layoutBounds.height - topMargin * 2);
    const availableHeight = Math.max(minContentHeight, Math.floor(boundsLimitedHeight));

    elements.stage.style.setProperty("--floating-content-max-height", `${availableHeight}px`);
    elements.stage.dataset.floatingLayout = availableHeight < 180 ? "compact" : "default";
    refreshManagementPanelMaxHeight(elements);
  }

  function scheduleRefresh() {
    if (animationFrameId !== null) {
      return;
    }

    animationFrameId = window.requestAnimationFrame(refresh);
  }

  const mutationObserver = new MutationObserver(scheduleRefresh);
  getObservedElements(elements).forEach((element) => {
    mutationObserver.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  });

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(scheduleRefresh)
    : null;

  resizeObserver?.observe(elements.stage);
  resizeObserver?.observe(elements.sprite);
  if (elements.root instanceof Element) {
    resizeObserver?.observe(elements.root);
  }
  window.addEventListener("resize", scheduleRefresh);
  scheduleRefresh();

  return () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }

    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleRefresh);
    elements.stage.style.removeProperty("--floating-content-max-height");
    elements.stage.style.removeProperty("--runtime-area-width");
    elements.stage.style.removeProperty("--runtime-area-height");
    delete elements.stage.dataset.floatingLayout;
  };
}
