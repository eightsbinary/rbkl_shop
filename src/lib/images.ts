export const IMAGE_SIZES = [400, 800, 1600] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export function computeTargetSize(source: Dimensions, maxWidth: number): Dimensions {
  if (source.width <= maxWidth) return source;
  const ratio = maxWidth / source.width;
  return {
    width: maxWidth,
    height: Math.round(source.height * ratio),
  };
}

/**
 * Client-side resize a File to a webp Blob at the given max-width.
 * Uses the browser Canvas API — throws if called server-side.
 */
export async function resizeImageToWebp(
  file: File,
  maxWidth: number,
  quality = 0.9,
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('resizeImageToWebp must be called in the browser');
  }
  const bitmap = await createImageBitmap(file);
  const target = computeTargetSize({ width: bitmap.width, height: bitmap.height }, maxWidth);
  const canvas = new OffscreenCanvas(target.width, target.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  return await canvas.convertToBlob({ type: 'image/webp', quality });
}
