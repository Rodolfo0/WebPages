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
import { useHotkeys } from '@mantine/hooks';
import type { HotkeyItem } from '@mantine/hooks';
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, ImageMinus, Monitor, Pencil, Redo2, Smartphone, Trash2, Undo2, Upload } from 'lucide-react';
import { create, type Delta } from 'jsondiffpatch';
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
  draftRevision: number;
  canEdit: boolean;
};

type ProjectEditorResponse = {
  project?: ProjectSummary;
  draftDocument?: SiteDocument;
  message?: string;
};

type SaveDraftResponse = {
  project?: { draftRevision?: number };
  error?: string;
  message?: string;
};

type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

const AUTOSAVE_DELAY_MS = 600;

class DraftConflictError extends Error {}

type EditorData = {
  project: ProjectSummary;
  draftDocument: SiteDocument;
};

type EditorAsset = { id: string; filename: string; createdAt: string };

type BlockSelection = {
  pageId: string;
  blockId: string;
};

type DropTarget = BlockSelection & { position: 'before' | 'after' };
type HistoryEntry = { delta: Delta };
type EditorCommandScope = 'global' | 'editor' | 'canvas' | 'text-entry';
type EditorCommand = {
  id: string;
  hotkey: string;
  scope: EditorCommandScope;
  run: (event: globalThis.KeyboardEvent) => void;
};

const commandScopePriority: Record<EditorCommandScope, number> = {
  global: 0,
  editor: 1,
  canvas: 2,
  'text-entry': 2,
};

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
    || target.closest('[contenteditable="true"]') !== null
  );
}

function isCommandScopeActive(scope: EditorCommandScope, event: globalThis.KeyboardEvent) {
  if (scope === 'global') return true;
  if (scope === 'editor') {
    return event.target instanceof Element
      && event.target.closest('[data-editor-command-scope~="editor"]') !== null;
  }
  if (scope === 'text-entry') return isTextEntryTarget(event.target);
  return event.target instanceof Element
    && event.target.closest('[data-editor-command-scope~="canvas"]') !== null;
}

const editorDiff = create({
  objectHash: (item, index) => {
    const id = (item as { id?: unknown }).id;
    return typeof id === 'string' ? id : `$$index:${index ?? 0}`;
  },
  cloneDiffValues: true,
});

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
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [sectionsPanelVisible, setSectionsPanelVisible] = useState(true);
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] });
  const [catalogOpened, setCatalogOpened] = useState(false);
  const [blockPendingDelete, setBlockPendingDelete] = useState<{ pageId: string; blockId: string; label: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<BlockProps | null>(null);
  const [propertyErrors, setPropertyErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState('');
  const [reloadingDraft, setReloadingDraft] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [projectAssets, setProjectAssets] = useState<EditorAsset[]>([]);
  const [imagePickerTargetPath, setImagePickerTargetPath] = useState<(string | number)[] | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<EditorAsset | null>(null);
  const [assetPendingRename, setAssetPendingRename] = useState<EditorAsset | null>(null);
  const [renameFilename, setRenameFilename] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<BlockSelection | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // The last draft the server confirmed, and the server revision it was stored under. Each save
  // sends that revision; the server rejects it if another tab saved a newer draft meanwhile.
  const lastSavedDraft = useRef('');
  const serverDraftRevision = useRef(0);
  const latestDraft = useRef<SiteDocument | null>(null);
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const draftConflict = useRef(false);
  const canvasBlockFrames = useRef(new Map<string, HTMLDivElement>());
  const dragTargetBounds = useRef(new Map<string, DOMRect>());
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const skipSelectionScroll = useRef(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const imagePickerFileInputRef = useRef<HTMLInputElement | null>(null);
  const sectionsPanelRef = useRef<HTMLDivElement | null>(null);

  function commitDocument(nextDocument: SiteDocument) {
    if (!editorData || JSON.stringify(nextDocument) === JSON.stringify(editorData.draftDocument)) return;
    const delta = editorDiff.diff(editorData.draftDocument, nextDocument);
    if (!delta) return;
    const entry: HistoryEntry = { delta };
    setHistory((current) => ({
      past: [...current.past, entry].slice(-20),
      future: [],
    }));
    setEditorData({ ...editorData, draftDocument: nextDocument });
  }

  const syncSelectedProperties = useCallback((document: SiteDocument) => {
    if (!selection) return;
    const block = document.pages.find((page) => page.id === selection.pageId)
      ?.blocks.find((candidate) => candidate.id === selection.blockId);
    if (!block) return;
    const definition = portfolioBlockRegistry.get(block.type);
    setPropertyDraft(definition?.defaultProps
      ? { ...definition.defaultProps, ...block.props }
      : structuredClone(block.props));
    setPropertyErrors({});
  }, [selection]);

  const undoDocumentChange = useCallback(() => {
    if (!editorData?.project.canEdit || history.past.length === 0) return;
    const entry = history.past[history.past.length - 1];
    const previous = editorDiff.unpatch(structuredClone(editorData.draftDocument), entry.delta) as SiteDocument;
    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [entry, ...current.future].slice(0, 20),
    }));
    setEditorData({ ...editorData, draftDocument: previous });
    syncSelectedProperties(previous);
  }, [editorData, history, syncSelectedProperties]);

  const redoDocumentChange = useCallback(() => {
    if (!editorData?.project.canEdit || history.future.length === 0) return;
    const entry = history.future[0];
    const next = editorDiff.patch(structuredClone(editorData.draftDocument), entry.delta) as SiteDocument;
    setHistory((current) => ({
      past: [...current.past, entry].slice(-20),
      future: current.future.slice(1),
    }));
    setEditorData({ ...editorData, draftDocument: next });
    syncSelectedProperties(next);
  }, [editorData, history, syncSelectedProperties]);

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
      setup: 'Estilo',
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
      commitDocument(nextDocument);
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
    if (!file || !editorData) return false;
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
        asset?: EditorAsset;
        message?: string;
      };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo subir la imagen.');
      if (!result.asset?.id) throw new Error('La subida no devolvió un identificador de imagen.');
      setProjectAssets((current) => [result.asset!, ...current.filter((asset) => asset.id !== result.asset!.id)]);
      updateNestedProperty(targetPath, result.asset.id);
      return true;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo subir la imagen.');
      return false;
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadImages(files: File[], targetPath: (string | number)[] = ['imageAssetId']) {
    if (files.length === 0 || !editorData?.project.canEdit) return false;
    setUploadingImage(true);
    setUploadError('');
    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const uploadedAssets: EditorAsset[] = [];
      const failures: string[] = [];

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          failures.push(`${file.name}: tipo de imagen no permitido.`);
          continue;
        }

        try {
          const form = new FormData();
          form.set('file', file);
          const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
            method: 'POST',
            cache: 'no-store',
            body: form,
          });
          const result = await response.json().catch(() => ({})) as {
            asset?: EditorAsset;
            message?: string;
          };
          if (!response.ok) throw new Error(result.message ?? 'No se pudo subir la imagen.');
          if (!result.asset?.id) throw new Error('La subida no devolvió un identificador de imagen.');
          uploadedAssets.push(result.asset);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
          failures.push(`${file.name}: ${message}`);
        }
      }

      if (uploadedAssets.length > 0) {
        const uploadedIds = new Set(uploadedAssets.map((asset) => asset.id));
        setProjectAssets((current) => [...uploadedAssets, ...current.filter((asset) => !uploadedIds.has(asset.id))]);
        updateNestedProperty(targetPath, uploadedAssets[uploadedAssets.length - 1].id);
      }

      if (failures.length > 0) setUploadError(failures.join(' '));
      return uploadedAssets.length === files.length && failures.length === 0;
    } finally {
      setUploadingImage(false);
    }
  }

  async function renameImage(asset: EditorAsset) {
    if (!editorData?.project.canEdit) return false;
    setRenamingAssetId(asset.id);
    setRenameError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(asset.id)}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: renameFilename }),
      });
      const result = await response.json().catch(() => ({})) as { asset?: EditorAsset; message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo renombrar la imagen.');
      if (!result.asset) throw new Error('La respuesta no incluyó la imagen renombrada.');
      setProjectAssets((current) => current.map((candidate) => candidate.id === asset.id ? result.asset! : candidate));
      setAssetPendingRename(null);
      return true;
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'No se pudo renombrar la imagen.');
      return false;
    } finally {
      setRenamingAssetId(null);
    }
  }

  async function deleteImage(asset: EditorAsset) {
    if (!editorData?.project.canEdit) return false;
    setDeletingAssetId(asset.id);
    setUploadError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string; draftDocument?: SiteDocument; draftRevision?: number };
      if (!response.ok) {
        const message = result.error === 'asset_in_use' || response.status === 409
          ? result.message ?? 'La imagen sigue en uso. Quita sus referencias de los bloques y publica una versión actualizada antes de eliminarla.'
          : result.message ?? 'No se pudo eliminar la imagen.';
        throw new Error(message);
      }
      setProjectAssets((current) => current.filter((candidate) => candidate.id !== asset.id));
      if (result.draftDocument) {
        setEditorData((current) => current ? { ...current, draftDocument: result.draftDocument! } : current);
        latestDraft.current = result.draftDocument;
        lastSavedDraft.current = JSON.stringify(result.draftDocument);
        if (typeof result.draftRevision === 'number') serverDraftRevision.current = result.draftRevision;
        setHistory({ past: [], future: [] });
        syncSelectedProperties(result.draftDocument);
      }
      return true;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo eliminar la imagen.');
      return false;
    } finally {
      setDeletingAssetId(null);
    }
  }

  /**
   * Saves the latest local draft. Only one request runs at a time, so responses cannot arrive out
   * of order; edits made while a request is pending are sent right after it with the new revision.
   * Local changes are never discarded here: a failure only changes the status shown to the user.
   */
  const saveDraftDocument = useCallback(async () => {
    if (draftConflict.current) return;
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }

    saveInFlight.current = true;
    try {
      for (;;) {
        saveQueued.current = false;
        const documentToSave = latestDraft.current;
        const serializedDraft = documentToSave ? JSON.stringify(documentToSave) : '';
        if (!documentToSave || serializedDraft === lastSavedDraft.current) {
          setSaveStatus('saved');
          setSaveError('');
          return;
        }

        setSaveStatus('saving');
        setSaveError('');
        try {
          const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draftDocument: documentToSave,
              draftRevision: serverDraftRevision.current,
            }),
          });
          const result = await response.json().catch(() => ({})) as SaveDraftResponse;
          if (response.status === 409 && result.error === 'project_draft_conflict') {
            throw new DraftConflictError(result.message ?? 'Hay una versión más reciente del borrador.');
          }
          if (!response.ok) throw new Error(result.message ?? 'No se pudo guardar el borrador.');
          if (typeof result.project?.draftRevision !== 'number') {
            throw new Error('El servidor no confirmó la revisión guardada.');
          }

          serverDraftRevision.current = result.project.draftRevision;
          lastSavedDraft.current = serializedDraft;
        } catch (error) {
          if (error instanceof DraftConflictError) {
            draftConflict.current = true;
            setSaveStatus('conflict');
          } else {
            setSaveStatus('error');
          }
          setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
          return;
        }

        if (!saveQueued.current) {
          const latestSerialized = latestDraft.current ? JSON.stringify(latestDraft.current) : '';
          // Newer edits still waiting for their pause keep the "saving" state until they are sent.
          if (latestSerialized === lastSavedDraft.current) {
            setSaveStatus('saved');
          }
          return;
        }
      }
    } finally {
      saveInFlight.current = false;
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
            label="Estilo"
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
        const selectedAsset = projectAssets.find((asset) => asset.id === value);
        return (
          <Stack key={path.join('.')} gap="xs">
            {projectAssets.length > 0 && (
              <Stack gap={6}>
                <Text size="sm" fw={500}>Imagen</Text>
                {selectedAsset ? (
                  <Card withBorder padding="xs" radius="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {/* This image is served through the app's private asset route, so keep its URL unoptimized. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/assets/${encodeURIComponent(selectedAsset.id)}`} alt="" width={56} height={42}
                        style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      <Text size="sm" title={selectedAsset.filename} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                        {selectedAsset.filename}
                      </Text>
                    </div>
                  </Card>
                ) : (
                  <Text size="sm" c="dimmed">Sin imagen seleccionada</Text>
                )}
                <Button type="button" variant="default" disabled={!canEditImage || uploadingImage}
                  onClick={() => setImagePickerTargetPath(path)}>
                  {selectedAsset ? 'Cambiar imagen' : 'Elegir imagen'}
                </Button>
              </Stack>
            )}
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
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <Button
                type="button"
                variant="light"
                disabled={!canEditImage || uploadingImage}
                aria-label={uploadingImage ? 'Subiendo imagen' : 'Subir imagen'}
                title={uploadingImage ? 'Subiendo imagen' : 'Subir imagen'}
                onClick={() => imageFileInputRef.current?.click()}
                style={{ flex: 1 }}
              >{uploadingImage ? <Loader size="xs" /> : <Upload size={16} aria-hidden="true" />}
              </Button>
              <Button
                type="button"
                variant="subtle"
                color="red"
                aria-label="Quitar imagen"
                title="Quitar imagen"
                disabled={!canEditImage || uploadingImage || !value}
                style={{ flex: 1 }}
                onClick={() => {
                  setUploadError('');
                  updateNestedProperty(path, '');
                }}
              >
                <ImageMinus size={16} aria-hidden="true" />
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
          description={maxLength ? `${characterCount} caracteres` : undefined}
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
      commitDocument(result.document);
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
    commitDocument(moveBlockInDocument(editorData.draftDocument, pageId, blockId, targetIndex));
  }

  function duplicateBlock(pageId: string, blockId: string) {
    if (!editorData?.project.canEdit) return;
    const result = duplicateBlockInDocument(editorData.draftDocument, pageId, blockId);
    commitDocument(result.document);
    selectBlock({ pageId, blockId: result.blockId });
  }

  function deleteBlock(pageId: string, blockId: string) {
    if (!editorData?.project.canEdit) return;
    const page = editorData.draftDocument.pages.find((candidate) => candidate.id === pageId);
    if (!page) return;
    const index = page.blocks.findIndex((block) => block.id === blockId);
    const nextDocument = deleteBlockFromDocument(editorData.draftDocument, pageId, blockId);
    commitDocument(nextDocument);
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
    const targetKey = selectionKey(target);
    let bounds = dragTargetBounds.current.get(targetKey);
    if (!bounds) {
      bounds = event.currentTarget.getBoundingClientRect();
      dragTargetBounds.current.set(targetKey, bounds);
    }
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
    dragTargetBounds.current.clear();
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

  const editorCommands: EditorCommand[] = [
    { id: 'undo', hotkey: 'mod+z', scope: 'global', run: undoDocumentChange },
    { id: 'redo', hotkey: 'mod+y', scope: 'global', run: redoDocumentChange },
    { id: 'redo-shift-z', hotkey: 'mod+shift+z', scope: 'global', run: redoDocumentChange },
  ];
  const registeredHotkeys = [...new Set(editorCommands.map((command) => command.hotkey))];
  const hotkeys: HotkeyItem[] = registeredHotkeys.map((hotkey) => [
    hotkey,
    (event) => {
      const command = editorCommands
        .filter((candidate) => candidate.hotkey === hotkey && isCommandScopeActive(candidate.scope, event))
        .sort((first, second) => commandScopePriority[second.scope] - commandScopePriority[first.scope])[0];
      if (!command) return;
      event.preventDefault();
      command.run(event);
    },
    { preventDefault: false },
  ]);

  useHotkeys(hotkeys, [], true);

  useEffect(() => {
    latestDraft.current = editorData?.draftDocument ?? null;
    if (!editorData?.project.canEdit || !currentDraftJson || draftConflict.current) return;
    if (currentDraftJson === lastSavedDraft.current) {
      if (!saveInFlight.current) {
        setSaveStatus('saved');
        setSaveError('');
      }
      return;
    }

    setSaveStatus('saving');
    const timeout = window.setTimeout(() => {
      void saveDraftDocument();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [currentDraftJson, editorData?.project.canEdit, editorData?.draftDocument, saveDraftDocument]);

  const hasUnsavedChanges = saveStatus !== 'saved';
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

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

  const applyLoadedDraft = useCallback((result: ProjectEditorResponse, keepSelection: boolean) => {
    if (!result.project || !result.draftDocument) {
      throw new Error('La respuesta no incluye el borrador del proyecto.');
    }
    const { project, draftDocument } = result;

    setEditorData({ project, draftDocument });
    setHistory({ past: [], future: [] });
    latestDraft.current = draftDocument;
    lastSavedDraft.current = JSON.stringify(draftDocument);
    serverDraftRevision.current = project.draftRevision;
    draftConflict.current = false;
    setSaveStatus('saved');
    setSaveError('');

    const keptBlock = keepSelection && selection
      ? draftDocument.pages.find((page) => page.id === selection.pageId)
        ?.blocks.find((block) => block.id === selection.blockId)
      : undefined;
    const firstPage = draftDocument.pages[0];
    const nextSelection = keptBlock && selection
      ? selection
      : firstPage?.blocks[0] ? { pageId: firstPage.id, blockId: firstPage.blocks[0].id } : null;
    const nextBlock = keptBlock ?? firstPage?.blocks[0];

    setSelection(nextSelection);
    if (nextSelection && nextBlock) {
      const def = portfolioBlockRegistry.get(nextBlock.type);
      setPropertyDraft(def?.defaultProps
        ? { ...def.defaultProps, ...nextBlock.props }
        : structuredClone(nextBlock.props));
    } else {
      setPropertyDraft(null);
    }
    setPropertyErrors({});
  }, [selection]);

  async function fetchProjectDraft(signal?: AbortSignal) {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: 'no-store',
      signal,
    });
    const result = await response.json() as ProjectEditorResponse;
    if (!response.ok) {
      throw new Error(result.message ?? 'No se pudo cargar el borrador del proyecto.');
    }
    return result;
  }

  async function reloadLatestDraft() {
    setReloadingDraft(true);
    try {
      applyLoadedDraft(await fetchProjectDraft(), true);
    } catch (error) {
      setSaveError(error instanceof Error
        ? error.message
        : 'No se pudo cargar la versión más reciente. Inténtalo de nuevo.');
    } finally {
      setReloadingDraft(false);
    }
  }

  const fetchInitialDraft = useRef(fetchProjectDraft);
  const applyInitialDraft = useRef(applyLoadedDraft);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { assets?: EditorAsset[] };
        if (response.ok && !controller.signal.aborted) setProjectAssets(result.assets ?? []);
      })
      .catch(() => {});

    fetchInitialDraft.current(controller.signal)
      .then((result) => applyInitialDraft.current(result, false))
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
    <main data-editor-command-scope="editor" className={styles.editorPage}>
      <div className={styles.editorContainer}>
        <header className={styles.editorHeader}>
          <div className={styles.editorHeading}>
            <Title order={1} className={styles.editorTitle}>{editorData?.project.name ?? 'Proyecto'}</Title>
            {editorData && (
              <Badge
                className={styles.saveBadge}
                role="status"
                color={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'yellow' : 'red'}
                variant="light"
              >
                {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? 'Guardado' : 'Error al guardar'}
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
                  void saveDraftDocument();
                }}
              >
                Reintentar guardado
              </Button>
            </Stack>
          </Alert>
        )}

        {saveStatus === 'conflict' && (
          <Alert color="red" title="Hay una versión más reciente del borrador" role="alert">
            <Stack gap="sm">
              <Text size="sm">{saveError}</Text>
              <Text size="sm">
                Tus cambios siguen visibles aquí, pero no se guardarán sobre la versión más reciente.
                Cópialos si los necesitas y carga la última versión para seguir editando.
              </Text>
              <Button
                size="xs"
                color="red"
                variant="light"
                loading={reloadingDraft}
                onClick={() => {
                  void reloadLatestDraft();
                }}
              >
                Cargar versión más reciente
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
          <div className={`${styles.workspace} ${sectionsPanelVisible ? '' : styles.workspaceCollapsed}`}>
            <section aria-label="Canvas del sitio" className={styles.canvasPanel}>
              <Card withBorder radius="lg" padding="sm" className={styles.canvasSurface}>
                <Stack gap="md" className={styles.canvasStack}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Title order={2} className={styles.panelHeading}>Vista de página</Title>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button.Group aria-label="Tamaño de vista previa">
                        <Button variant={previewMode === 'desktop' ? 'filled' : 'default'} aria-pressed={previewMode === 'desktop'} aria-label="Vista de escritorio" onClick={() => setPreviewMode('desktop')}><Monitor size={16} aria-hidden="true" /> Escritorio</Button>
                        <Button variant={previewMode === 'mobile' ? 'filled' : 'default'} aria-pressed={previewMode === 'mobile'} aria-label="Vista móvil" onClick={() => setPreviewMode('mobile')}><Smartphone size={16} aria-hidden="true" /> Móvil</Button>
                      </Button.Group>
                      <Button variant="default" aria-label={sectionsPanelVisible ? 'Ocultar panel lateral' : 'Mostrar panel lateral'} aria-pressed={!sectionsPanelVisible} onClick={() => setSectionsPanelVisible((visible) => !visible)}>
                        {sectionsPanelVisible ? 'Ocultar panel' : 'Mostrar panel'}
                      </Button>
                      <Button variant="default" aria-label="Deshacer" disabled={!editorData.project.canEdit || history.past.length === 0} onClick={undoDocumentChange}><Undo2 size={16} aria-hidden="true" /></Button>
                      <Button variant="default" aria-label="Rehacer" disabled={!editorData.project.canEdit || history.future.length === 0} onClick={redoDocumentChange}><Redo2 size={16} aria-hidden="true" /></Button>
                      <Badge variant="light" color={editorData.project.canEdit ? 'indigo' : 'gray'}>
                        {editorData.project.canEdit ? 'Editable' : 'Solo lectura'}
                      </Badge>
                    </div>
                  </div>
                  <div ref={canvasViewportRef} data-editor-command-scope="canvas" className={`${styles.canvasViewport} ${previewMode === 'mobile' ? styles.mobilePreview : ''}`}>
                    {editorData.draftDocument.pages.map((page) => (
                      <article key={page.id} className={styles.pageCanvas} data-preview={previewMode} aria-label={`Página ${page.path}`}>
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
                            onDragStart={() => { dragTargetBounds.current.clear(); setDraggedBlock({ pageId: page.id, blockId: block.id }); setDropTarget(null); }}
                            onDragEnd={() => { dragTargetBounds.current.clear(); setDraggedBlock(null); setDropTarget(null); }}
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

            {sectionsPanelVisible && <aside aria-label="Lista de secciones" className={styles.sectionsColumn}>
              <Card ref={sectionsPanelRef} withBorder radius="lg" padding="sm" className={`${styles.sectionsPanel} ${styles.sectionsSurface}`}>
                <Stack gap="sm" className={styles.sectionsStack}>
                  <div>
                    <Title order={2} className={styles.panelHeading}>Estructura</Title>
                    <Text className={styles.panelDescription} mt={4}>
                      {editorData.project.canEdit ? 'Edición local' : 'Solo lectura'}
                    </Text>
                    {editorData.project.canEdit && (
                      <Text className={styles.panelHint} mt="xs">
                        Usa los controles de cada sección para reordenar, duplicar o eliminar. También puedes moverlas con el teclado.
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
                    <Stack gap="md">
                      {editorData.draftDocument.pages.map((page) => (
                        <section key={page.id} aria-label={`Página ${page.path}`}>
                          <Text className={styles.pagePath} title={page.path}>{page.path}</Text>
                          {page.blocks.length > 0 ? (
                            <Stack gap={4}>
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
                                      dragTargetBounds.current.clear();
                                      const dragPreview = event.currentTarget.querySelector<HTMLElement>('[data-drag-preview]');
                                      if (dragPreview && typeof event.dataTransfer.setDragImage === 'function') {
                                        const bounds = dragPreview.getBoundingClientRect();
                                        event.dataTransfer.setDragImage(
                                          dragPreview,
                                          bounds.width * 0.5,
                                          bounds.height * 1.35,
                                        );
                                      }
                                      setDraggedBlock({ pageId: page.id, blockId: block.id });
                                      setDropTarget(null);
                                    }}
                                    onDragEnd={() => { dragTargetBounds.current.clear(); setDraggedBlock(null); setDropTarget(null); }}
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
                                    <Button data-drag-preview className={styles.sectionSelect} fullWidth size="compact-sm" variant={selected ? 'light' : 'subtle'} color={selected ? 'indigo' : 'gray'} aria-pressed={selected} aria-label={`Seleccionar sección ${blockIndex + 1}: ${definition.label}, página ${page.path}`} title={definition.label} onClick={() => selectBlock({ pageId: page.id, blockId: block.id })} onKeyDown={(event) => {
                                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                                      event.preventDefault();
                                      selectBlock({ pageId: page.id, blockId: block.id });
                                      reorderBlock(page.id, block.id, blockIndex + (event.key === 'ArrowUp' ? -1 : 1));
                                    }}>
                                      <span className={styles.sectionIndex}>{blockIndex + 1}.</span>
                                      <span className={styles.sectionLabel}>{definition.label}</span>
                                    </Button>
                                    <div className={styles.sectionActions}>
                                      <div className={styles.moveActions}>
                                        <Button className={styles.iconAction} size="compact-sm" variant="subtle" color="gray" aria-label={`Mover ${definition.label} arriba`} title={`Mover ${definition.label} arriba`} disabled={!editorData.project.canEdit || blockIndex === 0} onClick={() => reorderBlock(page.id, block.id, blockIndex - 1)}><ArrowUp size={16} aria-hidden="true" /></Button>
                                        <Button className={styles.iconAction} size="compact-sm" variant="subtle" color="gray" aria-label={`Mover ${definition.label} abajo`} title={`Mover ${definition.label} abajo`} disabled={!editorData.project.canEdit || blockIndex === page.blocks.length - 1} onClick={() => reorderBlock(page.id, block.id, blockIndex + 1)}><ArrowDown size={16} aria-hidden="true" /></Button>
                                      </div>
                                      <div className={styles.compositionActions}>
                                        <Button className={styles.iconAction} size="compact-sm" variant="subtle" color="gray" aria-label={`Duplicar ${definition.label}`} title={`Duplicar ${definition.label}`} disabled={!editorData.project.canEdit} onClick={() => duplicateBlock(page.id, block.id)}><Copy size={16} aria-hidden="true" /></Button>
                                        <Button className={styles.iconAction} size="compact-sm" color="red" variant="subtle" aria-label={`Eliminar ${definition.label}`} title={`Eliminar ${definition.label}`} disabled={!editorData.project.canEdit} onClick={() => requestDeleteBlock(page.id, block.id)}><Trash2 size={16} aria-hidden="true" /></Button>
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
                </Stack>
              </Card>
            </aside>}
            {sectionsPanelVisible && <aside aria-label="Propiedades de la sección" className={styles.inspectorPanel}>
              <Card withBorder radius="lg" padding="sm" className={styles.inspectorSurface}>
                <Stack gap="md">
                  <div>
                    <Title order={2} className={styles.panelHeading}>Propiedades</Title>
                    {selectedBlock && selectedDefinition && (
                      <Text className={styles.panelDescription} mt={4}>
                        Editando: {selectedDefinition.label}
                      </Text>
                    )}
                  </div>
                  {selectedBlock && selectedDefinition && propertyDraft ? (
                    <Stack gap="sm">
                      {Object.entries(propertyDraft)
                        .sort(([a], [b]) => (a === 'setup' ? -1 : b === 'setup' ? 1 : 0))
                        .map(([key, value]) => renderPropertyEditor(key, value, [key]))}
                      {propertyErrors.root && (
                        <Alert color="red" role="alert">{propertyErrors.root}</Alert>
                      )}
                    </Stack>
                  ) : (
                    <Text className={styles.panelDescription}>
                      Selecciona una sección en la estructura o en la vista para editar su contenido.
                    </Text>
                  )}
                </Stack>
              </Card>
            </aside>}
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
        opened={imagePickerTargetPath !== null}
        onClose={() => setImagePickerTargetPath(null)}
        title="Elegir imagen del proyecto"
        centered
        size="lg"
      >
        <Stack gap="md">
          <input
            ref={imagePickerFileInputRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void uploadImages(files, imagePickerTargetPath ?? ['imageAssetId']).then((uploaded) => {
                if (uploaded) setImagePickerTargetPath(null);
              });
            }}
            multiple
          />
          <Card
            withBorder
            padding="md"
            radius="md"
            role="region"
            aria-label="Zona para soltar imágenes"
            onDragEnter={(event) => {
              event.preventDefault();
              if (!uploadingImage && editorData?.project.canEdit) setImageDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                setImageDragActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setImageDragActive(false);
              if (uploadingImage || !editorData?.project.canEdit) return;
              const files = Array.from(event.dataTransfer.files);
              void uploadImages(files, imagePickerTargetPath ?? ['imageAssetId']).then((uploaded) => {
                if (uploaded) setImagePickerTargetPath(null);
              });
            }}
            style={{
              borderStyle: 'dashed',
              borderColor: imageDragActive ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-gray-4)',
              backgroundColor: imageDragActive ? 'var(--mantine-color-indigo-0)' : undefined,
              textAlign: 'center',
            }}
          >
            <Stack align="center" gap="xs">
              <Text size="sm" fw={500}>Arrastra una o varias imágenes aquí para subirlas</Text>
              <Text size="xs" c="dimmed">JPEG, PNG o WebP.</Text>
              <Button type="button" variant="light"
                leftSection={uploadingImage ? <Loader size="xs" /> : <Upload size={16} />}
                disabled={!editorData?.project.canEdit || uploadingImage}
                onClick={() => imagePickerFileInputRef.current?.click()}>
                {uploadingImage ? 'Subiendo imágenes…' : 'Elegir archivos'}
              </Button>
            </Stack>
          </Card>
          {uploadError && <Alert color="red" role="alert">{uploadError}</Alert>}
          {projectAssets.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {projectAssets.map((asset) => (
              <Card key={asset.id} withBorder padding="sm" radius="md">
                <Stack gap="xs">
                  <Text size="sm" fw={500} lineClamp={2} title={asset.filename}
                    style={{ height: 42, overflow: 'hidden' }}>
                    {asset.filename}
                  </Text>
                  <Button type="button" variant="subtle" color="gray" fullWidth
                    aria-label={`Seleccionar ${asset.filename}`} disabled={!editorData?.project.canEdit}
                    onClick={() => {
                      if (imagePickerTargetPath) updateNestedProperty(imagePickerTargetPath, asset.id);
                      setImagePickerTargetPath(null);
                    }}
                    style={{ display: 'block', height: 'auto', padding: 0, whiteSpace: 'normal' }}>
                    {/* This image is served through the app's private asset route, so keep its URL unoptimized. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/assets/${encodeURIComponent(asset.id)}`} alt="" loading="lazy"
                      style={{ display: 'block', width: '100%', height: 128, objectFit: 'cover', borderRadius: 6 }} />
                  </Button>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <Button type="button" variant="subtle" size="xs"
                      aria-label={`Renombrar ${asset.filename}`} title={`Renombrar ${asset.filename}`}
                      disabled={!editorData?.project.canEdit || renamingAssetId !== null || deletingAssetId !== null || uploadingImage}
                      onClick={() => {
                        setRenameFilename(asset.filename);
                        setRenameError('');
                        setAssetPendingRename(asset);
                      }}>
                      <Pencil size={15} aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="subtle" color="red" size="xs"
                      aria-label={`Eliminar ${asset.filename}`} title={`Eliminar ${asset.filename}`}
                      disabled={!editorData?.project.canEdit || deletingAssetId !== null || renamingAssetId !== null || uploadingImage}
                      onClick={() => setAssetPendingDelete(asset)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </Stack>
              </Card>
            ))}
          </div>
        ) : (
          <Text size="sm" c="dimmed">No hay imágenes subidas al proyecto.</Text>
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
          <Text>¿Seguro que quieres eliminar {blockPendingDelete?.label}? Puedes deshacerlo desde la vista previa.</Text>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setBlockPendingDelete(null)}>Cancelar</Button>
            <Button color="red" disabled={!editorData?.project.canEdit} onClick={() => {
              if (blockPendingDelete) deleteBlock(blockPendingDelete.pageId, blockPendingDelete.blockId);
              setBlockPendingDelete(null);
            }}>Eliminar sección</Button>
          </div>
        </Stack>
      </Modal>
      <Modal
        opened={assetPendingRename !== null}
        onClose={() => renamingAssetId === null && setAssetPendingRename(null)}
        title="Renombrar imagen"
        centered
        size="sm"
      >
        <form onSubmit={(event) => {
          event.preventDefault();
          if (assetPendingRename) void renameImage(assetPendingRename);
        }}>
          <Stack gap="md">
            <TextInput
              label="Nombre de la imagen"
              value={renameFilename}
              maxLength={255}
              autoFocus
              disabled={renamingAssetId !== null}
              error={renameError}
              onChange={(event) => setRenameFilename(event.currentTarget.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="default" disabled={renamingAssetId !== null} onClick={() => setAssetPendingRename(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={renamingAssetId !== null}
                disabled={!assetPendingRename || !editorData?.project.canEdit || !renameFilename.trim() || renameFilename === assetPendingRename.filename}
              >
                Guardar nombre
              </Button>
            </div>
          </Stack>
        </form>
      </Modal>
      <Modal opened={assetPendingDelete !== null} onClose={() => deletingAssetId === null && setAssetPendingDelete(null)} title="¿Eliminar imagen?" centered size="sm">
        <Stack gap="md">
          <Text>¿Eliminar “{assetPendingDelete?.filename}” del proyecto? Se quitará de todos los bloques del borrador. Esta acción no se puede deshacer.</Text>
          {uploadError && <Alert color="red" role="alert">{uploadError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="default" disabled={deletingAssetId !== null} onClick={() => setAssetPendingDelete(null)}>Cancelar</Button>
            <Button color="red" loading={deletingAssetId !== null} disabled={!assetPendingDelete || !editorData?.project.canEdit} onClick={async () => {
              if (assetPendingDelete && await deleteImage(assetPendingDelete)) setAssetPendingDelete(null);
            }}>Eliminar imagen</Button>
          </div>
        </Stack>
      </Modal>
    </main>
  );
}
