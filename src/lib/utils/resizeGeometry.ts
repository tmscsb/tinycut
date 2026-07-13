export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

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
  frames: ResizeFrame[],
  pageWidthMm: number,
  pageHeightMm: number,
): { dxMm: number; dyMm: number } {
  if (!frames.length) return { dxMm: 0, dyMm: 0 };
  const minX = Math.min(...frames.map((frame) => frame.xMm));
  const minY = Math.min(...frames.map((frame) => frame.yMm));
  const maxX = Math.max(...frames.map((frame) => frame.xMm + frame.widthMm));
  const maxY = Math.max(...frames.map((frame) => frame.yMm + frame.heightMm));
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
