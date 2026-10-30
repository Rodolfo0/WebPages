import { beforeEach, describe, expect, it } from 'vitest';
import { createPortfolioTemplate } from '../../../projects/domain/portfolio-template';
import {
  deleteBlockFromDocument,
  duplicateBlockInDocument,
  moveBlockInDocument,
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

  it('updates visual setups between default, modern and artsy', () => {
    const modernDoc = updateBlockProps(document, page.id, hero.id, {
      setup: 'modern',
      align: 'left',
      spacing: 'compact',
    });
    expect(modernDoc.pages[0].blocks[0].props.setup).toBe('modern');
    expect(modernDoc.pages[0].blocks[0].props.align).toBe('left');
    expect(modernDoc.pages[0].blocks[0].props.spacing).toBe('compact');

    const artsyDoc = updateBlockProps(modernDoc, page.id, hero.id, {
      setup: 'artsy',
    });
    expect(artsyDoc.pages[0].blocks[0].props.setup).toBe('artsy');
    expect(artsyDoc.pages[0].blocks[0].props.align).toBe('left');
    expect(artsyDoc.pages[0].blocks[0].props.spacing).toBe('compact');
  });

  it('rejects values outside the setup enum', () => {
    expect(() => updateBlockProps(document, page.id, hero.id, {
      setup: 'futuristic',
    })).toThrow(BlockPropsValidationError);
  });
});

describe('block composition actions', () => {
  let document: ReturnType<typeof createPortfolioTemplate>;
  let page: ReturnType<typeof createPortfolioTemplate>['pages'][number];

  beforeEach(() => {
    document = createPortfolioTemplate('Alex Rivera', 'alex-rivera');
    page = document.pages[0];
  });

  it('moves blocks up and down without changing ids or mutating the source document', () => {
    const secondBlock = page.blocks[1];
    const movedUp = moveBlockInDocument(document, page.id, secondBlock.id, 0);
    expect(movedUp.pages[0].blocks[0].id).toBe(secondBlock.id);
    expect(page.blocks[0].id).not.toBe(secondBlock.id);
    const movedDown = moveBlockInDocument(movedUp, page.id, secondBlock.id, 1);
    expect(movedDown.pages[0].blocks[1].id).toBe(secondBlock.id);
  });

  it('duplicates a block with a fresh id and identical props', () => {
    const source = page.blocks[0];
    const result = duplicateBlockInDocument(document, page.id, source.id);
    expect(result.document.pages[0].blocks[1].id).toBe(result.blockId);
    expect(result.blockId).not.toBe(source.id);
    expect(result.document.pages[0].blocks[1].props).toEqual(source.props);
    expect(page.blocks).toHaveLength(result.document.pages[0].blocks.length - 1);
  });

  it('deletes a block and retains the other blocks', () => {
    const removedId = page.blocks[0].id;
    const result = deleteBlockFromDocument(document, page.id, removedId);
    expect(result.pages[0].blocks.some((block) => block.id === removedId)).toBe(false);
    expect(result.pages[0].blocks).toHaveLength(page.blocks.length - 1);
    expect(page.blocks).toHaveLength(result.pages[0].blocks.length + 1);
  });
});
