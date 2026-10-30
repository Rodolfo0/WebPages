import { z } from 'zod';

export const MAX_ASSET_SIZE = 10 * 1024 * 1024;
export const ALLOWED_ASSET_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

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
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AssetInputError';
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

export function validateAssetUpload(file: File) {
  if (!ALLOWED_ASSET_TYPES.includes(file.type as typeof ALLOWED_ASSET_TYPES[number])) {
    throw new AssetInputError('Solo se permiten imágenes JPEG, PNG o WebP.');
  }
  if (file.size <= 0) throw new AssetInputError('El archivo está vacío.');
  if (file.size > MAX_ASSET_SIZE) {
    throw new AssetInputError('La imagen no puede superar 10 MB.');
  }

  const filename = file.name.normalize('NFKC').trim().slice(0, 255);
  const result = z.string().min(1).safeParse(filename);
  if (!result.success) throw new AssetInputError('El nombre del archivo no es válido.');
}

export function assetExtension(contentType: string) {
  return contentType === 'image/jpeg' ? 'jpg'
    : contentType === 'image/png' ? 'png'
      : 'webp';
}

export function assetObjectKey(projectId: string, assetId: string, contentType: string) {
  return `projects/${projectId}/${assetId}.${assetExtension(contentType)}`;
}
