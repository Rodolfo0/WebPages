// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('moves a focused section with ArrowUp and ArrowDown in the section list', async () => {
    renderEditor();

    const sections = await screen.findByRole('navigation', { name: 'Secciones del sitio' });
    const sectionButtons = () => within(sections).getAllByRole('button', { name: /Seleccionar sección/ });
    const initialTitles = sectionButtons().map((button) => button.textContent?.replace(/^\d+\.\s*/, ''));
    const secondSection = sectionButtons()[1];

    fireEvent.keyDown(secondSection, { key: 'ArrowUp' });
    await waitFor(() => {
      expect(sectionButtons()[0]).toHaveTextContent(initialTitles[1] ?? '');
      expect(sectionButtons()[1]).toHaveTextContent(initialTitles[0] ?? '');
    });

    fireEvent.keyDown(sectionButtons()[0], { key: 'ArrowDown' });
    await waitFor(() => {
      expect(sectionButtons()[0]).toHaveTextContent(initialTitles[0] ?? '');
      expect(sectionButtons()[1]).toHaveTextContent(initialTitles[1] ?? '');
    });
  });

  it('moves a focused preview block with ArrowUp and ArrowDown without scrolling the page', async () => {
    renderEditor();

    const canvas = await screen.findByRole('region', { name: 'Canvas del sitio' }).catch(() => screen.getByLabelText('Canvas del sitio'));
    const previewBlocks = () => within(canvas).getAllByRole('button');
    const initialTitles = previewBlocks().map((button) => button.getAttribute('aria-label')?.split(': ').slice(1).join(': '));
    const secondBlock = previewBlocks()[1];
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    scrollIntoView.mockClear();

    fireEvent.keyDown(secondBlock, { key: 'ArrowUp' });
    await waitFor(() => {
      expect(previewBlocks()[0]).toHaveAttribute('aria-label', expect.stringContaining(initialTitles[1] ?? ''));
      expect(previewBlocks()[1]).toHaveAttribute('aria-label', expect.stringContaining(initialTitles[0] ?? ''));
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.keyDown(previewBlocks()[0], { key: 'ArrowDown' });
    await waitFor(() => {
      expect(previewBlocks()[0]).toHaveAttribute('aria-label', expect.stringContaining(initialTitles[0] ?? ''));
      expect(previewBlocks()[1]).toHaveAttribute('aria-label', expect.stringContaining(initialTitles[1] ?? ''));
    });
  });

  it('opens the delete confirmation when Delete is pressed on a section row', async () => {
    renderEditor();

    const sections = await screen.findByRole('navigation', { name: 'Secciones del sitio' });
    const sectionButtons = within(sections).getAllByRole('button', { name: /Seleccionar sección/ });
    fireEvent.keyDown(sectionButtons[0], { key: 'Delete' });

    expect(await screen.findByRole('dialog')).toHaveTextContent('¿Seguro que quieres eliminar Presentación?');
    expect(within(sections).getAllByRole('button', { name: /Seleccionar sección/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar sección' }));
    await waitFor(() => {
      expect(within(sections).getAllByRole('button', { name: /Seleccionar sección/ })).toHaveLength(7);
    });
  });

  it('opens the delete confirmation when Delete is pressed on a focused preview block', async () => {
    renderEditor();

    const canvas = await screen.findByRole('region', { name: 'Canvas del sitio' });
    const previewBlock = within(canvas).getAllByRole('button')[1];
    fireEvent.keyDown(previewBlock, { key: 'Del' });

    expect(await screen.findByRole('dialog')).toHaveTextContent('¿Seguro que quieres eliminar Sobre mí?');
  });

  it('opens the delete confirmation when Backspace is pressed on a section row', async () => {
    renderEditor();

    const sections = await screen.findByRole('navigation', { name: 'Secciones del sitio' });
    fireEvent.keyDown(within(sections).getAllByRole('button', { name: /Seleccionar sección/ })[0], { key: 'Backspace' });

    expect(await screen.findByRole('dialog')).toHaveTextContent('¿Seguro que quieres eliminar Presentación?');
  });

  it('duplicates the focused section with Shift+D', async () => {
    renderEditor();

    const sections = await screen.findByRole('navigation', { name: 'Secciones del sitio' });
    const sectionButtons = () => within(sections).getAllByRole('button', { name: /Seleccionar sección/ });
    const originalTitle = sectionButtons()[1].textContent?.replace(/^\d+\.\s*/, '');

    fireEvent.keyDown(sectionButtons()[1], { key: 'D', shiftKey: true });
    await waitFor(() => {
      expect(sectionButtons()).toHaveLength(9);
      expect(sectionButtons()[2]).toHaveTextContent(originalTitle ?? '');
    });
  });

  it('duplicates a focused preview block with Shift+D', async () => {
    renderEditor();

    const canvas = await screen.findByRole('region', { name: 'Canvas del sitio' });
    const previewBlocks = () => within(canvas).getAllByRole('button');
    const originalTitle = previewBlocks()[1].getAttribute('aria-label')?.split(': ').slice(1).join(': ');

    fireEvent.keyDown(previewBlocks()[1], { key: 'D', shiftKey: true });
    await waitFor(() => {
      expect(previewBlocks()).toHaveLength(9);
      expect(previewBlocks()[2]).toHaveAttribute('aria-label', expect.stringContaining(originalTitle ?? ''));
    });
  });

  it('reorders blocks by dragging section rows', async () => {
    renderEditor();

    const sections = await screen.findByRole('navigation', { name: 'Secciones del sitio' });
    const sectionButtons = within(sections).getAllByRole('button', { name: /Seleccionar sección/ });
    const firstRow = sectionButtons[0].parentElement;
    const draggedRow = sectionButtons[2].parentElement;
    const firstTitle = sectionButtons[0].textContent?.replace(/^\d+\.\s*/, '');
    const draggedTitle = sectionButtons[2].textContent?.replace(/^\d+\.\s*/, '');

    expect(firstRow).toHaveAttribute('draggable', 'true');
    fireEvent.dragStart(draggedRow!, { dataTransfer: { effectAllowed: 'none', setData: vi.fn() } });
    fireEvent.dragOver(draggedRow!, { dataTransfer: { dropEffect: 'none' } });
    expect(sections.querySelector('[class*="dropPlaceholder"]')).not.toBeInTheDocument();
    fireEvent.dragOver(firstRow!, { clientY: 1, dataTransfer: { dropEffect: 'none' } });
    expect(sections.querySelector('[class*="dropPlaceholder"]')).toHaveAttribute('data-position', 'after');
    fireEvent.drop(firstRow!, { clientY: 1, dataTransfer: { dropEffect: 'none' } });

    await waitFor(() => {
      expect(within(sections).getAllByRole('button', { name: /Seleccionar sección/ })[0]).toHaveTextContent(firstTitle ?? '');
      expect(within(sections).getAllByRole('button', { name: /Seleccionar sección/ })[1]).toHaveTextContent(draggedTitle ?? '');
    });
  });

  it('reorders preview blocks when dropped onto the visible placeholder', async () => {
    renderEditor();

    const canvas = await screen.findByRole('region', { name: 'Canvas del sitio' });
    const previewBlocks = () => within(canvas).getAllByRole('button');
    const firstTitle = previewBlocks()[0].getAttribute('aria-label')?.split(': ').slice(1).join(': ');
    const draggedTitle = previewBlocks()[2].getAttribute('aria-label')?.split(': ').slice(1).join(': ');

    fireEvent.dragStart(previewBlocks()[2], { dataTransfer: { effectAllowed: 'none', setData: vi.fn() } });
    fireEvent.dragOver(previewBlocks()[0], { dataTransfer: { dropEffect: 'none' } });
    const placeholder = canvas.querySelector('[class*="dropPlaceholder"][data-position="after"]');
    expect(placeholder).toBeInTheDocument();
    fireEvent.drop(placeholder!, { dataTransfer: { dropEffect: 'none' } });

    await waitFor(() => {
      expect(previewBlocks()[0]).toHaveAttribute('aria-label', expect.stringContaining(firstTitle ?? ''));
      expect(previewBlocks()[1]).toHaveAttribute('aria-label', expect.stringContaining(draggedTitle ?? ''));
    });
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

  it('toggles visual setups between default, modern and artsy', async () => {
    renderEditor();

    const setupCombobox = await screen.findByRole('combobox', { name: 'Setup' });
    expect(setupCombobox).toHaveValue('Default');

    fireEvent.click(setupCombobox);
    fireEvent.click(await screen.findByText('Modern'));
    expect(screen.getByRole('combobox', { name: 'Setup' })).toHaveValue('Modern');

    fireEvent.click(screen.getByRole('combobox', { name: 'Setup' }));
    fireEvent.click(await screen.findByText('Artsy'));
    expect(screen.getByRole('combobox', { name: 'Setup' })).toHaveValue('Artsy');
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
