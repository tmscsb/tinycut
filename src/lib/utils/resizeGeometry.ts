export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RESIZE_DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

export function getRotatedResizeCursor(handle: ResizeHandle, rotationDeg: number): string {
  const baseIndex = RESIZE_DIRECTIONS.indexOf(handle);
  const directionSteps = Math.round(rotationDeg / 45);
  const directionIndex = ((baseIndex + directionSteps) % 8 + 8) % 8;
  return `${RESIZE_DIRECTIONS[directionIndex]}-resize`;
}

export type ResizeFrame = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

type ResizeOptions = {
  lockedAspectRatio: boolean;
  minSizeMm: number;
  rotationDeg: number;
  snapStepMm?: number;
};

export function getGroupCenteringDelta(
  frames: (ResizeFrame & { rotationDeg?: number })[],
  pageWidthMm: number,
  pageHeightMm: number,
): { dxMm: number; dyMm: number } {
  if (!frames.length) return { dxMm: 0, dyMm: 0 };
  const bounds = frames.map((frame) => {
    const angle = (frame.rotationDeg ?? 0) * Math.PI / 180;
    const halfWidth = (Math.abs(Math.cos(angle)) * frame.widthMm + Math.abs(Math.sin(angle)) * frame.heightMm) / 2;
    const halfHeight = (Math.abs(Math.sin(angle)) * frame.widthMm + Math.abs(Math.cos(angle)) * frame.heightMm) / 2;
    const centerX = frame.xMm + frame.widthMm / 2;
    const centerY = frame.yMm + frame.heightMm / 2;
    return { minX: centerX - halfWidth, maxX: centerX + halfWidth, minY: centerY - halfHeight, maxY: centerY + halfHeight };
  });
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  return {
    dxMm: (pageWidthMm - (maxX - minX)) / 2 - minX,
    dyMm: (pageHeightMm - (maxY - minY)) / 2 - minY,
  };
}

export function screenDeltaToLocal(
  dx: number,
  dy: number,
  rotationDeg: number,
): { dx: number; dy: number } {
  const radians = rotationDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    dx: cos * dx + sin * dy,
    dy: -sin * dx + cos * dy,
  };
}

function rotate(x: number, y: number, rotationDeg: number): { x: number; y: number } {
  const radians = rotationDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: cos * x - sin * y, y: sin * x + cos * y };
}

function snap(value: number, step?: number): number {
  return step && step > 0 ? Math.round(value / step) * step : value;
}

export function resizeFrameFromScreenDelta(
  start: ResizeFrame,
  handle: ResizeHandle,
  screenDxMm: number,
  screenDyMm: number,
  options: ResizeOptions,
): ResizeFrame {
  const local = screenDeltaToLocal(screenDxMm, screenDyMm, options.rotationDeg);
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");

  let widthMm = east
    ? start.widthMm + local.dx
    : west ? start.widthMm - local.dx : start.widthMm;
  let heightMm = south
    ? start.heightMm + local.dy
    : north ? start.heightMm - local.dy : start.heightMm;

  if (options.lockedAspectRatio) {
    const aspect = start.widthMm / start.heightMm || 1;
    if (east || west) {
      if (north || south) {
        const widthChange = Math.abs((widthMm - start.widthMm) / start.widthMm);
        const heightChange = Math.abs((heightMm - start.heightMm) / start.heightMm);
        if (heightChange > widthChange) widthMm = heightMm * aspect;
        else heightMm = widthMm / aspect;
      } else {
        heightMm = widthMm / aspect;
      }
    } else {
      widthMm = heightMm * aspect;
    }
    if (widthMm < options.minSizeMm || heightMm < options.minSizeMm) {
      heightMm = Math.max(options.minSizeMm, options.minSizeMm / aspect);
      widthMm = heightMm * aspect;
    }
  } else {
    widthMm = snap(widthMm, options.snapStepMm);
    heightMm = snap(heightMm, options.snapStepMm);
    widthMm = Math.max(options.minSizeMm, widthMm);
    heightMm = Math.max(options.minSizeMm, heightMm);
  }

  const anchorX = east ? -0.5 : west ? 0.5 : 0;
  const anchorY = south ? -0.5 : north ? 0.5 : 0;
  const centerX = start.xMm + start.widthMm / 2;
  const centerY = start.yMm + start.heightMm / 2;
  const oldAnchorOffset = rotate(
    anchorX * start.widthMm,
    anchorY * start.heightMm,
    options.rotationDeg,
  );
  const newAnchorOffset = rotate(
    anchorX * widthMm,
    anchorY * heightMm,
    options.rotationDeg,
  );
  const fixedX = centerX + oldAnchorOffset.x;
  const fixedY = centerY + oldAnchorOffset.y;
  const newCenterX = fixedX - newAnchorOffset.x;
  const newCenterY = fixedY - newAnchorOffset.y;

  return {
    xMm: newCenterX - widthMm / 2,
    yMm: newCenterY - heightMm / 2,
    widthMm,
    heightMm,
  };
}
