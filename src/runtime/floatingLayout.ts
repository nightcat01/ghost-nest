import type { RuntimeElements } from "./domElements.js";

type FloatingLayoutOptions = {
  elements: RuntimeElements;
};

const topMargin = 16;
const defaultStageGap = 12;
const minContentHeight = 96;
const minPanelContentHeight = 48;
const overlayViewportSelector = ":scope > .scene-viewport";

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

function readPixelCustomProperty(styles: CSSStyleDeclaration, name: string) {
  const value = styles.getPropertyValue(name).trim();

  if (!value.endsWith("px")) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function clearAuthoredOverlayViewportSize(elements: RuntimeElements) {
  const viewport = elements.stage.querySelector<HTMLElement>(overlayViewportSelector);

  viewport?.style.removeProperty("--scene-viewport-width");
  viewport?.style.removeProperty("--scene-viewport-height");
}

function clearViewportCharacterFitSize(elements: RuntimeElements) {
  elements.sprite.style.removeProperty("--character-fit-width");
  elements.sprite.style.removeProperty("--character-fit-height");
  elements.sprite.style.removeProperty("--character-fit-x");
}

function refreshAuthoredOverlayViewportSize(elements: RuntimeElements) {
  const { stage } = elements;

  if (
    stage.dataset.stageMode !== "fill"
    || stage.dataset.sceneCanvas !== "authored"
  ) {
    clearAuthoredOverlayViewportSize(elements);
    return;
  }

  const viewport = stage.querySelector<HTMLElement>(overlayViewportSelector);

  if (!viewport) {
    return;
  }

  const stageStyles = window.getComputedStyle(stage);
  const canvasWidth = readPixelCustomProperty(stageStyles, "--scene-canvas-width");
  const canvasHeight = readPixelCustomProperty(stageStyles, "--scene-canvas-height");
  const stageRect = stage.getBoundingClientRect();
  const speechRect = elements.speechBalloon?.getBoundingClientRect();
  const speechHeight = speechRect?.height ?? 0;
  const speechConsumesSpace = Boolean(stage.dataset.speechHidden !== "true"
    && stage.dataset.speechPlacement !== "overlay-bottom"
    && elements.speechBalloon
    && !elements.speechBalloon.hidden
    && window.getComputedStyle(elements.speechBalloon).display !== "none"
    && speechHeight > 0);
  const availableWidth = stageRect.width;
  const availableHeight = speechConsumesSpace
    ? Math.max(0, stageRect.height - speechHeight - getStageGap(elements))
    : stageRect.height;

  if (!canvasWidth || !canvasHeight || availableWidth <= 0 || availableHeight <= 0) {
    clearAuthoredOverlayViewportSize(elements);
    return;
  }

  const canvasAspectRatio = canvasWidth / canvasHeight;
  const availableAspectRatio = availableWidth / availableHeight;
  const viewportWidth = availableAspectRatio > canvasAspectRatio
    ? availableWidth
    : availableHeight * canvasAspectRatio;
  const viewportHeight = availableAspectRatio > canvasAspectRatio
    ? availableWidth / canvasAspectRatio
    : availableHeight;

  viewport.style.setProperty("--scene-viewport-width", `${Math.ceil(viewportWidth)}px`);
  viewport.style.setProperty("--scene-viewport-height", `${Math.ceil(viewportHeight)}px`);
}

function refreshViewportCharacterFitSize(elements: RuntimeElements) {
  const viewport = elements.stage.querySelector<HTMLElement>(overlayViewportSelector);

  if (
    !viewport
    || elements.stage.dataset.stageMode !== "fill"
    || elements.sprite.parentElement !== viewport
    || (
      elements.stage.dataset.characterInScene === "true"
      && elements.stage.dataset.sceneCharacterPlacement === "percent"
    )
  ) {
    clearViewportCharacterFitSize(elements);
    return;
  }

  const naturalWidth = elements.spriteImage.naturalWidth;
  const naturalHeight = elements.spriteImage.naturalHeight;
  const viewportRect = viewport.getBoundingClientRect();

  if (naturalWidth <= 0 || naturalHeight <= 0 || viewportRect.width <= 0 || viewportRect.height <= 0) {
    clearViewportCharacterFitSize(elements);
    return;
  }

  const imageRatio = naturalWidth / naturalHeight;
  const viewportRatio = viewportRect.width / viewportRect.height;
  const fitWidth = viewportRatio > imageRatio
    ? viewportRect.height * imageRatio
    : viewportRect.width;
  const fitHeight = viewportRatio > imageRatio
    ? viewportRect.height
    : viewportRect.width / imageRatio;
  const fitX = (viewportRect.width - fitWidth) / 2;

  elements.sprite.style.setProperty("--character-fit-width", `${Math.ceil(fitWidth)}px`);
  elements.sprite.style.setProperty("--character-fit-height", `${Math.ceil(fitHeight)}px`);
  elements.sprite.style.setProperty("--character-fit-x", `${Math.floor(fitX)}px`);
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
    refreshAuthoredOverlayViewportSize(elements);
    refreshViewportCharacterFitSize(elements);

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
  elements.spriteImage.addEventListener("load", scheduleRefresh);
  scheduleRefresh();

  return () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
    }

    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleRefresh);
    elements.spriteImage.removeEventListener("load", scheduleRefresh);
    elements.stage.style.removeProperty("--floating-content-max-height");
    elements.stage.style.removeProperty("--runtime-area-width");
    elements.stage.style.removeProperty("--runtime-area-height");
    clearAuthoredOverlayViewportSize(elements);
    clearViewportCharacterFitSize(elements);
    delete elements.stage.dataset.floatingLayout;
  };
}
