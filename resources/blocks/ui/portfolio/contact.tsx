import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  blockAlignmentSchema,
  blockLinkStyleSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  optionalBlockUrlSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockActions, type BlockActionItem } from '../block-parts';
import { BlockSection } from '../block-renderer';
import styles from '../portfolio-blocks.module.css';

/**
 * Contact details and social links.
 *
 * Issue 10 groups "contacto y redes sociales" into one block, so the public contact form is not
 * part of it: the form arrives with its own issue and must post to a server route, not to a block.
 * Here the block only describes how to reach the author.
 *
 * The email is a plain `mailto:` link and the phone a `tel:` link; both are validated by scheme so a
 * document cannot smuggle an executable URL into an anchor.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{6,32}$/;

const socialLinkSchema = z.strictObject({
  label: shortTextSchema(40, 'La red social'),
  url: optionalBlockUrlSchema,
});

const MAX_SOCIAL_LINKS = 8;

export const contactPropsSchema = z.strictObject({
  heading: shortTextSchema(60, 'El título'),
  message: z.string().trim().max(400, 'El mensaje no puede superar 400 caracteres.'),
  email: z.union([z.literal(''), z.string().trim().regex(EMAIL_PATTERN, 'Escribe un email válido.')]).default(''),
  phone: z.union([z.literal(''), z.string().trim().regex(PHONE_PATTERN, 'Escribe un teléfono válido.')]).default(''),
  location: shortTextSchema(80, 'La ubicación'),
  ctaLabel: shortTextSchema(40, 'El botón'),
  socials: z
    .array(socialLinkSchema)
    .max(MAX_SOCIAL_LINKS, `Puedes añadir hasta ${MAX_SOCIAL_LINKS} enlaces.`),
  linkStyle: blockLinkStyleSchema.default('buttons'),
  align: blockAlignmentSchema.default('center'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type ContactProps = z.output<typeof contactPropsSchema>;

export const contactBlock = defineBlock<ContactProps>({
  type: 'contact',
  label: 'Contacto',
  description: 'Cómo escribirte, redes sociales y ubicación.',
  propsSchema: contactPropsSchema,
  defaultProps: contactPropsSchema.parse({
    heading: 'Contacto',
    message: '¿Tienes un proyecto en mente? Escríbeme y te respondo en un par de días.',
    email: 'hola@example.com',
    phone: '',
    location: 'Madrid, España',
    ctaLabel: 'Enviar email',
    socials: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' },
      { label: 'GitHub', url: 'https://github.com/example' },
      { label: 'Dribbble', url: 'https://dribbble.com/example' },
    ],
    linkStyle: 'buttons',
    align: 'center',
    spacing: 'comfortable',
  }),
  // Contact details reference no assets.
  assetIdsFromProps: () => [],
  reactComponent: ({ props, blockId, theme }) => {
    const style = props.linkStyle === 'buttons' ? 'button' : 'text';

    const items: BlockActionItem[] = [
      ...(props.email
        ? [{ label: props.ctaLabel || 'Enviar email', url: `mailto:${props.email}`, style } as const]
        : []),
      ...props.socials
        .filter((social) => social.url)
        .map((social) => ({ label: social.label, url: social.url, style, external: true } as const)),
    ];

    return (
      <BlockSection
        align={props.align}
        theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
        anchor={props.anchor}
        headingId={`${blockId}-heading`}
        heading={props.heading}
        headingLevel={2}
        hidden={props.hidden}
      >
        {props.message ? <p className={styles.lead}>{props.message}</p> : null}
        <ul className={styles.contactList}>
          {props.email ? (
            <li>
              <span className={styles.contactLabel}>Email: </span>
              <a href={`mailto:${props.email}`}>{props.email}</a>
            </li>
          ) : null}
          {props.phone ? (
            <li>
              <span className={styles.contactLabel}>Teléfono: </span>
              <a href={`tel:${props.phone.replace(/[^\d+]/g, '')}`}>{props.phone}</a>
            </li>
          ) : null}
          {props.location ? (
            <li>
              <span className={styles.contactLabel}>Ubicación: </span>
              {props.location}
            </li>
          ) : null}
        </ul>
        <BlockActions items={items} />
      </BlockSection>
    );
  },
});
