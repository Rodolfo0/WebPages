'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import type { ReactNode } from 'react';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'var(--font-geist-sans), Arial, Helvetica, sans-serif',
  headings: {
    fontFamily: 'var(--font-geist-sans), Arial, Helvetica, sans-serif',
    fontWeight: '650',
  },
});

export default function ProjectsAppProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

