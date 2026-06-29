export interface CompressImageResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

export interface CompressImageOptions {
  /** Longest edge cap — high enough for handwritten OCR */
  maxDimension?: number;
  /** Target max upload size */
  maxBytes?: number;
  /** Starting JPEG quality (0–1) */
  quality?: number;
  /** Floor quality when iterating down */
  minQuality?: number;
}

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 2048,
  maxBytes: 1_400_000,
  quality: 0.88,
  minQuality: 0.72,
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar. Coba format JPG atau PNG."));
    };
    img.src = url;
  });
}

function scaledSize(width: number, height: number, maxDimension: number) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const ratio = maxDimension / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengompres gambar."))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Resize + JPEG compress for OCR upload.
 * Keeps resolution readable for handwriting while cutting mobile photo payload.
 */
export async function compressImageForOcr(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const opts = { ...DEFAULTS, ...options };
  const originalBytes = file.size;

  // Already small enough — skip re-encode to avoid quality loss
  if (
    originalBytes <= 450_000 &&
    (file.type === "image/jpeg" || file.type === "image/jpg")
  ) {
    const img = await loadImageFromFile(file);
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  const img = await loadImageFromFile(file);
  const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight, opts.maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung kompresi gambar.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = opts.quality;
  let blob = await canvasToJpegBlob(canvas, quality);

  while (blob.size > opts.maxBytes && quality > opts.minQuality) {
    quality = Math.max(opts.minQuality, quality - 0.06);
    blob = await canvasToJpegBlob(canvas, quality);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "laporan";
  const compressed = new File([blob], `${baseName}-scan.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    file: compressed,
    originalBytes,
    compressedBytes: compressed.size,
    width,
    height,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}