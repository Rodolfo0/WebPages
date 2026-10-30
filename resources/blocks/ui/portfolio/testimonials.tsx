import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  blockAlignmentSchema,
  blockSetupSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockSection } from '../block-renderer';
import styles from '../portfolio-blocks.module.css';

/**
 * Testimonials, documented as optional in Issue 10.
 *
 * "Optional" is expressed with the shared `hidden` flag rather than by omitting the block: the
 * portfolio template ships it hidden so the initial page reads well, while a user can turn it on
 * without adding a block. Keeping it registered means the type stays stable across documents.
 */
const testimonialSchema = z.strictObject({
  quote: z.string().trim().max(500, 'La cita no puede superar 500 caracteres.'),
  author: shortTextSchema(80, 'El autor'),
  role: shortTextSchema(80, 'El cargo'),
});

const MAX_TESTIMONIALS = 6;

export const testimonialsPropsSchema = z.strictObject({
  setup: blockSetupSchema.default('default'),
  heading: shortTextSchema(60, 'El título'),
  entries: z
    .array(testimonialSchema)
    .max(MAX_TESTIMONIALS, `Puedes añadir hasta ${MAX_TESTIMONIALS} testimonios.`),
  align: blockAlignmentSchema.default('center'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type TestimonialsProps = z.output<typeof testimonialsPropsSchema>;

export const testimonialsBlock = defineBlock<TestimonialsProps>({
  type: 'testimonials',
  label: 'Testimonios',
  description: 'Opiniones de personas con las que has trabajado. Opcional.',
  propsSchema: testimonialsPropsSchema,
  defaultProps: testimonialsPropsSchema.parse({
    setup: 'default',
    heading: 'Lo que dicen de mi trabajo',
    entries: [
      {
        quote:
          'Tradujo un problema difuso en una interfaz que el equipo entendió en una sola reunión.',
        author: 'Lucía Fernández',
        role: 'Directora de producto, Estudio Horizonte',
      },
      {
        quote: 'La documentación que dejó sigue siendo la referencia del equipo dos años después.',
        author: 'Marcos Peña',
        role: 'Responsable de ingeniería, Nexo Labs',
      },
    ],
    align: 'center',
    spacing: 'comfortable',
  }),
  // Testimonials carry text only; adding portraits would need a separate asset field.
  assetIdsFromProps: () => [],
  reactComponent: ({ props, blockId, theme }) => (
    <BlockSection
      align={props.align}
      spacing={props.spacing}
      theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
      anchor={props.anchor}
      headingId={`${blockId}-heading`}
      heading={props.heading}
      headingLevel={2}
      hidden={props.hidden}
      data-setup={props.setup}
    >
      <ul className={styles.entries}>
        {props.entries.map((entry, index) => (
          <li key={`${entry.author}-${index}`} className={styles.entry}>
            <blockquote className={styles.quote}>
              <p className={styles.entryDescription}>{entry.quote}</p>
            </blockquote>
            <p className={styles.entrySubtitle}>
              {entry.author}
              {entry.role ? <span className={styles.entryPeriod}> · {entry.role}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </BlockSection>
  ),
});
