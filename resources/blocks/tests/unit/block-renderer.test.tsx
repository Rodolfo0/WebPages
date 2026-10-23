// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME_TOKENS } from '../../../site-document';
import { BlockSection } from '../../ui/block-renderer';

const theme = DEFAULT_THEME_TOKENS;

afterEach(cleanup);

function renderSection(overrides: Partial<React.ComponentProps<typeof BlockSection>> = {}) {
  return render(
    <BlockSection
      align="left"
      theme={theme}
      headingId="block-1-heading"
      heading="Sobre mí"
      headingLevel={2}
      hidden={false}
      {...overrides}
    >
      <p>Contenido del bloque.</p>
    </BlockSection>,
  );
}

describe('block section renderer', () => {
  it('renders a semantic section named by its heading', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Sobre mí' });
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveAttribute('aria-labelledby', 'block-1-heading');
    expect(screen.getByRole('heading', { level: 2, name: 'Sobre mí' })).toHaveAttribute(
      'id',
      'block-1-heading',
    );
  });

  it.each([1, 2, 3] as const)('honours heading level %s', (headingLevel) => {
    renderSection({ headingLevel, heading: 'Título' });
    expect(screen.getByRole('heading', { level: headingLevel })).toBeInTheDocument();
  });

  it('takes its appearance from the document theme, not from the dashboard', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Sobre mí' });
    expect(section.style.getPropertyValue('--block-bg')).toBe(theme.colors.background);
    expect(section.style.getPropertyValue('--block-text')).toBe(theme.colors.text);
    expect(section.style.getPropertyValue('--block-accent')).toBe(theme.colors.accent);
    expect(section.style.textAlign).toBe('left');
    expect(section.getAttribute('class')).not.toMatch(/mantine|m_/i);
  });

  it('applies the requested alignment', () => {
    renderSection({ align: 'center' });
    expect(screen.getByRole('region', { name: 'Sobre mí' }).style.textAlign).toBe('center');
  });

  it('removes a hidden block from view', () => {
    renderSection({ hidden: true });

    // `display: none` comes from the block stylesheet, which jsdom does not apply. The assertion
    // therefore checks the contract that drives it: the data attribute and `inert` on the section.
    const section = screen.getByRole('region', { name: 'Sobre mí', hidden: true });
    expect(section).toHaveAttribute('data-block-hidden', 'true');
    expect(section).toHaveAttribute('inert');
  });

  it('does not mark a visible block as hidden', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Sobre mí' });
    expect(section).not.toHaveAttribute('data-block-hidden');
    expect(section).not.toHaveAttribute('inert');
  });

  it('renders its content inside the section', () => {
    renderSection();
    expect(screen.getByText('Contenido del bloque.')).toBeVisible();
  });
});

