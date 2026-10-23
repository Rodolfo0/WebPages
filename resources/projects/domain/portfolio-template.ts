import {
  DEFAULT_THEME_TOKENS,
  type SiteDocumentInput,
} from '../../site-document';

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

/**
 * Creates the first SiteDocument draft for a portfolio project.
 *
 * The eight block types below are not registered in `resources/blocks` yet; the initial portfolio
 * blocks issue provides them. Until then this document cannot pass `createSiteDocumentSchema`,
 * whose registry rejects unknown types. Nothing validates the draft at creation time today, but the
 * first validation before publishing must run against the complete registry.
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
        blocks: PORTFOLIO_BLOCK_TYPES.map((type) => ({
          id: crypto.randomUUID(),
          type,
          props: {},
        })),
      },
    ],
  };
}

