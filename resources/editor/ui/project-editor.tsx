'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { portfolioBlockRegistry, requireBlock } from '../../blocks';
import type { SiteDocument } from '../../site-document';
import { addBlockToDocument } from '../domain/document';
import styles from './editor.module.css';

type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
  canEdit: boolean;
};

type ProjectEditorResponse = {
  project?: ProjectSummary;
  draftDocument?: SiteDocument;
  message?: string;
};

type EditorData = {
  project: ProjectSummary;
  draftDocument: SiteDocument;
};

type BlockSelection = {
  pageId: string;
  blockId: string;
};

function isSelected(selection: BlockSelection | null, pageId: string, blockId: string) {
  return selection !== null && selection.pageId === pageId && selection.blockId === blockId;
}

function selectionKey(selection: BlockSelection) {
  return JSON.stringify([selection.pageId, selection.blockId]);
}

function CanvasBlock({
  block,
  blockIndex,
  pageId,
  theme,
  selected,
  onSelect,
  registerFrame,
}: {
  block: SiteDocument['pages'][number]['blocks'][number];
  blockIndex: number;
  pageId: string;
  theme: SiteDocument['site']['theme'];
  selected: boolean;
  onSelect: (selection: BlockSelection) => void;
  registerFrame: (selection: BlockSelection, frame: HTMLDivElement | null) => void;
}) {
  const definition = requireBlock(portfolioBlockRegistry, block.type);
  const BlockRenderer = definition.reactComponent;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect({ pageId, blockId: block.id });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Seleccionar sección ${blockIndex + 1}: ${definition.label}`}
      aria-pressed={selected}
      data-selected={selected}
      className={styles.blockFrame}
      ref={(frame) => registerFrame({ pageId, blockId: block.id }, frame)}
      onClick={() => onSelect({ pageId, blockId: block.id })}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.renderedBlock} aria-hidden="true" inert>
        <BlockRenderer blockId={block.id} theme={theme} props={block.props} />
      </div>
    </div>
  );
}

export default function ProjectEditor({ projectId }: { projectId: string }) {
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [selection, setSelection] = useState<BlockSelection | null>(null);
  const [catalogOpened, setCatalogOpened] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const canvasBlockFrames = useRef(new Map<string, HTMLDivElement>());

  function selectBlock(nextSelection: BlockSelection) {
    setSelection(nextSelection);
  }

  function registerCanvasBlock(selectionToRegister: BlockSelection, frame: HTMLDivElement | null) {
    const key = selectionKey(selectionToRegister);
    if (frame) {
      canvasBlockFrames.current.set(key, frame);
    } else {
      canvasBlockFrames.current.delete(key);
    }
  }

  function addCatalogBlock(blockType: string) {
    if (!editorData?.project.canEdit) return;

    const pageId = selection?.pageId ?? editorData.draftDocument.pages[0]?.id;
    if (!pageId) {
      setCatalogError('No se encontró una página donde agregar la sección.');
      return;
    }

    try {
      const result = addBlockToDocument(editorData.draftDocument, pageId, blockType);
      setEditorData({ ...editorData, draftDocument: result.document });
      setCatalogError('');
      setCatalogOpened(false);
      setCatalogSearch('');
      selectBlock({ pageId, blockId: result.blockId });
    } catch {
      setCatalogError('No se pudo agregar la sección. Inténtalo de nuevo.');
    }
  }

  const normalizedQuery = catalogSearch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const catalogBlocks = [...portfolioBlockRegistry.values()].filter((definition) => {
    const searchableText = `${definition.label} ${definition.description}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return searchableText.includes(normalizedQuery);
  });

  useEffect(() => {
    if (!selection) return;
    canvasBlockFrames.current
      .get(selectionKey(selection))
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [editorData, selection]);

  useEffect(() => {
    const controller = new AbortController();
    setEditorData(null);
    setSelection(null);
    setCatalogSearch('');
    setCatalogError('');
    setLoadError('');
    setLoading(true);

    fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => ({
        response,
        result: await response.json() as ProjectEditorResponse,
      }))
      .then(({ response, result }) => {
        if (!response.ok) {
          throw new Error(result.message ?? 'No se pudo cargar el borrador del proyecto.');
        }
        if (!result.project || !result.draftDocument) {
          throw new Error('La respuesta no incluye el borrador del proyecto.');
        }

        setEditorData({ project: result.project, draftDocument: result.draftDocument });
        const firstPage = result.draftDocument.pages[0];
        const firstBlock = firstPage?.blocks[0];
        if (firstPage && firstBlock) {
          setSelection({ pageId: firstPage.id, blockId: firstBlock.id });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error
          ? error.message
          : 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [projectId]);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Text size="sm" fw={700} c="indigo" tt="uppercase">Editor</Text>
            <Title order={1} mt={4}>{editorData?.project.name ?? 'Proyecto'}</Title>
            <Text c="dimmed" mt={6}>
              Selecciona una sección en la página o en la lista lateral.
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              {editorData?.project.canEdit
                ? 'Los bloques añadidos en esta sesión todavía no se guardan.'
                : 'Tienes acceso de solo lectura: puedes revisar el borrador, pero no modificarlo.'}
            </Text>
          </div>
          <Button component="a" href="/app/projects" variant="default">
            Volver a proyectos
          </Button>
        </header>

        {loading ? (
          <div className="grid min-h-64 place-items-center" aria-label="Cargando borrador">
            <Loader />
          </div>
        ) : loadError ? (
          <Alert color="red" title="No se pudo abrir el proyecto" role="alert">
            {loadError}
          </Alert>
        ) : editorData ? (
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section aria-label="Canvas del sitio" className="min-w-0">
              <Card withBorder radius="lg" padding="md" className={styles.canvasSurface}>
                <Stack gap="md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Title order={2}>Vista de página</Title>
                    <Badge variant="light" color={editorData.project.canEdit ? 'indigo' : 'gray'}>
                      {editorData.project.canEdit ? 'Editable' : 'Solo lectura'}
                    </Badge>
                  </div>
                  <div className={styles.canvasViewport}>
                    {editorData.draftDocument.pages.map((page) => (
                      <article key={page.id} className={styles.pageCanvas} aria-label={`Página ${page.path}`}>
                        {page.blocks.map((block, blockIndex) => (
                          <CanvasBlock
                            key={block.id}
                            block={block}
                            blockIndex={blockIndex}
                            pageId={page.id}
                            theme={editorData.draftDocument.site.theme}
                            selected={isSelected(selection, page.id, block.id)}
                            onSelect={selectBlock}
                            registerFrame={registerCanvasBlock}
                          />
                        ))}
                      </article>
                    ))}
                  </div>
                </Stack>
              </Card>
            </section>

            <aside aria-label="Lista de secciones" className="min-w-0">
              <Card withBorder radius="lg" padding="md">
                <Stack gap="md">
                  <div>
                    <Title order={2}>Secciones</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      {editorData.project.canEdit ? 'Edición local' : 'Solo lectura'}
                    </Text>
                  </div>
                  <Button
                    fullWidth
                    disabled={!editorData.project.canEdit}
                    onClick={() => {
                      setCatalogSearch('');
                      setCatalogError('');
                      setCatalogOpened(true);
                    }}
                  >
                    Agregar sección
                  </Button>
                  <nav aria-label="Secciones del sitio">
                    <Stack gap="lg">
                      {editorData.draftDocument.pages.map((page) => (
                        <section key={page.id} aria-label={`Página ${page.path}`}>
                          <Text size="xs" fw={700} c="dimmed" mb="xs">{page.path}</Text>
                          {page.blocks.length > 0 ? (
                            <Stack gap="xs">
                              {page.blocks.map((block, blockIndex) => {
                                const definition = requireBlock(portfolioBlockRegistry, block.type);
                                const selected = isSelected(selection, page.id, block.id);
                                return (
                                  <Button
                                    key={block.id}
                                    fullWidth
                                    variant={selected ? 'filled' : 'default'}
                                    aria-pressed={selected}
                                    aria-label={`Seleccionar sección ${blockIndex + 1}: ${definition.label}, página ${page.path}`}
                                    onClick={() => selectBlock({ pageId: page.id, blockId: block.id })}
                                  >
                                    {blockIndex + 1}. {definition.label}
                                  </Button>
                                );
                              })}
                            </Stack>
                          ) : (
                            <Text size="sm" c="dimmed">Esta página todavía no tiene secciones.</Text>
                          )}
                        </section>
                      ))}
                    </Stack>
                  </nav>
                </Stack>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
      <Modal
        opened={catalogOpened}
        onClose={() => setCatalogOpened(false)}
        title="Agregar sección"
        centered
        size="lg"
      >
        <TextInput
          label="Buscar bloques"
          placeholder="Por nombre o descripción"
          value={catalogSearch}
          onChange={(event) => setCatalogSearch(event.currentTarget.value)}
        />
        {catalogError && (
          <Alert color="red" role="alert" mt="sm">{catalogError}</Alert>
        )}
        <Stack gap="sm" mt="md" className={styles.catalogResults}>
          {catalogBlocks.map((definition) => (
            <Card key={definition.type} withBorder padding="sm" radius="md">
              <Stack gap="xs">
                <div>
                  <Text size="sm" fw={700}>{definition.label}</Text>
                  <Text size="xs" c="dimmed" mt={2}>{definition.description}</Text>
                </div>
                <Button
                  variant="filled"
                  disabled={!editorData?.project.canEdit}
                  aria-label={`Agregar ${definition.label}`}
                  onClick={() => addCatalogBlock(definition.type)}
                >
                  Agregar sección
                </Button>
              </Stack>
            </Card>
          ))}
          {catalogBlocks.length === 0 && (
            <Text size="sm" c="dimmed">No encontramos bloques con esa búsqueda.</Text>
          )}
        </Stack>
      </Modal>
    </main>
  );
}
