import { beforeEach, describe, expect, it } from 'vitest';
import { createPortfolioTemplate } from '../../../projects/domain/portfolio-template';
import {
  BlockPropsValidationError,
  updateBlockProps,
} from '../../domain/document';

describe('updateBlockProps', () => {
  let document: ReturnType<typeof createPortfolioTemplate>;
  let page: ReturnType<typeof createPortfolioTemplate>['pages'][number];
  let hero: ReturnType<typeof createPortfolioTemplate>['pages'][number]['blocks'][number];

  beforeEach(() => {
    document = createPortfolioTemplate('Alex Rivera', 'alex-rivera');
    page = document.pages[0];
    hero = page.blocks[0];
  });

  it('updates valid props without mutating the current document', () => {
    const originalHeadline = hero.props.headline;
    const nextDocument = updateBlockProps(document, page.id, hero.id, {
      headline: 'New headline',
      align: 'left',
      hidden: true,
    });

    const nextHero = nextDocument.pages[0].blocks[0];
    expect(nextHero.props.headline).toBe('New headline');
    expect(nextHero.props.align).toBe('left');
    expect(nextHero.props.hidden).toBe(true);
    expect(hero.props.headline).toBe(originalHeadline);
  });

  it('rejects invalid URLs with a user-facing block validation error', () => {
    let validationError: unknown;

    try {
      updateBlockProps(document, page.id, hero.id, { ctaUrl: 'javascript:alert(1)' });
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeInstanceOf(BlockPropsValidationError);
    const error = validationError as BlockPropsValidationError;
    expect(error.issues[0]?.path).toContain('ctaUrl');
    expect(error.issues[0]?.message).toContain('http://');
  });

  it('rejects unknown properties', () => {
    expect(() => updateBlockProps(document, page.id, hero.id, {
      arbitraryCss: 'color: red',
    })).toThrow(BlockPropsValidationError);
  });

  it('preserves the current document when validation fails', () => {
    const snapshot = JSON.stringify(document);

    expect(() => updateBlockProps(document, page.id, hero.id, {
      headline: 'x'.repeat(121),
    })).toThrow(BlockPropsValidationError);

    expect(JSON.stringify(document)).toBe(snapshot);
    expect(hero.props.headline).not.toBe('x'.repeat(121));
  });

  it('updates image reference, alt text, alignment, visibility and spacing', () => {
    const nextDocument = updateBlockProps(document, page.id, hero.id, {
      imageAssetId: 'asset-portrait-1',
      imageAlt: 'Portrait of Alex Rivera',
      align: 'right',
      hidden: true,
      spacing: 'compact',
    });

    const nextHero = nextDocument.pages[0].blocks[0];
    expect(nextHero.props.imageAssetId).toBe('asset-portrait-1');
    expect(nextHero.props.imageAlt).toBe('Portrait of Alex Rivera');
    expect(nextHero.props.align).toBe('right');
    expect(nextHero.props.hidden).toBe(true);
    expect(nextHero.props.spacing).toBe('compact');
  });

  it('rejects image ids and alt text that exceed their limits', () => {
    expect(() => updateBlockProps(document, page.id, hero.id, {
      imageAssetId: 'x'.repeat(129),
    })).toThrow(BlockPropsValidationError);

    expect(() => updateBlockProps(document, page.id, hero.id, {
      imageAlt: 'x'.repeat(161),
    })).toThrow(BlockPropsValidationError);
  });

  it('rejects values outside the alignment and spacing enums', () => {
    expect(() => updateBlockProps(document, page.id, hero.id, {
      align: 'justify',
    })).toThrow(BlockPropsValidationError);

    expect(() => updateBlockProps(document, page.id, hero.id, {
      spacing: 'huge',
    })).toThrow(BlockPropsValidationError);
  });
});
