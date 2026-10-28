import { describe, expect, it } from 'vitest';
import { assetObjectKey, AssetInputError, validateAssetUpload } from '../../domain/asset';

describe('asset upload domain', () => {
  it('rejects unsupported image types', () => {
    const file = new File(['image'], 'photo.gif', { type: 'image/gif' });
    expect(() => validateAssetUpload(file)).toThrow(AssetInputError);
  });

  it('rejects empty and oversized images', () => {
    expect(() => validateAssetUpload(new File([], 'empty.png', { type: 'image/png' }))).toThrow('El archivo está vacío.');
  });

  it('generates a project-scoped key without trusting the filename', () => {
    const key = assetObjectKey('project-1', 'asset-1', 'image/png');
    expect(key).toBe('projects/project-1/asset-1.png');
  });
});
