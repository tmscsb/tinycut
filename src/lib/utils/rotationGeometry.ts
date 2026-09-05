export function pointerAngleDegrees(
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number,
): number {
  return Math.atan2(pointerY - centerY, pointerX - centerX) * 180 / Math.PI;
}

export function shortestAngleDelta(fromDegrees: number, toDegrees: number): number {
  return ((toDegrees - fromDegrees + 540) % 360) - 180;
}

export function snapRotationDegrees(degrees: number, stepDegrees = 15): number {
  if (!Number.isFinite(stepDegrees) || stepDegrees <= 0) return degrees;
  return Math.round(degrees / stepDegrees) * stepDegrees;
}

export function getMagneticCardinalRotation(
  degrees: number,
  lockedCardinal: number | null,
  acquireThreshold = 4,
  releaseThreshold = 8,
): { degrees: number; lockedCardinal: number | null } {
  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(acquireThreshold) ||
    !Number.isFinite(releaseThreshold) ||
    acquireThreshold < 0 ||
    releaseThreshold < acquireThreshold
  ) {
    return { degrees, lockedCardinal: null };
  }

  if (
    lockedCardinal !== null &&
    Number.isFinite(lockedCardinal) &&
    Math.abs(degrees - lockedCardinal) <= releaseThreshold
  ) {
    return { degrees: lockedCardinal, lockedCardinal };
  }

  const nearestCardinal = Math.round(degrees / 90) * 90 || 0;
  if (Math.abs(degrees - nearestCardinal) <= acquireThreshold) {
    return { degrees: nearestCardinal, lockedCardinal: nearestCardinal };
  }

  return { degrees, lockedCardinal: null };
}
