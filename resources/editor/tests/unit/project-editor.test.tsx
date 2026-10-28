// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortfolioTemplate } from '../../../projects/domain/portfolio-template';
import ProjectEditor from '../../ui/project-editor';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderEditor() {
  return render(
    <MantineProvider>
      <ProjectEditor projectId="project-1" />
    </MantineProvider>,
  );
}

describe('ProjectEditor properties panel', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const draftDocument = createPortfolioTemplate('Alex Rivera', 'alex-rivera');

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Element.prototype.scrollIntoView = vi.fn();
    document.fonts = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as FontFaceSet;
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'PATCH') return jsonResponse({ message: 'No se pudo guardar.' }, 503);
      return jsonResponse({
        project: {
          id: 'project-1',
          name: 'Alex Rivera',
          slug: 'alex-rivera',
          status: 'draft',
          updatedAt: '2026-10-27T00:00:00.000Z',
          canEdit: true,
        },
        draftDocument,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('edits text and keeps the temporary value visible after save failure', async () => {
    renderEditor();

    const headline = await screen.findByLabelText('Titular');
    fireEvent.change(headline, { target: { value: 'Temporary headline' } });

    expect(headline).toHaveValue('Temporary headline');
    expect(await screen.findByRole('alert')).toHaveTextContent('El borrador temporal se conservó');
    expect(screen.getByLabelText('Titular')).toHaveValue('Temporary headline');
    expect(screen.getByRole('button', { name: 'Reintentar guardado' })).toBeEnabled();
  });

  it('does not scroll the preview while text is being edited', async () => {
    renderEditor();

    const headline = await screen.findByLabelText('Titular');
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    fireEvent.change(headline, { target: { value: 'Live responsive headline' } });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('clears a save failure when the text returns to the last saved value', async () => {
    renderEditor();

    const headline = await screen.findByLabelText('Titular');
    fireEvent.change(headline, { target: { value: 'Temporary headline' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('El borrador temporal se conservó');

    fireEvent.change(headline, { target: { value: 'Hola, soy Alex Rivera' } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Guardado')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Titular')).toHaveValue('Hola, soy Alex Rivera');
  });

  it('limits the hero headline to 120 characters and rejects longer input by the schema', async () => {
    renderEditor();

    const headline = await screen.findByLabelText('Titular');
    expect(headline).toHaveAttribute('maxlength', '120');

    const validHeadline = 'Hola, soy Alex Rivera' + ' a'.repeat(60);
    fireEvent.change(headline, { target: { value: validHeadline.slice(0, 120) } });
    expect(headline).toHaveValue(validHeadline.slice(0, 120));
    expect(screen.getByText('120/120 caracteres')).toBeInTheDocument();

    const invalidHeadline = validHeadline.slice(0, 120) + 'x';
    fireEvent.change(headline, { target: { value: invalidHeadline } });
    expect(await screen.findByText(/no puede superar 120 caracteres/i)).toBeInTheDocument();

    fireEvent.change(headline, { target: { value: 'Hola, soy Alex Rivera' } });
    expect(screen.queryByText(/no puede superar 120 caracteres/i)).not.toBeInTheDocument();
    expect(screen.getByText('21/120 caracteres')).toBeInTheDocument();
  });

  it('shows a clear field error for an unsafe link without replacing the draft', async () => {
    renderEditor();

    const link = await screen.findByLabelText('Enlace del botón');
    fireEvent.change(link, { target: { value: 'javascript:alert(1)' } });

    expect(link).toHaveValue('javascript:alert(1)');
    expect(await screen.findByText(/debe comenzar con http:\/\/|debe comenzar con https:\/\/|begin with http/i)).toBeInTheDocument();
  });

  it('shows the image identifier as readonly with upload and clear actions', async () => {
    renderEditor();

    const image = (await screen.findAllByLabelText('Imagen'))[0];
    expect(image).toHaveAttribute('readonly');
    expect(screen.getAllByRole('button', { name: /Subir imagen|Cambiar imagen/ })[0]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Quitar imagen' })[0]).toBeInTheDocument();
  });

  it('edits image fields, alignment, visibility and spacing', async () => {
    renderEditor();

    await screen.findAllByLabelText('Imagen');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar imagen' })[0]);
    fireEvent.change(screen.getAllByLabelText('Texto alternativo')[0], { target: { value: 'Portrait of Alex' } });
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Alineación' })[0]);
    fireEvent.click(await screen.findByText('Derecha'));
    fireEvent.click(screen.getByRole('switch', { name: 'Ocultar sección' }));

    expect(screen.getAllByLabelText('Imagen')[0]).toHaveValue('');
    expect(screen.getAllByLabelText('Texto alternativo')[0]).toHaveValue('Portrait of Alex');
    expect(screen.getAllByRole('combobox', { name: 'Alineación' })[0]).toHaveValue('Derecha');
    expect(screen.getAllByRole('combobox', { name: 'Espaciado' })[0]).toHaveValue('Amplio');
    expect(screen.getByRole('switch', { name: 'Ocultar sección' })).toBeChecked();
  });

  it('disables editing when the project is read-only', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'PATCH') return jsonResponse({ message: 'No se pudo guardar.' }, 503);
      return jsonResponse({
        project: {
          id: 'project-1',
          name: 'Alex Rivera',
          slug: 'alex-rivera',
          status: 'draft',
          updatedAt: '2026-10-27T00:00:00.000Z',
          canEdit: false,
        },
        draftDocument,
      });
    });

    renderEditor();
    expect(await screen.findByLabelText('Titular')).toBeDisabled();
  });
});
