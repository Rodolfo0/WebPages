import type { CSSProperties, ReactNode } from 'react';
import type { JsonValue, ThemeTokens } from '../../site-document';
import { blockThemeStyle } from './block-theme-style';
import styles from './block.module.css';

/** Property names the renderer receives outside the block props; schemas must reject them. */
export const BLOCK_RENDER_PROP_NAMES = ['theme', 'blockId', 'onAction'] as const;

export type HeadingLevel = 1 | 2 | 3;
export type BlockAlignment = 'left' | 'center' | 'right';

export type BlockAction = {
  type: 'contact-submit' | 'link-follow';
  payload?: Record<string, JsonValue>;
};

/** Props the renderer adds on top of the block's validated props. */
export type BlockRenderContext = {
  /** Id of the block instance; blocks derive page-unique ids from it. */
  blockId: string;
  /** Theme tokens of the document that owns the block instance. */
  theme: ThemeTokens;
  /** Optional editor hook; the public renderer ignores it. */
  onAction?: (action: BlockAction) => void;
};

/**
 * Props received by a block renderer: its own validated props plus the render context.
 *
 * The two sides are kept separate instead of intersecting them, so block props never have to admit
 * the renderer's function-typed callbacks through their JSON index signature.
 */
export type BlockRenderProps<P extends Record<string, JsonValue>> = BlockRenderContext & {
  props: P;
};

export type BlockHeadingProps = {
  id: string;
  level: HeadingLevel;
  children: string;
};

export function BlockHeading({ id, level, children }: BlockHeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  return <Tag id={id} className={styles.heading}>{children}</Tag>;
}

export type BlockSectionProps = {
  /** Current section alignment, applied with logical text alignment. */
  align: BlockAlignment;
  theme: ThemeTokens;
  /** Accessible name used by `aria-labelledby`; it points to a visible or hidden heading. */
  headingId: string;
  /** Visible text of the heading. It doubles as the accessible name of the section. */
  heading: string;
  headingLevel: HeadingLevel;
  /** Hides the heading and the content from view while keeping the section in the document. */
  hidden: boolean;
  children: ReactNode;
};

/**
 * Visual frame shared by every block renderer.
 *
 * The section is semantically labelled, applies the document theme through custom properties and
 * never relies on dashboard styles, so the editor canvas and the public page look the same.
 */
export function BlockSection({
  align,
  theme,
  headingId,
  heading,
  headingLevel,
  hidden,
  children,
}: BlockSectionProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={styles.root}
      data-block-align={align}
      data-block-hidden={hidden ? 'true' : undefined}
      // Visibility comes from the block stylesheet, so the block keeps its own appearance rules.
      inert={hidden || undefined}
      style={{ ...blockThemeStyle(theme), textAlign: align } as CSSProperties}
    >
      <div className={styles.inner}>
        <BlockHeading id={headingId} level={headingLevel}>
          {heading}
        </BlockHeading>
        <div className={styles.body}>{children}</div>
      </div>
    </section>
  );
}

export { styles as blockStyles };


