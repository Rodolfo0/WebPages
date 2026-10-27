import { portfolioBlockRegistry, requireBlock } from '../../blocks';
import {
  DEFAULT_THEME_TOKENS,
  type JsonValue,
  type SiteDocumentInput,
} from '../../site-document';

/**
 * The eight blocks of the initial portfolio, in reading order.
 *
 * The template reads this list instead of hard-coding the types inline, so the document order has a
 * single source of truth and can be reused by the editor catalog.
 */
const PORTFOLIO_BLOCK_TYPES = [
  'hero',
  'about',
  'experience',
  'projects',
  'skills',
  'testimonials',
  'contact',
  'footer',
] as const;

type PortfolioBlockType = (typeof PORTFOLIO_BLOCK_TYPES)[number];

/**
 * Copy the template personalises on top of each block's `defaultProps`.
 *
 * Keeping only the overrides here means a new required prop added to a block schema is filled from
 * its defaults automatically; this map never has to be updated to stay valid.
 */
const PORTFOLIO_PROPS: Record<PortfolioBlockType, Record<string, JsonValue>> = {
  hero: {},
  about: {},
  experience: {},
  // Anchors make the default portfolio navigable: the hero CTA and the footer links target these
  // sections, so a new project links between sections without the owner editing any URL.
  projects: { anchor: 'proyectos' },
  skills: {},
  // Testimonials ship hidden: the block exists so the owner can enable it later, but a new
  // portfolio should not open with social proof the owner has not collected yet.
  testimonials: { hidden: true },
  contact: { anchor: 'contacto' },
  footer: {},
};

/**
 * Creates the first SiteDocument draft for a portfolio project.
 *
 * Every type is resolved through `portfolioBlockRegistry`, which throws `UnknownBlockTypeError` for
 * a type that is not registered. That guarantees the emitted document can pass
 * `createSiteDocumentSchema`, instead of referencing types the registry never defined.
 *
 * Props are merged over each block's `defaultProps` here, so the draft is complete rather than an
 * empty object waiting to be filled during validation. A complete draft can be rendered by the
 * editor without a validation round-trip, and it diffs predictably if the catalog changes.
 */
export function createPortfolioTemplate(name: string, slug: string): SiteDocumentInput {
  return {
    version: 1,
    site: {
      title: name,
      slug,
      description: 'Un vistazo a mi trabajo, experiencia y formas de contacto.',
      theme: DEFAULT_THEME_TOKENS,
    },
    pages: [
      {
        id: crypto.randomUUID(),
        path: '/',
        blocks: PORTFOLIO_BLOCK_TYPES.map((type) => {
          const definition = requireBlock(portfolioBlockRegistry, type);

          return {
            id: crypto.randomUUID(),
            type,
            props: { ...definition.defaultProps, ...PORTFOLIO_PROPS[type] },
          };
        }),
      },
    ],
  };
}

