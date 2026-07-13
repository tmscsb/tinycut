function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function loadImageFile(file: File): Promise<{
  src: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
}> {
  const src = await fileToDataUrl(file);

  const img = new Image();
  img.src = src;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error("Image dimensions are invalid");
  }

  return {
    src,
    naturalWidthPx: img.naturalWidth,
    naturalHeightPx: img.naturalHeight,
  };
}
