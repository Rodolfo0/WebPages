import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  blockAlignmentSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  optionalBlockUrlSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockSection } from '../block-renderer';
import styles from '../portfolio-blocks.module.css';

/**
 * Footer with a copyright line and small navigation links.
 *
 * It is a real block rather than page chrome, so a user can keep it, hide it or remove it like any
 * other section. `heading` doubles as the section's accessible name, which lets the footer be a
 * labelled `section` without rendering a visible title.
 */
const footerLinkSchema = z.strictObject({
  label: shortTextSchema(40, 'El enlace'),
  url: optionalBlockUrlSchema,
});

const MAX_FOOTER_LINKS = 6;

export const footerPropsSchema = z.strictObject({
  heading: shortTextSchema(60, 'El título accesible'),
  copyright: shortTextSchema(120, 'El texto de copyright'),
  links: z
    .array(footerLinkSchema)
    .max(MAX_FOOTER_LINKS, `Puedes añadir hasta ${MAX_FOOTER_LINKS} enlaces.`),
  align: blockAlignmentSchema.default('center'),
  spacing: blockSpacingSchema.default('compact'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type FooterProps = z.output<typeof footerPropsSchema>;

export const footerBlock = defineBlock<FooterProps>({
  type: 'footer',
  label: 'Pie de página',
  description: 'Copyright y enlaces finales del sitio.',
  propsSchema: footerPropsSchema,
  defaultProps: footerPropsSchema.parse({
    heading: 'Pie de página',
    copyright: '© 2026 Alex Rivera. Todos los derechos reservados.',
    links: [
      { label: 'Inicio', url: '/' },
      { label: 'Proyectos', url: '#proyectos' },
      { label: 'Contacto', url: '#contacto' },
    ],
    align: 'center',
    spacing: 'compact',
  }),
  // The footer never references an image.
  assetIdsFromProps: () => [],
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
      <nav aria-label={props.heading}>
        <ul className={styles.footerLinks}>
          {props.links
            .filter((link) => link.url)
            .map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a href={link.url}>{link.label}</a>
              </li>
            ))}
        </ul>
      </nav>
      {props.copyright ? <p className={styles.entryPeriod}>{props.copyright}</p> : null}
    </BlockSection>
  ),
});
