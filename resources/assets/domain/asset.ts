import { z } from 'zod';

export const MAX_ASSET_SIZE = 10 * 1024 * 1024;
export const MAX_ASSET_MULTIPART_OVERHEAD = 64 * 1024;
export const ALLOWED_ASSET_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_ASSET_WIDTH = 8192;
export const MAX_ASSET_HEIGHT = 8192;
export const MAX_ASSET_PIXELS = 40_000_000;
export const MAX_ASSETS_PER_PROJECT = 50;
export const MAX_ASSET_BYTES_PER_PROJECT = 100 * 1024 * 1024;
export const MAX_ASSETS_PER_USER = 250;
export const MAX_ASSET_BYTES_PER_USER = 500 * 1024 * 1024;

export type AssetRecord = {
  id: string;
  projectId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  altText: string | null;
  createdAt: string;
};

export class AssetInputError extends Error {
  readonly code = 'asset_invalid';
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AssetInputError';
    this.status = status;
  }
}

export class AssetUploadError extends Error {
  readonly code = 'asset_upload_failed';
  readonly status = 503;

  constructor(message = 'No se pudo subir la imagen. Inténtalo de nuevo.') {
    super(message);
    this.name = 'AssetUploadError';
  }
}

export class AssetInUseError extends Error {
  readonly code = 'asset_in_use';
  readonly status = 409;

  constructor(message = 'La imagen está en uso y no se puede eliminar todavía.') {
    super(message);
    this.name = 'AssetInUseError';
  }
}

export class AssetQuotaError extends Error {
  readonly code = 'asset_quota_exceeded';
  readonly status = 413;

  constructor(message = 'Se alcanzó la cuota de almacenamiento de imágenes.') {
    super(message);
    this.name = 'AssetQuotaError';
  }
}

export function validateAssetUpload(file: File) {
  if (!ALLOWED_ASSET_TYPES.includes(file.type as typeof ALLOWED_ASSET_TYPES[number])) {
    throw new AssetInputError('Solo se permiten imágenes JPEG, PNG o WebP.');
  }
  if (file.size <= 0) throw new AssetInputError('El archivo está vacío.');
  if (file.size > MAX_ASSET_SIZE) {
    throw new AssetInputError('La imagen no puede superar 10 MiB.', 413);
  }

  const filename = file.name.normalize('NFKC').trim().slice(0, 255);
  const result = z.string().min(1).safeParse(filename);
  if (!result.success) throw new AssetInputError('El nombre del archivo no es válido.');
}

function ascii(bytes: Uint8Array, offset: number, value: string) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function readPngDimensions(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) return null;
  if (bytes[8] !== 0 || bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 13 || !ascii(bytes, 12, 'IHDR')) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (bytes.length < 20 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 30 && ascii(bytes, 12, 'VP8X') && view.getUint32(16, true) >= 10) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (bytes.length >= 30 && ascii(bytes, 12, 'VP8 ') && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: ((bytes[27] & 0x3f) << 8) | bytes[26],
      height: ((bytes[29] & 0x3f) << 8) | bytes[28],
    };
  }
  if (bytes.length >= 25 && ascii(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] >> 6) & 0x03) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  return null;
}

export function validateAssetImageDimensions(contentType: string, bytes: Uint8Array) {
  const dimensions = contentType === 'image/jpeg'
    ? readJpegDimensions(bytes)
    : contentType === 'image/png'
      ? readPngDimensions(bytes)
      : contentType === 'image/webp'
        ? readWebpDimensions(bytes)
        : null;
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new AssetInputError('El archivo no contiene una imagen válida del formato declarado.');
  }
  if (dimensions.width > MAX_ASSET_WIDTH || dimensions.height > MAX_ASSET_HEIGHT || dimensions.width * dimensions.height > MAX_ASSET_PIXELS) {
    throw new AssetInputError('La imagen supera las dimensiones máximas permitidas (8192 × 8192 y 40 megapíxeles).');
  }
  return dimensions;
}

export function validateAssetFilename(value: unknown) {
  if (typeof value !== 'string') throw new AssetInputError('Escribe un nombre para la imagen.');
  const filename = value.normalize('NFKC').trim();
  if (!filename) throw new AssetInputError('El nombre de la imagen no puede estar vacío.');
  if (filename.length > 255) throw new AssetInputError('El nombre de la imagen no puede superar 255 caracteres.');
  if (/[\u0000-\u001f\u007f]/.test(filename)) throw new AssetInputError('El nombre de la imagen contiene caracteres no válidos.');
  return filename;
}

export function assetExtension(contentType: string) {
  return contentType === 'image/jpeg' ? 'jpg'
    : contentType === 'image/png' ? 'png'
      : 'webp';
}

export function assetObjectKey(projectId: string, assetId: string, contentType: string) {
  return `projects/${projectId}/${assetId}.${assetExtension(contentType)}`;
}
