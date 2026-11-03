'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { portfolioBlockRegistry, requireBlock } from '../../blocks';
import type { BlockProps, JsonValue, SiteDocument } from '../../site-document';
import {
  addBlockToDocument,
  BlockPropsValidationError,
  deleteBlockFromDocument,
  duplicateBlockInDocument,
  moveBlockInDocument,
  updateBlockProps,
} from '../domain/document';
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

type DropTarget = BlockSelection & { position: 'before' | 'after' };

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
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  onRequestDelete,
  onDuplicate,
}: {
  block: SiteDocument['pages'][number]['blocks'][number];
  blockIndex: number;
  pageId: string;
  theme: SiteDocument['site']['theme'];
  selected: boolean;
  onSelect: (selection: BlockSelection) => void;
  registerFrame: (selection: BlockSelection, frame: HTMLDivElement | null) => void;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, selection: BlockSelection) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, selection: BlockSelection) => void;
  onMove: (selection: BlockSelection, targetIndex: number) => void;
  onRequestDelete: (selection: BlockSelection) => void;
  onDuplicate: (selection: BlockSelection) => void;
}) {
  const definition = requireBlock(portfolioBlockRegistry, block.type);
  const BlockRenderer = definition.reactComponent;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      onSelect({ pageId, blockId: block.id });
      onDuplicate({ pageId, blockId: block.id });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Del' || event.key === 'Backspace') {
      event.preventDefault();
      onSelect({ pageId, blockId: block.id });
      onRequestDelete({ pageId, blockId: block.id });
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      onSelect({ pageId, blockId: block.id });
      onMove({ pageId, blockId: block.id }, blockIndex + (event.key === 'ArrowUp' ? -1 : 1));
      return;
    }
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
      draggable={draggable}
      ref={(frame) => registerFrame({ pageId, blockId: block.id }, frame)}
      onClick={() => onSelect({ pageId, blockId: block.id })}
      onKeyDown={handleKeyDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, { pageId, blockId: block.id })}
      onDrop={(event) => onDrop(event, { pageId, blockId: block.id })}
    >
      <div className={styles.renderedBlock} aria-hidden="true" inert>
        <BlockRenderer blockId={block.id} theme={theme} props={block.props} />
      </div>
    </div>
  );
}

export default function ProjectEditor({ projectId }: { projectId: string }) {
  return <ProjectEditorSession key={projectId} projectId={projectId} />;
}

function ProjectEditorSession({ projectId }: { projectId: string }) {
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [selection, setSelection] = useState<BlockSelection | null>(null);
  const [catalogOpened, setCatalogOpened] = useState(false);
  const [blockPendingDelete, setBlockPendingDelete] = useState<{ pageId: string; blockId: string; label: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<BlockProps | null>(null);
  const [propertyErrors, setPropertyErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [draggedBlock, setDraggedBlock] = useState<BlockSelection | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const lastSavedDraft = useRef('');
  const saveRevision = useRef(0);
  const canvasBlockFrames = useRef(new Map<string, HTMLDivElement>());
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const skipSelectionScroll = useRef(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const sectionsPanelRef = useRef<HTMLDivElement | null>(null);

  function selectBlock(nextSelection: BlockSelection) {
    const panelScrollTop = sectionsPanelRef.current?.scrollTop ?? 0;
    setSelection(nextSelection);
    const page = editorData?.draftDocument.pages.find((candidate) => candidate.id === nextSelection.pageId);
    const block = page?.blocks.find((candidate) => candidate.id === nextSelection.blockId);
    const def = block ? portfolioBlockRegistry.get(block.type) : undefined;
    const initialProps = block
      ? (def?.defaultProps ? { ...def.defaultProps, ...block.props } : structuredClone(block.props))
      : null;
    setPropertyDraft(initialProps);
    setPropertyErrors({});
    requestAnimationFrame(() => {
      if (sectionsPanelRef.current) sectionsPanelRef.current.scrollTop = panelScrollTop;
    });
  }

  function registerCanvasBlock(selectionToRegister: BlockSelection, frame: HTMLDivElement | null) {
    const key = selectionKey(selectionToRegister);
    if (frame) {
      canvasBlockFrames.current.set(key, frame);
    } else {
      canvasBlockFrames.current.delete(key);
    }
  }

  const selectedPage = selection
    ? editorData?.draftDocument.pages.find((page) => page.id === selection.pageId)
    : undefined;
  const selectedBlock = selection
    ? selectedPage?.blocks.find((block) => block.id === selection.blockId)
    : undefined;
  const selectedDefinition = selectedBlock
    ? requireBlock(portfolioBlockRegistry, selectedBlock.type)
    : undefined;

  function humanizeProperty(key: string) {
    const labels: Record<string, string> = {
      setup: 'Setup',
      headline: 'Titular', eyebrow: 'Texto superior', introduction: 'Presentación',
      imageAssetId: 'Imagen', imageAlt: 'Texto alternativo', ctaLabel: 'Texto del botón', ctaUrl: 'Enlace del botón',
      heading: 'Título', body: 'Contenido', message: 'Mensaje', email: 'Email', phone: 'Teléfono',
      location: 'Ubicación', copyright: 'Copyright', align: 'Alineación', spacing: 'Espaciado',
      hidden: 'Ocultar sección', accentColor: 'Color de énfasis', anchor: 'Ancla',
      entries: 'Entradas', items: 'Elementos', socials: 'Redes sociales', links: 'Enlaces',
      columns: 'Columnas', linkStyle: 'Estilo de enlaces', title: 'Título', summary: 'Resumen',
      quote: 'Opinión', person: 'Persona', role: 'Cargo', period: 'Periodo', description: 'Descripción',
      url: 'Enlace', linkLabel: 'Texto del enlace', label: 'Etiqueta', name: 'Nombre',
    };
    return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  }

  function updatePropertyDraft(nextDraft: BlockProps) {
    setPropertyDraft(nextDraft);
    if (!editorData || !selection || !selectedBlock) return;

    try {
      const nextDocument = updateBlockProps(
        editorData.draftDocument,
        selection.pageId,
        selection.blockId,
        nextDraft,
      );
      setEditorData({ ...editorData, draftDocument: nextDocument });
      setPropertyErrors({});
    } catch (error) {
      if (error instanceof BlockPropsValidationError) {
        const nextErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const issuePath = issue.path.map((segment) => String(segment)).join('.');
          const topKey = String(issue.path[0] ?? '');
          if (issuePath) nextErrors[issuePath] = issue.message;
          if (topKey && !nextErrors[topKey]) nextErrors[topKey] = issue.message;
        }
        setPropertyErrors(nextErrors);
      } else {
        setPropertyErrors({ root: error instanceof Error ? error.message : 'No se pudo actualizar la sección.' });
      }
    }
  }

  function maxLengthForProperty(key: string) {
    const limits: Record<string, number> = {
      headline: 120,
      introduction: 400,
      eyebrow: 60,
      imageAssetId: 128,
      imageAlt: 160,
      ctaLabel: 40,
      ctaUrl: 2048,
      heading: 60,
      body: 1200,
      message: 400,
      copyright: 120,
      location: 80,
      quote: 500,
      person: 80,
      role: 80,
      period: 40,
      description: 400,
      summary: 300,
      title: 80,
      linkLabel: 40,
      url: 2048,
      label: 40,
      name: 80,
      anchor: 40,
      accentColor: 7,
      email: 254,
      phone: 40,
    };
    return limits[key];
  }

  function updateNestedProperty(path: (string | number)[], value: JsonValue) {
    if (!propertyDraft || path.length === 0) return;
    const nextDraft = structuredClone(propertyDraft);
    let target = nextDraft as unknown as Record<string | number, JsonValue>;
    for (let index = 0; index < path.length - 1; index += 1) {
      target = target[path[index]] as unknown as Record<string | number, JsonValue>;
    }
    target[path[path.length - 1]] = value;
    updatePropertyDraft(nextDraft);
  }

  async function uploadImage(file: File | null, targetPath: (string | number)[] = ['imageAssetId']) {
    if (!file || !editorData) return;
    setUploadingImage(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
        method: 'POST',
        cache: 'no-store',
        body: form,
      });
      const result = await response.json().catch(() => ({})) as {
        asset?: { id: string };
        message?: string;
      };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo subir la imagen.');
      if (!result.asset?.id) throw new Error('La subida no devolvió un identificador de imagen.');
      updateNestedProperty(targetPath, result.asset.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  const saveDraftDocument = useCallback(async (documentToSave: SiteDocument) => {
    const revision = ++saveRevision.current;
    const serializedDraft = JSON.stringify(documentToSave);
    setSaveStatus('saving');
    setSaveError('');

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftDocument: documentToSave }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo guardar el borrador.');

      if (revision === saveRevision.current) {
        lastSavedDraft.current = serializedDraft;
        setSaveStatus('saved');
      }
    } catch (error) {
      if (revision === saveRevision.current) {
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
      }
    }
  }, [projectId]);

  function renderPropertyEditor(key: string, value: JsonValue, path: (string | number)[]) {
    const exactPath = path.join('.');
    const error = propertyErrors[exactPath] ?? propertyErrors[String(path[0] ?? key)];
    const label = humanizeProperty(key);
    const maxLength = maxLengthForProperty(key);
    const characterCount = typeof value === 'string'
      ? `${value.length}${maxLength ? `/${maxLength}` : ''}`
      : '';

    if (typeof value === 'boolean') {
      return (
        <Switch
          key={path.join('.')}
          label={label}
          checked={value}
          disabled={!editorData?.project.canEdit}
          error={error}
          onChange={(event) => updateNestedProperty(path, event.currentTarget.checked)}
        />
      );
    }

    if (typeof value === 'number') {
      return key === 'columns' ? (
        <Select
          key={path.join('.')}
          label={label}
          value={String(value)}
          disabled={!editorData?.project.canEdit}
          data={[{ value: '1', label: '1 columna' }, { value: '2', label: '2 columnas' }, { value: '3', label: '3 columnas' }]}
          error={error}
          onChange={(nextValue) => updateNestedProperty(path, nextValue ? Number(nextValue) : 0)}
        />
      ) : null;
    }

    if (typeof value === 'string') {
      if (key === 'setup') {
        return (
          <Select
            key={path.join('.')}
            label="Setup"
            description="Elige el estilo visual para esta sección"
            value={value}
            disabled={!editorData?.project.canEdit}
            data={[
              { value: 'default', label: 'Default' },
              { value: 'modern', label: 'Modern' },
              { value: 'artsy', label: 'Artsy' },
            ]}
            error={error}
            onChange={(nextValue) => updateNestedProperty(path, nextValue ?? 'default')}
          />
        );
      }
      if (key === 'imageAssetId') {
        const canEditImage = editorData?.project.canEdit ?? false;
        return (
          <Stack key={path.join('.')} gap="xs">
            <TextInput
              label={label}
              description="Identificador generado automáticamente"
              placeholder="Sin imagen seleccionada"
              maxLength={maxLength}
              readOnly
              value={value}
              error={error}
            />
            <input
              ref={imageFileInputRef}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = '';
                void uploadImage(file, path);
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="light"
                disabled={!canEditImage || uploadingImage}
                leftSection={uploadingImage ? <Loader size="xs" /> : undefined}
                onClick={() => imageFileInputRef.current?.click()}
              >
                {uploadingImage ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
              </Button>
              <Button
                type="button"
                variant="subtle"
                color="red"
                disabled={!canEditImage || uploadingImage || !value}
                onClick={() => {
                  setUploadError('');
                  updateNestedProperty(path, '');
                }}
              >
                Quitar imagen
              </Button>
            </div>
            {uploadError ? <Alert color="red" variant="light">{uploadError}</Alert> : null}
          </Stack>
        );
      }
      if (key === 'align') {
        return (
          <Select
            key={path.join('.')}
            label={label}
            value={value}
            disabled={!editorData?.project.canEdit}
            data={[
              { value: 'left', label: 'Izquierda' },
              { value: 'center', label: 'Centro' },
              { value: 'right', label: 'Derecha' },
            ]}
            error={error}
            onChange={(nextValue) => updateNestedProperty(path, nextValue ?? 'left')}
          />
        );
      }
      if (key === 'spacing') {
        return (
          <Select
            key={path.join('.')}
            label={label}
            value={value}
            disabled={!editorData?.project.canEdit}
            data={[
              { value: 'compact', label: 'Compacto' },
              { value: 'comfortable', label: 'Cómodo' },
              { value: 'spacious', label: 'Amplio' },
            ]}
            error={error}
            onChange={(nextValue) => updateNestedProperty(path, nextValue ?? 'comfortable')}
          />
        );
      }
      if (key === 'linkStyle') {
        return (
          <Select key={path.join('.')} label={label} value={value} data={['text', 'buttons']}
            disabled={!editorData?.project.canEdit}
            error={error} onChange={(nextValue) => updateNestedProperty(path, nextValue ?? 'text')} />
        );
      }
      const isLong = ['introduction', 'message', 'body', 'summary', 'description', 'quote'].includes(key);
      if (isLong) {
        return (
          <Textarea key={path.join('.')} label={label} value={value} autosize minRows={2} maxRows={8}
            description={maxLength ? `${characterCount} caracteres` : undefined}
            maxLength={maxLength} disabled={!editorData?.project.canEdit}
            error={error} onChange={(event) => updateNestedProperty(path, event.currentTarget.value)} />
        );
      }
      return (
        <TextInput
          key={path.join('.')}
          label={label}
          description={key === 'imageAssetId'
            ? 'Identificador de la imagen asociada al bloque'
            : maxLength ? `${characterCount} caracteres` : undefined}
          placeholder={key === 'ctaUrl' || key === 'url' ? 'https://ejemplo.com' : undefined}
          maxLength={maxLength}
          disabled={!editorData?.project.canEdit}
          value={value}
          error={error}
          onChange={(event) => updateNestedProperty(path, event.currentTarget.value)}
        />
      );
    }

    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === 'string')) {
        return (
          <Textarea key={path.join('.')} label={label}
            description="Un elemento por línea"
            value={(value as string[]).join('\n')} autosize minRows={3}
            disabled={!editorData?.project.canEdit}
            error={error}
            onChange={(event) => updateNestedProperty(path, event.currentTarget.value.split('\n').map((item) => item))} />
        );
      }
      return (
        <Stack key={path.join('.')} gap="sm">
          <Text size="sm" fw={700}>{label}</Text>
          {value.map((item, index) => (
            <Card key={index} withBorder padding="sm" radius="md">
              <Stack gap="sm">
                <Text size="xs" c="dimmed" fw={700}>{label} {index + 1}</Text>
                {item && typeof item === 'object' && !Array.isArray(item)
                  ? Object.entries(item).map(([childKey, childValue]) => renderPropertyEditor(
                      childKey,
                      childValue,
                      [...path, index, childKey],
                    ))
                  : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      );
    }

    return null;
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

  function reorderBlock(pageId: string, blockId: string, targetIndex: number) {
    if (!editorData?.project.canEdit) return;
    const page = editorData.draftDocument.pages.find((candidate) => candidate.id === pageId);
    const currentIndex = page?.blocks.findIndex((block) => block.id === blockId) ?? -1;
    if (!page || currentIndex < 0 || targetIndex < 0 || targetIndex >= page.blocks.length || targetIndex === currentIndex) return;
    skipSelectionScroll.current = !isSelected(selection, pageId, blockId);
    setEditorData({ ...editorData, draftDocument: moveBlockInDocument(editorData.draftDocument, pageId, blockId, targetIndex) });
  }

  function duplicateBlock(pageId: string, blockId: string) {
    if (!editorData?.project.canEdit) return;
    const result = duplicateBlockInDocument(editorData.draftDocument, pageId, blockId);
    setEditorData({ ...editorData, draftDocument: result.document });
    selectBlock({ pageId, blockId: result.blockId });
  }

  function deleteBlock(pageId: string, blockId: string) {
    if (!editorData?.project.canEdit) return;
    const page = editorData.draftDocument.pages.find((candidate) => candidate.id === pageId);
    if (!page) return;
    const index = page.blocks.findIndex((block) => block.id === blockId);
    const nextDocument = deleteBlockFromDocument(editorData.draftDocument, pageId, blockId);
    setEditorData({ ...editorData, draftDocument: nextDocument });
    if (selection?.pageId === pageId && selection.blockId === blockId) {
      const nextBlock = page.blocks[Math.min(index, page.blocks.length - 2)] ?? page.blocks[index + 1];
      if (nextBlock) selectBlock({ pageId, blockId: nextBlock.id });
      else { setSelection(null); setPropertyDraft(null); setPropertyErrors({}); }
    }
  }

  function requestDeleteBlock(pageId: string, blockId: string) {
    if (!editorData?.project.canEdit) return;
    const block = editorData.draftDocument.pages
      .find((page) => page.id === pageId)?.blocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    setBlockPendingDelete({ pageId, blockId, label: requireBlock(portfolioBlockRegistry, block.type).label });
  }

  function handleBlockDragOver(event: React.DragEvent<HTMLElement>, target: BlockSelection) {
    if (!draggedBlock || draggedBlock.pageId !== target.pageId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    scrollCanvasDuringDrag(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    setDropTarget((current) => current?.pageId === target.pageId && current.blockId === target.blockId && current.position === position
      ? current
      : { ...target, position });
  }

  function scrollCanvasDuringDrag(event: React.DragEvent<HTMLElement>) {
    const viewport = canvasViewportRef.current;
    if (!viewport || !viewport.contains(event.currentTarget)) return;

    const bounds = viewport.getBoundingClientRect();
    const edgeZone = Math.min(200, Math.max(96, bounds.height * 0.24));
    const pointerY = event.clientY;
    let direction = 0;
    let proximity = 0;

    if (pointerY < bounds.top + edgeZone) {
      direction = -1;
      proximity = Math.min(1, Math.max(0, (bounds.top + edgeZone - pointerY) / edgeZone));
    } else if (pointerY > bounds.bottom - edgeZone) {
      direction = 1;
      proximity = Math.min(1, Math.max(0, (pointerY - (bounds.bottom - edgeZone)) / edgeZone));
    }

    if (direction !== 0 && proximity > 0) {
      viewport.scrollTop += direction * Math.ceil(3 + 22 * proximity ** 2);
    }
  }

  function dropBlock(event: React.DragEvent<HTMLElement>, target: BlockSelection, positionOverride?: DropTarget['position']) {
    event.preventDefault();
    if (!draggedBlock || !dropTarget || draggedBlock.pageId !== target.pageId || !editorData) return;
    const page = editorData.draftDocument.pages.find((candidate) => candidate.id === target.pageId);
    const sourceIndex = page?.blocks.findIndex((block) => block.id === draggedBlock.blockId) ?? -1;
    const targetIndex = page?.blocks.findIndex((block) => block.id === target.blockId) ?? -1;
    if (sourceIndex >= 0 && targetIndex >= 0) {
      const position = positionOverride ?? dropTarget.position;
      let destinationIndex = targetIndex + (position === 'after' ? 1 : 0);
      if (sourceIndex < destinationIndex) destinationIndex -= 1;
      reorderBlock(target.pageId, draggedBlock.blockId, destinationIndex);
    }
    setDraggedBlock(null);
    setDropTarget(null);
  }

  function dropPlaceholder(pageId: string, blockId: string, position: DropTarget['position']) {
    if (!draggedBlock || draggedBlock.pageId !== pageId) return null;
    const page = editorData?.draftDocument.pages.find((candidate) => candidate.id === pageId);
    const sourceIndex = page?.blocks.findIndex((block) => block.id === draggedBlock.blockId) ?? -1;
    const targetIndex = page?.blocks.findIndex((block) => block.id === blockId) ?? -1;
    let destinationIndex = targetIndex + (position === 'after' ? 1 : 0);
    if (sourceIndex < destinationIndex) destinationIndex -= 1;
    const wouldMove = sourceIndex >= 0 && targetIndex >= 0 && destinationIndex !== sourceIndex;
    return wouldMove && dropTarget?.pageId === pageId && dropTarget.blockId === blockId && dropTarget.position === position
      ? <div
          className={styles.dropPlaceholder}
          data-position={position}
          aria-hidden="true"
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            scrollCanvasDuringDrag(event);
            setDropTarget({ pageId, blockId, position });
          }}
          onDrop={(event) => {
            event.stopPropagation();
            dropBlock(event, { pageId, blockId }, position);
          }}
        />
      : null;
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

  const currentDraftJson = editorData ? JSON.stringify(editorData.draftDocument) : '';

  useEffect(() => {
    if (!editorData?.project.canEdit || !currentDraftJson) return;
    if (currentDraftJson === lastSavedDraft.current) {
      setSaveStatus('saved');
      setSaveError('');
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveDraftDocument(editorData.draftDocument);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [currentDraftJson, editorData?.project.canEdit, editorData?.draftDocument, saveDraftDocument]);

  useEffect(() => {
    if (!selection) return;
    if (skipSelectionScroll.current) {
      skipSelectionScroll.current = false;
      return;
    }
    canvasBlockFrames.current
      .get(selectionKey(selection))
      ?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  }, [selection]);

  useEffect(() => {
    const controller = new AbortController();

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
        lastSavedDraft.current = JSON.stringify(result.draftDocument);
        setSaveStatus('saved');
        const firstPage = result.draftDocument.pages[0];
        const firstBlock = firstPage?.blocks[0];
        if (firstPage && firstBlock) {
          const initialSelection = { pageId: firstPage.id, blockId: firstBlock.id };
          setSelection(initialSelection);
          const def = portfolioBlockRegistry.get(firstBlock.type);
          const initialProps = def?.defaultProps
            ? { ...def.defaultProps, ...firstBlock.props }
            : structuredClone(firstBlock.props);
          setPropertyDraft(initialProps);
          setPropertyErrors({});
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
                ? 'Los cambios se guardan automáticamente después de una breve pausa.'
                : 'Tienes acceso de solo lectura: puedes revisar el borrador, pero no modificarlo.'}
            </Text>
            {editorData && (
              <Badge mt="sm" color={saveStatus === 'error' ? 'red' : saveStatus === 'saving' ? 'yellow' : 'green'} variant="light">
                {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'error' ? 'Error al guardar' : 'Guardado'}
              </Badge>
            )}
          </div>
          <Button component="a" href="/app/projects" variant="default">
            Volver a proyectos
          </Button>
        </header>

        {saveStatus === 'error' && saveError && (
          <Alert color="red" title="El borrador temporal se conservó" role="alert">
            <Stack gap="sm">
              <Text size="sm">{saveError}</Text>
              <Button
                size="xs"
                color="red"
                variant="light"
                disabled={!editorData?.project.canEdit}
                onClick={() => {
                  if (editorData) void saveDraftDocument(editorData.draftDocument);
                }}
              >
                Reintentar guardado
              </Button>
            </Stack>
          </Alert>
        )}

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
            <section aria-label="Canvas del sitio" className="order-last min-w-0 lg:order-none">
              <Card withBorder radius="lg" padding="md" className={styles.canvasSurface}>
                <Stack gap="md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Title order={2}>Vista de página</Title>
                    <Badge variant="light" color={editorData.project.canEdit ? 'indigo' : 'gray'}>
                      {editorData.project.canEdit ? 'Editable' : 'Solo lectura'}
                    </Badge>
                  </div>
                  <div ref={canvasViewportRef} className={styles.canvasViewport}>
                    {editorData.draftDocument.pages.map((page) => (
                      <article key={page.id} className={styles.pageCanvas} aria-label={`Página ${page.path}`}>
                        {page.blocks.map((block, blockIndex) => (
                          <Fragment key={block.id}>
                          {dropPlaceholder(page.id, block.id, 'before')}
                          <CanvasBlock
                            block={block}
                            blockIndex={blockIndex}
                            pageId={page.id}
                            theme={editorData.draftDocument.site.theme}
                            selected={isSelected(selection, page.id, block.id)}
                            onSelect={selectBlock}
                            registerFrame={registerCanvasBlock}
                            draggable={editorData.project.canEdit}
                            onDragStart={() => { setDraggedBlock({ pageId: page.id, blockId: block.id }); setDropTarget(null); }}
                            onDragEnd={() => { setDraggedBlock(null); setDropTarget(null); }}
                            onDragOver={handleBlockDragOver}
                            onDrop={dropBlock}
                            onMove={(blockSelection, targetIndex) => reorderBlock(blockSelection.pageId, blockSelection.blockId, targetIndex)}
                            onRequestDelete={(blockSelection) => requestDeleteBlock(blockSelection.pageId, blockSelection.blockId)}
                            onDuplicate={(blockSelection) => duplicateBlock(blockSelection.pageId, blockSelection.blockId)}
                          />
                          {dropPlaceholder(page.id, block.id, 'after')}
                          </Fragment>
                        ))}
                      </article>
                    ))}
                  </div>
                </Stack>
              </Card>
            </section>

            <aside aria-label="Lista de secciones" className="order-first min-w-0 lg:order-none">
              <Card ref={sectionsPanelRef} withBorder radius="lg" padding="sm" className={styles.sectionsPanel}>
                <Stack gap="md">
                  <div>
                    <Title order={2}>Secciones</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      {editorData.project.canEdit ? 'Edición local' : 'Solo lectura'}
                    </Text>
                    {editorData.project.canEdit && (
                      <Text size="xs" c="dimmed" mt={4}>
                        Teclado: enfoca una sección y usa ↑ / ↓ para moverla, Shift + D para duplicarla o Delete para eliminarla. También puedes recorrer los botones con Tab y activarlos con Enter.
                      </Text>
                    )}
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
                  <nav aria-label="Secciones del sitio" className={styles.sectionsNav}>
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
                                  <div
                                    key={block.id}
                                    className={styles.sectionRow}
                                    data-selected={selected}
                                    draggable={editorData.project.canEdit}
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = 'move';
                                      event.dataTransfer.setData('text/plain', block.id);
                                      setDraggedBlock({ pageId: page.id, blockId: block.id });
                                      setDropTarget(null);
                                    }}
                                    onDragEnd={() => { setDraggedBlock(null); setDropTarget(null); }}
                                    onDragOver={(event) => handleBlockDragOver(event, { pageId: page.id, blockId: block.id })}
                                    onDrop={(event) => dropBlock(event, { pageId: page.id, blockId: block.id })}
                                    onKeyDown={(event) => {
                                    if (event.shiftKey && event.key.toLowerCase() === 'd') {
                                      event.preventDefault();
                                      selectBlock({ pageId: page.id, blockId: block.id });
                                      duplicateBlock(page.id, block.id);
                                      return;
                                    }
                                    if (event.key !== 'Delete' && event.key !== 'Del' && event.key !== 'Backspace') return;
                                    event.preventDefault();
                                    selectBlock({ pageId: page.id, blockId: block.id });
                                    requestDeleteBlock(page.id, block.id);
                                  }}>
                                    {dropPlaceholder(page.id, block.id, 'before')}
                                    <Button className={styles.sectionSelect} fullWidth variant={selected ? 'filled' : 'default'} aria-pressed={selected} aria-label={`Seleccionar sección ${blockIndex + 1}: ${definition.label}, página ${page.path}`} onClick={() => selectBlock({ pageId: page.id, blockId: block.id })} onKeyDown={(event) => {
                                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                                      event.preventDefault();
                                      selectBlock({ pageId: page.id, blockId: block.id });
                                      reorderBlock(page.id, block.id, blockIndex + (event.key === 'ArrowUp' ? -1 : 1));
                                    }}>
                                      {blockIndex + 1}. {definition.label}
                                    </Button>
                                    <div className={styles.sectionActions}>
                                      <div className={styles.moveActions}>
                                        <Button className={styles.iconAction} size="sm" variant="default" aria-label={`Mover ${definition.label} arriba`} title={`Mover ${definition.label} arriba`} disabled={!editorData.project.canEdit || blockIndex === 0} onClick={() => reorderBlock(page.id, block.id, blockIndex - 1)}><ArrowUp size={18} aria-hidden="true" /></Button>
                                        <Button className={styles.iconAction} size="sm" variant="default" aria-label={`Mover ${definition.label} abajo`} title={`Mover ${definition.label} abajo`} disabled={!editorData.project.canEdit || blockIndex === page.blocks.length - 1} onClick={() => reorderBlock(page.id, block.id, blockIndex + 1)}><ArrowDown size={18} aria-hidden="true" /></Button>
                                      </div>
                                      <div className={styles.compositionActions}>
                                        <Button className={styles.iconAction} size="sm" variant="default" aria-label={`Duplicar ${definition.label}`} title={`Duplicar ${definition.label}`} disabled={!editorData.project.canEdit} onClick={() => duplicateBlock(page.id, block.id)}><Copy size={18} aria-hidden="true" /></Button>
                                        <Button className={styles.iconAction} size="sm" color="red" variant="light" aria-label={`Eliminar ${definition.label}`} title={`Eliminar ${definition.label}`} disabled={!editorData.project.canEdit} onClick={() => requestDeleteBlock(page.id, block.id)}><Trash2 size={18} aria-hidden="true" /></Button>
                                      </div>
                                    </div>
                                    {dropPlaceholder(page.id, block.id, 'after')}
                                  </div>
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
                  <section aria-label="Propiedades de la sección">
                    <Text size="sm" fw={700} mb="xs">Propiedades</Text>
                    {selectedBlock && selectedDefinition && propertyDraft ? (
                      <Stack gap="sm">
                        <Text size="xs" c="dimmed">
                          {selectedDefinition.label}
                        </Text>
                        {Object.entries(propertyDraft)
                          .sort(([a], [b]) => (a === 'setup' ? -1 : b === 'setup' ? 1 : 0))
                          .map(([key, value]) => (
                          renderPropertyEditor(key, value, [key])
                        ))}
                        {propertyErrors.root && (
                          <Alert color="red" role="alert">{propertyErrors.root}</Alert>
                        )}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">Selecciona una sección para editar sus propiedades.</Text>
                    )}
                  </section>
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
      <Modal
        opened={blockPendingDelete !== null}
        onClose={() => setBlockPendingDelete(null)}
        title="¿Eliminar sección?"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text>¿Seguro que quieres eliminar {blockPendingDelete?.label}? Esta acción no se puede deshacer.</Text>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setBlockPendingDelete(null)}>Cancelar</Button>
            <Button color="red" disabled={!editorData?.project.canEdit} onClick={() => {
              if (blockPendingDelete) deleteBlock(blockPendingDelete.pageId, blockPendingDelete.blockId);
              setBlockPendingDelete(null);
            }}>Eliminar sección</Button>
          </div>
        </Stack>
      </Modal>
    </main>
  );
}
