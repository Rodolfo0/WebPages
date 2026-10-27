import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  altTextSchema,
  blockAlignmentSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  optionalAssetIdSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockSection } from '../block-renderer';
import { BlockMedia, BlockProse } from '../block-parts';
import styles from '../portfolio-blocks.module.css';

/**
 * The "about me" block: a short biography and an optional portrait.
 *
 * The body is plain text. A later issue may add paragraphs; Issue 10 only needs a description that
 * can be edited, so the schema keeps a single string instead of a rich-text structure.
 */
export const aboutPropsSchema = z.strictObject({
  heading: shortTextSchema(60, 'El título'),
  body: z.string().trim().max(1200, 'La descripción no puede superar 1200 caracteres.'),
  imageAssetId: optionalAssetIdSchema,
  imageAlt: altTextSchema.default(''),
  align: blockAlignmentSchema.default('left'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type AboutProps = z.output<typeof aboutPropsSchema>;

export const aboutBlock = defineBlock<AboutProps>({
  type: 'about',
  label: 'Sobre mí',
  description: 'Una presentación breve con una fotografía opcional.',
  propsSchema: aboutPropsSchema,
  defaultProps: aboutPropsSchema.parse({
    heading: 'Sobre mí',
    body:
      'Llevo ocho años diseñando y construyendo productos digitales. Me interesa el punto donde la accesibilidad, el rendimiento y el detalle visual se encuentran, y trabajo mejor en equipos que documentan sus decisiones.',
    align: 'left',
    spacing: 'comfortable',
  }),
  assetIdsFromProps: (props) => (props.imageAssetId ? [props.imageAssetId] : []),
  reactComponent: ({ props, blockId, theme }) => (
    <BlockSection
      align={props.align}
      theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
      anchor={props.anchor}
      headingId={`${blockId}-heading`}
      heading={props.heading}
      headingLevel={2}
      hidden={props.hidden}
    >
      <div className={styles.about}>
        <BlockMedia assetId={props.imageAssetId} alt={props.imageAlt} className={styles.portrait} />
        <BlockProse>
          <p>{props.body}</p>
        </BlockProse>
      </div>
    </BlockSection>
  ),
});
