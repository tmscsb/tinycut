function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Canvas encodes at 96 DPI. Store the requested print density in a PNG pHYs chunk. */
export function setPngDensity(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!Number.isFinite(dpi) || dpi <= 0 || signature.some((value, index) => bytes[index] !== value)) {
    throw new Error("Invalid PNG or print density");
  }
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let inserted = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error("Truncated PNG");
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error("Truncated PNG chunk");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.subarray(offset, end));
    if (type === "IHDR") { parts.push(chunk); inserted = true; }
    offset = end;
  }
  if (!inserted) throw new Error("Missing PNG header");
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
