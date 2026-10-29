import { z } from 'zod';

/**
 * Props shared by the portfolio blocks.
 *
 * Issue 10 limits what a block may expose to: text and headings, links, an image plus alt text,
 * small lists, alignment, optional visibility, limited spacing and an accent colour taken from the
 * theme tokens. Every schema below keeps to that vocabulary, so the properties panel of a later
 * issue can be generated from these fields without discovering new prop shapes.
 *
 * No schema accepts free-form CSS, HTML or a script. `strictObject` rejects unknown keys at every
 * level, and `createSiteDocumentSchema` additionally refuses block types that are not registered.
 */

/** Closed options, so a spacing choice can never turn into a numeric override. */
export const BLOCK_SPACINGS = ['compact', 'comfortable', 'spacious'] as const;

/** Horizontal alignment of the block content, applied as logical text alignment. */
export const BLOCK_ALIGNMENTS = ['left', 'center', 'right'] as const;

/** How a link or a link list is presented. */
export const BLOCK_LINK_STYLES = ['text', 'buttons'] as const;

/** Visual setups/themes available for customizable blocks. */
export const BLOCK_SETUPS = ['default', 'modern', 'artsy'] as const;

/**
 * Protocols an external link may use.
 *
 * `docs/04-autenticacion-y-seguridad.md` requires allowing only safe protocols. A relative path is
 * accepted for in-site navigation; `javascript:`, `data:` and similar schemes are rejected here, so
 * the renderer never has to sanitize a URL a second time.
 */
const SAFE_URL_PATTERN = /^(?:https?:\/\/|\/|#)/i;

export const blockAlignmentSchema = z.enum(BLOCK_ALIGNMENTS);
export const blockSpacingSchema = z.enum(BLOCK_SPACINGS);
export const blockLinkStyleSchema = z.enum(BLOCK_LINK_STYLES);
export const blockSetupSchema = z.enum(BLOCK_SETUPS);

/**
 * A required, safe URL.
 *
 * The message is user-facing because the properties panel shows it verbatim.
 */
export const blockUrlSchema = z
  .string()
  .trim()
  .min(1, 'Escribe un enlace.')
  .max(2048, 'El enlace es demasiado largo.')
  .refine(
    (value) => SAFE_URL_PATTERN.test(value),
    'El enlace debe comenzar con http://, https://, / o #.',
  );

/** An optional URL; an empty string means "no link", which keeps the document JSON flat. */
export const optionalBlockUrlSchema = z.union([z.literal(''), blockUrlSchema]).default('');

/** A required asset reference. The id is resolved privately; it is never a URL invented by a user. */
export const assetIdSchema = z
  .string()
  .trim()
  .min(1, 'Selecciona una imagen.')
  .max(128, 'El identificador de la imagen no es válido.');

/** An optional asset reference, used by blocks whose image may be left empty. */
export const optionalAssetIdSchema = z
  .string()
  .trim()
  .max(128, 'El identificador de la imagen no es válido.')
  .default('');

/** Alt text for content images. `docs/06-media-y-formularios.md` requires it for content images. */
export const altTextSchema = z.string().trim().max(160, 'El texto alternativo es demasiado largo.');

/** A short label: navigation items, skill names, button captions. */
export const shortTextSchema = (max: number, label: string) =>
  z.string().trim().max(max, `${label} no puede superar ${max} caracteres.`);

/** A single accent colour overriding the theme token for one block. */
export const optionalAccentColorSchema = z
  .union([z.literal(''), z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{6})$/i, 'Usa un color hexadecimal.')])
  .default('');

/** `hidden` complements a section-level visibility toggle without removing the block. */
export const hiddenSchema = z.boolean().default(false);

/**
 * Optional in-page anchor, so a sibling block can link to this section with `#anchor`.
 *
 * A block id is a random UUID, so a link written in a document cannot target it. An anchor is a
 * short readable slug instead, restricted to the characters a URL fragment allows. An empty value
 * means "not linkable", which keeps the document JSON flat.
 */
export const anchorSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(40, 'El ancla no puede superar 40 caracteres.')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El ancla usa minúsculas, números y guiones.'),
  ])
  .default('');

export type BlockAlignment = z.output<typeof blockAlignmentSchema>;
export type BlockSpacing = z.output<typeof blockSpacingSchema>;
export type BlockLinkStyle = z.output<typeof blockLinkStyleSchema>;
export type BlockSetup = z.output<typeof blockSetupSchema>;
