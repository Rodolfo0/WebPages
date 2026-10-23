import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { BlockProps, BlockSchemaDefinition } from '../../site-document';
import type { BlockRenderProps } from '../ui/block-renderer';

/**
 * A block type the product can render, with props validated by its own schema.
 *
 * `propsSchema` and `defaultProps` feed `createSiteDocumentSchema` from `resources/site-document`,
 * so this registry is the single source of truth for validation and initial content.
 *
 * Astro is intentionally absent. The MVP only renders React; after the MVP the exporter adds its
 * renderer here (for example an `astroComponentPath` key) without touching the site document or the
 * editor, because both consume this registry through its public entry point.
 */
export type BlockDefinition<P extends BlockProps = BlockProps> = Omit<
  BlockSchemaDefinition,
  'propsSchema' | 'defaultProps'
> & {
  /** Stable identifier persisted in the document. */
  type: string;
  /** Short name shown in the block catalog. */
  label: string;
  /** One-line explanation shown next to the label. */
  description: string;
  /** Validates the props of one instance; it must reject unknown keys. */
  propsSchema: z.ZodType<P>;
  /** Complete initial props; they must satisfy `propsSchema`. */
  defaultProps: P;
  /**
   * React renderer shared by the editor canvas and the public page.
   *
   * The parameter is deliberately opaque: React component types are contravariant in their props,
   * so a definition for concrete props cannot be assigned to a collection typed with the general
   * `BlockProps`. Renderers are called only after `propsSchema` validated the props.
   */
  reactComponent: BlockRenderer;
};

/** A block renderer with its props erased, as stored in a heterogeneous registry. */
export type BlockRenderer = ComponentType<BlockRenderProps<BlockProps>>;

/** Any block definition, for collections whose members have different props. */
export type AnyBlockDefinition = BlockDefinition<BlockProps>;

export type BlockPropsOf<D extends BlockDefinition> = D extends BlockDefinition<infer P> ? P : never;

/** Returns the definition unchanged; it exists to check the props/renderer pairing at compile time. */
export function defineBlock<P extends BlockProps>(
  definition: BlockDefinition<P> & {
    /** Requires the renderer to accept exactly the props produced by `propsSchema`. */
    reactComponent: ComponentType<BlockRenderProps<P>>;
  },
): BlockDefinition<P> {
  return definition;
}
