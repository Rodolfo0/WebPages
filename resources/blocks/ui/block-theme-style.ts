import type { CSSProperties } from 'react';
import type { ThemeTokens } from '../../site-document';

const FONT_FAMILIES: Record<ThemeTokens['typography']['heading'], string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

const BASE_FONT_SIZE_REM: Record<ThemeTokens['spacing'], number> = {
  compact: 1,
  comfortable: 1.0625,
  spacious: 1.125,
};

/**
 * Projects theme tokens into custom properties consumed by the block stylesheet.
 *
 * The block renderer receives its appearance only from the document theme, so the canvas and the
 * public page look the same without any dashboard or Mantine style leaking into the block.
 */
export function blockThemeStyle(theme: ThemeTokens): CSSProperties {
  return {
    '--block-bg': theme.colors.background,
    '--block-text': theme.colors.text,
    '--block-accent': theme.colors.accent,
    '--block-font-heading': FONT_FAMILIES[theme.typography.heading],
    '--block-font-body': FONT_FAMILIES[theme.typography.body],
    '--block-font-size': `${BASE_FONT_SIZE_REM[theme.spacing]}rem`,
  } as CSSProperties;
}
