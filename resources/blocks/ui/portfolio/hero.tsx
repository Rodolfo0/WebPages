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
  optionalBlockUrlSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockSection } from '../block-renderer';
import { BlockActions, BlockMedia } from '../block-parts';
import styles from '../portfolio-blocks.module.css';

/**
 * The presentation block: headline, short introduction, optional photo and a single call to action.
 *
 * It is the only portfolio block that renders the document's top-level heading. Every other block
 * starts at `h2`, so the public page keeps one `h1` and a predictable outline.
 */
export const heroPropsSchema = z.strictObject({
  headline: shortTextSchema(120, 'El titular'),
  introduction: z
    .string()
    .trim()
    .max(400, 'La presentación no puede superar 400 caracteres.'),
  eyebrow: shortTextSchema(60, 'El texto superior'),
  imageAssetId: optionalAssetIdSchema,
  imageAlt: altTextSchema.default(''),
  ctaLabel: shortTextSchema(40, 'El botón'),
  ctaUrl: optionalBlockUrlSchema,
  align: blockAlignmentSchema.default('center'),
  spacing: blockSpacingSchema.default('spacious'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type HeroProps = z.output<typeof heroPropsSchema>;

export const heroBlock = defineBlock({
  type: 'hero',
  label: 'Presentación',
  description: 'Titular, introducción y una llamada a la acción al inicio de la página.',
  propsSchema: heroPropsSchema,
  defaultProps: heroPropsSchema.parse({
    eyebrow: 'Portafolio',
    headline: 'Hola, soy Alex Rivera',
    introduction:
      'Diseñador de producto enfocado en interfaces claras y accesibles. Convierto problemas complejos en experiencias sencillas.',
    ctaLabel: 'Escríbeme',
    ctaUrl: '#contacto',
    align: 'center',
    spacing: 'spacious',
  }),
  assetIdsFromProps: (props) => (props.imageAssetId ? [props.imageAssetId] : []),
  reactComponent: ({ props, blockId, theme }) => (
    <BlockSection
      align={props.align}
      theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
      anchor={props.anchor}
      headingId={`${blockId}-heading`}
      heading={props.headline}
      headingLevel={1}
      hidden={props.hidden}
    >
      <div className={styles.hero} data-spacing={props.spacing}>
        {props.eyebrow ? <p className={styles.eyebrow}>{props.eyebrow}</p> : null}
        {props.introduction ? <p className={styles.lead}>{props.introduction}</p> : null}
        <BlockMedia
          assetId={props.imageAssetId}
          alt={props.imageAlt}
          className={styles.heroImage}
        />
        <BlockActions
          items={props.ctaUrl ? [{ label: props.ctaLabel, url: props.ctaUrl, style: 'button' }] : []}
        />
      </div>
    </BlockSection>
  ),
});

