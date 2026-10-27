import { describe, expect, it } from 'vitest';
import {
  createBlockRegistry,
  portfolioBlockRegistry,
  toBlockSchemaRegistry,
} from '../../../blocks';
import {
  collectSiteDocumentAssetIds,
  createSiteDocumentSchema,
} from '../../../site-document';
import { createPortfolioTemplate } from '../../domain/portfolio-template';

/**
 * The template is the first document a new portfolio project receives. Issue 10 requires it to be
 * fully editable, which means every block it emits must be registered and its props must validate,
 * otherwise the editor would open a document it cannot render.
 */

/** Builds the validator the publishing path uses: the whole catalog projected to its schema form. */
function documentSchema() {
  return createSiteDocumentSchema(toBlockSchemaRegistry(portfolioBlockRegistry));
}

describe('portfolio template', () => {
  it('emits the eight portfolio blocks in reading order', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');

    expect(template.pages).toHaveLength(1);
    expect(template.pages[0].blocks?.map((block) => block.type)).toEqual([
      'hero',
      'about',
      'experience',
      'projects',
      'skills',
      'testimonials',
      'contact',
      'footer',
    ]);
  });

  it('validates against the complete registered catalog', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');

    const result = documentSchema().safeParse(template);

    expect(result.success).toBe(true);
  });

  it('emits complete props instead of empty objects', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');

    for (const block of template.pages[0].blocks ?? []) {
      expect(Object.keys(block.props ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('starts the page with the only level-one heading', () => {
    const parsed = documentSchema().parse(createPortfolioTemplate('Estudio Rivera', 'estudio-rivera'));

    expect(parsed.pages[0].blocks[0].type).toBe('hero');
  });

  it('ships the optional testimonials block hidden', () => {
    const parsed = documentSchema().parse(createPortfolioTemplate('Estudio Rivera', 'estudio-rivera'));
    const testimonials = parsed.pages[0].blocks.find((block) => block.type === 'testimonials');

    expect(testimonials?.props.hidden).toBe(true);
  });

  it('gives every block a unique id', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');
    const ids = (template.pages[0].blocks ?? []).map((block) => block.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders every in-page link target, so the template is actually navigable', () => {
    const parsed = documentSchema().parse(createPortfolioTemplate('Estudio Rivera', 'estudio-rivera'));
    const blocksByType = new Map(parsed.pages[0].blocks.map((block) => [block.type, block]));

    // Collect the anchors the template defines on its sections.
    const renderedIds = new Set(
      parsed.pages[0].blocks
        .map((block) => String(block.props.anchor ?? ''))
        .filter(Boolean),
    );

    // Collect the in-page fragments the template links to.
    const linkedFragments = new Set<string>();
    const heroCta = String(blocksByType.get('hero')?.props.ctaUrl ?? '');
    if (heroCta.startsWith('#')) linkedFragments.add(heroCta.slice(1));

    const footerLinks = (blocksByType.get('footer')?.props.links ?? []) as { url: string }[];
    for (const link of footerLinks) {
      if (link.url.startsWith('#')) linkedFragments.add(link.url.slice(1));
    }

    // A `#fragment` only navigates when some section renders that id.
    expect(linkedFragments.size).toBeGreaterThan(0);
    for (const fragment of linkedFragments) {
      expect(renderedIds).toContain(fragment);
    }
  });

  it('carries no asset references until the owner uploads images', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');

    // A fresh portfolio has no images, so nothing should be publicly served at publish time.
    expect(collectSiteDocumentAssetIds(toBlockSchemaRegistry(portfolioBlockRegistry), template))
      .toEqual([]);
  });

  it('uses the project name and slug for the site', () => {
    const template = createPortfolioTemplate('Ana Torres', 'ana-torres');

    expect(template.site.title).toBe('Ana Torres');
    expect(template.site.slug).toBe('ana-torres');
  });
});

describe('template catalog stays in sync with the registry', () => {
  it('registers every portfolio block type the template emits', () => {
    const template = createPortfolioTemplate('Estudio Rivera', 'estudio-rivera');

    for (const block of template.pages[0].blocks ?? []) {
      expect(portfolioBlockRegistry.has(block.type)).toBe(true);
    }
  });

  it('registers only block types the catalog declares, so the registry has no strays', () => {
    const catalogTypes = [...portfolioBlockRegistry.keys()].sort();
    const templateTypes = [...new Set(
      (createPortfolioTemplate('Estudio Rivera', 'estudio-rivera').pages[0].blocks ?? [])
        .map((block) => block.type),
    )].sort();

    expect(catalogTypes).toEqual(templateTypes);
  });

  it('builds a registry that rejects a duplicated type', () => {
    const custom = createBlockRegistry([...portfolioBlockRegistry.values()]);

    expect(custom.size).toBe(portfolioBlockRegistry.size);
  });
});
