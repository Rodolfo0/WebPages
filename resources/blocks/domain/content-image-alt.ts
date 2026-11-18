/** Finds selected content images whose per-use alternative text is missing. */
export function findMissingContentImageAltPaths(value: unknown, path: Array<string | number> = []): Array<Array<string | number>> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findMissingContentImageAltPaths(item, [...path, index]));
  }
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const missingPaths = typeof record.imageAssetId === 'string'
      && record.imageAssetId.trim().length > 0
      && (typeof record.imageAlt !== 'string' || record.imageAlt.trim().length === 0)
    ? [[...path, 'imageAlt']]
    : [];

  return [
    ...missingPaths,
    ...Object.entries(record).flatMap(([key, child]) => findMissingContentImageAltPaths(child, [...path, key])),
  ];
}

export function populateMissingContentImageAlt(value: unknown, filenameByAssetId: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => populateMissingContentImageAlt(item, filenameByAssetId));
  if (!value || typeof value !== 'object') return value;

  const record = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, populateMissingContentImageAlt(child, filenameByAssetId)]),
  );
  const imageAssetId = record.imageAssetId;
  if (typeof imageAssetId === 'string' && imageAssetId.trim() && (typeof record.imageAlt !== 'string' || !record.imageAlt.trim())) {
    const filename = filenameByAssetId.get(imageAssetId);
    record.imageAlt = filename
      ? filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Image'
      : 'Image';
  }
  return record;
}
