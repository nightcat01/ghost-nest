import type { RuntimeSelectors } from "../core/types.js";

export type RuntimeElements = ReturnType<typeof getRuntimeElements>;

function resolveRuntimeRoot(root: ParentNode | string | undefined): ParentNode {
  if (!root) {
    return document;
  }

  if (typeof root !== "string") {
    return root;
  }

  const element = document.querySelector<HTMLElement>(root);

  if (!element) {
    throw new Error(`Runtime root is missing: ${root}`);
  }

  return element;
}

function requiredElement<TElement extends Element>(root: ParentNode, selector: string): TElement {
  const element = root.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Required element is missing: ${selector}`);
  }

  return element;
}

function optionalElement<TElement extends Element>(root: ParentNode, selector: string | undefined): TElement | null {
  if (!selector) {
    return null;
  }

  return root.querySelector<TElement>(selector);
}

export function getRuntimeElements(selectors: RuntimeSelectors, root?: ParentNode | string) {
  const runtimeRoot = resolveRuntimeRoot(root);

  return {
    root: runtimeRoot,
    stage: requiredElement<HTMLElement>(runtimeRoot, selectors.stage),
    sprite: requiredElement<HTMLButtonElement>(runtimeRoot, selectors.sprite),
    spriteImage: requiredElement<HTMLImageElement>(runtimeRoot, selectors.spriteImage),
    speechBalloon: optionalElement<HTMLElement>(runtimeRoot, selectors.speechBalloon),
    speakerName: requiredElement<HTMLSpanElement>(runtimeRoot, selectors.speakerName),
    speechText: requiredElement<HTMLParagraphElement>(runtimeRoot, selectors.speechText),
    balloonActionMenu: optionalElement<HTMLElement>(runtimeRoot, selectors.balloonActionMenu),
    panelActionMenu: optionalElement<HTMLElement>(runtimeRoot, selectors.panelActionMenu),
    menuButtons: runtimeRoot.querySelectorAll<HTMLButtonElement>(selectors.menuButtons),
    restoreBadge: optionalElement<HTMLElement>(runtimeRoot, selectors.restoreBadge),
    observeAreas: runtimeRoot.querySelectorAll<HTMLElement>(selectors.observeAreas),
  };
}
