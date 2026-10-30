import { describe, expect, it } from 'vitest';
import { createPortfolioTemplate } from '../../domain/portfolio-template';
import {
  parseUpdateProjectInput,
  ProjectInputError,
} from '../../domain/project';

describe('parseUpdateProjectInput', () => {
  it('accepts a draft-only update', () => {
    const draftDocument = createPortfolioTemplate('Alex Rivera', 'alex-rivera');
    const result = parseUpdateProjectInput({ draftDocument });

    expect(result.draftDocument).toBe(draftDocument);
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

  it('rejects an empty update', () => {
    expect(() => parseUpdateProjectInput({})).toThrow(ProjectInputError);
  });

  it('rejects unknown update fields', () => {
    expect(() => parseUpdateProjectInput({
      draftDocument: createPortfolioTemplate('Alex Rivera', 'alex-rivera'),
      arbitrary: true,
    })).toThrow(ProjectInputError);
  });
});
