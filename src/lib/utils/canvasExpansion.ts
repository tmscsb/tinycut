export type ScrollMetrics = {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export type CanvasPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const INITIAL_CANVAS_PADDING_PX = 1000;
export const CANVAS_EXPAND_THRESHOLD_PX = 240;
export const CANVAS_EXPAND_STEP_PX = 800;

export function emptyPaddingDelta(): CanvasPadding {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function needsExpansion(delta: CanvasPadding): boolean {
  return delta.left > 0 || delta.top > 0 || delta.right > 0 || delta.bottom > 0;
}

export function addPadding(base: CanvasPadding, delta: CanvasPadding): CanvasPadding {
  return {
    top: base.top + delta.top,
    right: base.right + delta.right,
    bottom: base.bottom + delta.bottom,
    left: base.left + delta.left,
  };
}

export function paddingCss(pad: CanvasPadding): string {
  return `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`;
}

/** Grow only the sides the viewport is approaching, so the opposite edges stay put. */
export function expansionForScroll(
  metrics: ScrollMetrics,
  threshold = CANVAS_EXPAND_THRESHOLD_PX,
  step = CANVAS_EXPAND_STEP_PX,
): CanvasPadding {
  const roomRight = metrics.scrollWidth - metrics.clientWidth - metrics.scrollLeft;
  const roomBottom = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return {
    left: metrics.scrollLeft < threshold ? step : 0,
    top: metrics.scrollTop < threshold ? step : 0,
    right: roomRight < threshold ? step : 0,
    bottom: roomBottom < threshold ? step : 0,
  };
}
