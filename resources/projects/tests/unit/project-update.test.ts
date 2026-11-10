import { describe, expect, it } from 'vitest';
import { createPortfolioTemplate } from '../../domain/portfolio-template';
import {
  parseUpdateProjectInput,
  ProjectInputError,
} from '../../domain/project';

describe('parseUpdateProjectInput', () => {
  it('accepts a draft-only update', () => {
    const draftDocument = createPortfolioTemplate('Alex Rivera', 'alex-rivera');
    const result = parseUpdateProjectInput({ draftDocument, draftRevision: 3 });

    expect(result.draftDocument).toBe(draftDocument);
    expect(result.draftRevision).toBe(3);
    expect(result.name).toBeUndefined();
    expect(result.slug).toBeUndefined();
  });

  it('accepts existing name and slug updates', () => {
    const result = parseUpdateProjectInput({
      name: 'Alex Rivera',
      slug: 'Alex Rivera',
    });

    expect(result.name).toBe('Alex Rivera');
    expect(result.slug).toBe('alex-rivera');
  });

  it('requires the base revision with every draft update', () => {
    const draftDocument = createPortfolioTemplate('Alex Rivera', 'alex-rivera');

    expect(() => parseUpdateProjectInput({ draftDocument })).toThrow(ProjectInputError);
    expect(() => parseUpdateProjectInput({ name: 'Alex', draftRevision: 1 })).toThrow(ProjectInputError);
    expect(() => parseUpdateProjectInput({ draftDocument, draftRevision: -1 })).toThrow(ProjectInputError);
    expect(() => parseUpdateProjectInput({ draftDocument, draftRevision: 1.5 })).toThrow(ProjectInputError);
  });

  it('rejects an empty update', () => {
    expect(() => parseUpdateProjectInput({})).toThrow(ProjectInputError);
  });

  it('rejects unknown update fields', () => {
    expect(() => parseUpdateProjectInput({
      draftDocument: createPortfolioTemplate('Alex Rivera', 'alex-rivera'),
      draftRevision: 0,
      arbitrary: true,
    })).toThrow(ProjectInputError);
  });
});
