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

/** Creates the first SiteDocument draft for a portfolio project. */
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

