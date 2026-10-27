import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  collectSiteDocumentAssetIds,
  createSiteDocumentSchema,
  DEFAULT_THEME_TOKENS,
} from '../../../site-document';
import { defineBlock } from '../../domain/block-definition';
import {
  createBlockRegistry,
  toBlockSchemaRegistry,
} from '../../domain/block-registry';

/**
 * `assetIdsFromProps` decides which assets a published snapshot may expose publicly, so the
 * registry projection must forward it. `toBlockSchemaRegistry` previously dropped it, which made
 * `collectSiteDocumentAssetIds` return an empty list and every published asset private.
 *
 * These cases are written against the projection and the document collector, not the selector
 * itself, because the projection is where the reference list was lost.
 */

const galleryPropsSchema = z.strictObject({
  title: z.string().trim().max(120).default('Portafolio'),
  coverAssetId: z.string().trim().default('asset-cover'),
  items: z
    .array(
      z.strictObject({
        imageAssetId: z.string().trim(),
        alt: z.string().trim().max(160).default(''),
      }),
    )
    .default([
      { imageAssetId: 'asset-one', alt: 'Uno' },
      { imageAssetId: 'asset-two', alt: 'Dos' },
    ]),
});

function sampleRenderer() {
  return null;
}

/** A block that references a cover image plus a list of images, like the portfolio blocks will. */
const galleryBlock = defineBlock({
  type: 'gallery',
  label: 'Galería',
  description: 'Bloque con una portada y una lista de imágenes.',
  propsSchema: galleryPropsSchema,
  defaultProps: galleryPropsSchema.parse({}),
  assetIdsFromProps: (props) => [
    props.coverAssetId,
    ...props.items.map((item) => item.imageAssetId),
  ],
  reactComponent: sampleRenderer,
});

const textPropsSchema = z.strictObject({ body: z.string().trim().default('') });

/** A block with no images at all; it must contribute no public asset references. */
const textBlock = defineBlock({
  type: 'plain-text',
  label: 'Texto',
  description: 'Bloque sin imágenes.',
  propsSchema: textPropsSchema,
  defaultProps: textPropsSchema.parse({}),
  reactComponent: sampleRenderer,
});

function documentWith(blocks: { id: string; type: string; props: Record<string, unknown> }[]) {
  return {
    version: 1,
    site: { title: 'Sitio', slug: 'sitio', theme: DEFAULT_THEME_TOKENS },
    pages: [{ id: 'page-1', path: '/', blocks }],
  };
}

describe('asset references carried by a published snapshot', () => {
  it('forwards assetIdsFromProps through the registry projection', () => {
    const projected = toBlockSchemaRegistry(createBlockRegistry([galleryBlock]));

    expect(projected.gallery.assetIdsFromProps).toBeTypeOf('function');
  });

  it('collects the ids each block selects from its validated props', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([galleryBlock, textBlock]));

    const assetIds = collectSiteDocumentAssetIds(
      registry,
      documentWith([
        { id: 'b1', type: 'gallery', props: {} },
        { id: 'b2', type: 'plain-text', props: {} },
      ]),
    );

    expect(assetIds).toEqual(['asset-cover', 'asset-one', 'asset-two']);
  });

  it('reads the ids from stored props rather than the block defaults', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([galleryBlock]));

    const assetIds = collectSiteDocumentAssetIds(
      registry,
      documentWith([
        {
          id: 'b1',
          type: 'gallery',
          props: {
            coverAssetId: 'asset-real-cover',
            items: [{ imageAssetId: 'asset-real-item', alt: 'Real' }],
          },
        },
      ]),
    );

    expect(assetIds).toEqual(['asset-real-cover', 'asset-real-item']);
  });

  it('deduplicates an asset referenced by more than one block', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([galleryBlock]));

    const assetIds = collectSiteDocumentAssetIds(
      registry,
      documentWith([
        { id: 'b1', type: 'gallery', props: {} },
        { id: 'b2', type: 'gallery', props: { coverAssetId: 'asset-cover' } },
      ]),
    );

    expect(assetIds).toEqual(['asset-cover', 'asset-one', 'asset-two']);
  });

  it('ignores asset ids that only appear in ordinary text', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([textBlock]));

    const assetIds = collectSiteDocumentAssetIds(
      registry,
      documentWith([{ id: 'b1', type: 'plain-text', props: { body: 'asset-secret' } }]),
    );

    expect(assetIds).toEqual([]);
  });

  it('contributes no references for a block that declares no selector', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([textBlock]));

    expect(registry['plain-text'].assetIdsFromProps).toBeUndefined();
  });

  it('rejects invalid block props before any selector runs', () => {
    const registry = toBlockSchemaRegistry(createBlockRegistry([galleryBlock]));

    expect(() =>
      collectSiteDocumentAssetIds(
        registry,
        documentWith([{ id: 'b1', type: 'gallery', props: { unknownProp: 'x' } }]),
      ),
    ).toThrow();
  });

  it('rejects a selector that produces an unusable reference', () => {
    const brokenSchema = z.strictObject({ imageAssetId: z.string().default('') });
    const brokenBlock = defineBlock({
      type: 'broken',
      label: 'Roto',
      description: 'Devuelve una referencia vacía.',
      propsSchema: brokenSchema,
      defaultProps: brokenSchema.parse({}),
      assetIdsFromProps: () => [''],
      reactComponent: sampleRenderer,
    });
    const registry = toBlockSchemaRegistry(createBlockRegistry([brokenBlock]));

    expect(() =>
      collectSiteDocumentAssetIds(registry, documentWith([{ id: 'b1', type: 'broken', props: {} }])),
    ).toThrow(/referencia de asset inválida/);
  });

  it('accepts the same document through the public site document schema', () => {
    const registry = createBlockRegistry([galleryBlock]);
    const schema = createSiteDocumentSchema(toBlockSchemaRegistry(registry));

    const parsed = schema.parse(documentWith([{ id: 'b1', type: 'gallery', props: {} }]));

    expect(parsed.pages[0].blocks[0].props).toMatchObject({ coverAssetId: 'asset-cover' });
    expect(collectSiteDocumentAssetIds(toBlockSchemaRegistry(registry), parsed))
      .toEqual(['asset-cover', 'asset-one', 'asset-two']);
  });
});
