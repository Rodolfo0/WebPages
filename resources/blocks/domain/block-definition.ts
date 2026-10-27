import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { BlockProps } from '../../site-document';
import type { BlockRenderProps } from '../ui/block-renderer';

/**
 * A block type the product can render, with props validated by its own schema.
 *
 * `propsSchema`, `defaultProps` and `assetIdsFromProps` feed `createSiteDocumentSchema` from
 * `resources/site-document`, so this registry is the single source of truth for validation,
 * initial content and the asset references published with a snapshot.
 *
 * Astro is intentionally absent. The MVP only renders React; after the MVP the exporter adds its
 * renderer here (for example an `astroComponentPath` key) without touching the site document or the
 * editor, because both consume this registry through its public entry point.
 */
export type BlockDefinition<P extends BlockProps = BlockProps> = {
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
   * Returns the asset ids the block references through its validated props.
   *
   * The server calls it to build `referenced_asset_ids_json` for a published snapshot, so only
   * those ids may be served publicly. It is typed against this definition's own `P`; only the
   * projected schema registry widens it to `BlockProps`, because the document schema sees a
   * heterogeneous collection and can only call it after validating the props of each block.
   */
  assetIdsFromProps?: (props: P) => readonly string[];
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

/**
 * Wraps a typed `P`-selected definition with the props-erased shape a heterogeneous registry holds.
 *
 * `assetIdsFromProps` is contravariant in `P`, so a definition validated against its own props is
 * not directly assignable to `AnyBlockDefinition`. The cast is sound because the only consumer,
 * `collectSiteDocumentAssetIds`, runs `propsSchema` on the instance props before it calls the
 * selector — the same invariant that lets `reactComponent` receive erased props.
 *
 * Every block module goes through this function, so the cast stays in one auditable place instead
 * of being repeated at each registry call site.
 */
export function defineBlock<P extends BlockProps>(
  definition: Omit<BlockDefinition<P>, 'reactComponent'> & {
    /**
     * Requires the renderer to accept exactly the props produced by `propsSchema`.
     *
     * The base type is omitted instead of intersected on purpose: keeping `P` in the contextual
     * type only once lets TypeScript infer it from `propsSchema` and then type an inline
     * `({ props, blockId }) => ...` renderer. With an intersection the arrow sees the intersection
     * of both component signatures and its parameters degrade to `any`.
     */
    reactComponent: ComponentType<BlockRenderProps<P>>;
  },
): AnyBlockDefinition {
  return definition as unknown as AnyBlockDefinition;
}

