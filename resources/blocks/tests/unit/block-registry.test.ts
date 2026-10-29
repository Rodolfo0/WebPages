import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSiteDocumentSchema, DEFAULT_THEME_TOKENS } from '../../../site-document';
import {
  createBlockRegistry,
  findBlock,
  requireBlock,
  toBlockSchemaRegistry,
  UnknownBlockTypeError,
} from '../../domain/block-registry';
import { defineBlock } from '../../domain/block-definition';
import { blockStyles, BlockSection } from '../../ui/block-renderer';
import { blockThemeStyle } from '../../ui/block-theme-style';
import { PORTFOLIO_BLOCKS } from '../../ui/portfolio';

const samplePropsSchema = z.strictObject({
  title: z.string().trim().max(120).default('Título'),
  visible: z.boolean().default(true),
});

function sampleRenderer() {
  return null;
}

const sampleBlock = defineBlock({
  type: 'sample',
  label: 'Ejemplo',
  description: 'Bloque de prueba del contrato.',
  propsSchema: samplePropsSchema,
  defaultProps: samplePropsSchema.parse({}),
  reactComponent: sampleRenderer,
});

const otherBlock = defineBlock({
  type: 'other',
  label: 'Otro',
  description: 'Segundo bloque de prueba.',
  propsSchema: samplePropsSchema,
  defaultProps: samplePropsSchema.parse({}),
  reactComponent: sampleRenderer,
});

describe('block definition contract', () => {
  it('exposes type, label, description, default props, schema and renderer', () => {
    expect(sampleBlock.type).toBe('sample');
    expect(sampleBlock.label).toBe('Ejemplo');
    expect(sampleBlock.description).toBe('Bloque de prueba del contrato.');
    expect(sampleBlock.propsSchema.safeParse(sampleBlock.defaultProps).success).toBe(true);
    expect(typeof sampleBlock.reactComponent).toBe('function');
  });

  it('rejects default props that do not satisfy their own schema', () => {
    const schema = z.strictObject({ count: z.number().min(1) });
    expect(() => schema.parse({ count: 0 })).toThrow();
  });
});

describe('block registry', () => {
  it('indexes definitions by their persisted type', () => {
    const registry = createBlockRegistry([sampleBlock, otherBlock]);
    expect(registry.size).toBe(2);
    expect(requireBlock(registry, 'sample').label).toBe('Ejemplo');
  });

  it('refuses to register the same type twice', () => {
    expect(() => createBlockRegistry([sampleBlock, sampleBlock]))
      .toThrow(/registrado dos veces/);
  });

  it('returns undefined for an unknown type when asked without throwing', () => {
    const registry = createBlockRegistry([sampleBlock]);
    expect(findBlock(registry, 'missing')).toBeUndefined();
  });
});

describe('unknown block types are rejected safely', () => {
  it('throws a typed error when a registry lookup misses', () => {
    const registry = createBlockRegistry([sampleBlock]);
    expect(() => requireBlock(registry, 'does-not-exist')).toThrow(UnknownBlockTypeError);
    try {
      requireBlock(registry, 'does-not-exist');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownBlockTypeError);
      expect((error as UnknownBlockTypeError).blockType).toBe('does-not-exist');
      expect((error as UnknownBlockTypeError).code).toBe('unknown_block_type');
    }
  });

  it('rejects an unknown block type inside a full document', () => {
    const schema = createSiteDocumentSchema(toBlockSchemaRegistry(createBlockRegistry([sampleBlock])));

    const result = schema.safeParse({
      version: 1,
      site: { title: 'Sitio', slug: 'sitio', theme: DEFAULT_THEME_TOKENS },
      pages: [{ id: 'page-1', path: '/', blocks: [{ id: 'b1', type: 'missing', props: {} }] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('no está registrado');
    }
  });

  it('accepts a registered block and fills omitted props from the defaults', () => {
    const schema = createSiteDocumentSchema(toBlockSchemaRegistry(createBlockRegistry([sampleBlock])));

    const result = schema.parse({
      version: 1,
      site: { title: 'Sitio', slug: 'sitio', theme: DEFAULT_THEME_TOKENS },
      pages: [{ id: 'page-1', path: '/', blocks: [{ id: 'b1', type: 'sample', props: {} }] }],
    });

    expect(result.pages[0].blocks[0].props).toEqual({ title: 'Título', visible: true });
  });
});

describe('registry projection for the site document schema', () => {
  it('forwards propsSchema and defaultProps and omits renderer metadata', () => {
    const projected = toBlockSchemaRegistry(createBlockRegistry([sampleBlock]));
    expect(projected).toHaveProperty('sample.propsSchema');
    expect(projected).toHaveProperty('sample.defaultProps');
    expect(projected.sample).not.toHaveProperty('reactComponent');
    expect(projected.sample).not.toHaveProperty('label');
  });
});

describe('portfolio setup contract', () => {
  it('exposes default setup on every portfolio block and accepts all three setups', () => {
    for (const block of PORTFOLIO_BLOCKS) {
      expect(block.defaultProps).toHaveProperty('setup', 'default');

      for (const setup of ['default', 'modern', 'artsy'] as const) {
        const parsed = block.propsSchema.safeParse({
          ...block.defaultProps,
          setup,
        });
        expect(parsed.success, `${block.type} should accept ${setup}`).toBe(true);
      }
    }
  });

  it('rejects an unknown setup on every portfolio block', () => {
    for (const block of PORTFOLIO_BLOCKS) {
      expect(block.propsSchema.safeParse({
        ...block.defaultProps,
        setup: 'futuristic',
      }).success, block.type).toBe(false);
    }
  });
});

describe('renderer contract', () => {
  it('maps theme tokens to custom properties instead of Mantine styles', () => {
    const style = blockThemeStyle(DEFAULT_THEME_TOKENS) as Record<string, string>;
    expect(style['--block-bg']).toBe(DEFAULT_THEME_TOKENS.colors.background);
    expect(style['--block-text']).toBe(DEFAULT_THEME_TOKENS.colors.text);
    expect(style['--block-accent']).toBe(DEFAULT_THEME_TOKENS.colors.accent);
    expect(style['--block-font-heading']).toContain('sans-serif');
  });

  it('keeps block styling inside a module of the renderer', () => {
    expect(blockStyles.root).toBeTruthy();
    expect(BlockSection).toBeTypeOf('function');
  });
});
