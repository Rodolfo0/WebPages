import { portfolioBlockRegistry, requireBlock, toBlockSchemaRegistry } from '../../blocks';
import { createSiteDocumentSchema } from '../../site-document';
import type { BlockProps, SiteDocument } from '../../site-document';

const editorDocumentSchema = createSiteDocumentSchema(toBlockSchemaRegistry(portfolioBlockRegistry));

export class BlockPropsValidationError extends Error {
  readonly code = 'block_props_invalid';
  readonly issues: readonly { path: readonly (string | number)[]; message: string }[];

  constructor(message: string, issues: readonly { path: readonly (string | number)[]; message: string }[] = []) {
    super(message);
    this.name = 'BlockPropsValidationError';
    this.issues = issues;
  }
}

/**
 * Updates one block's allowed props without mutating the current document.
 *
 * The block patch is validated by the block's own schema before the complete
 * SiteDocument is parsed again. This keeps unknown props and invalid URLs,
 * limits, enums and nested values out of the editor state.
 */
export function updateBlockProps(
  document: SiteDocument,
  pageId: string,
  blockId: string,
  patch: BlockProps,
) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error('No se encontró la página seleccionada.');

  const block = page.blocks.find((candidate) => candidate.id === blockId);
  if (!block) throw new Error('No se encontró la sección seleccionada.');

  const definition = requireBlock(portfolioBlockRegistry, block.type);
  const parsedProps = definition.propsSchema.safeParse({ ...definition.defaultProps, ...block.props, ...patch });

  if (!parsedProps.success) {
    const issues = parsedProps.error.issues.map((issue) => ({
      path: issue.path.filter((segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number'),
      message: issue.message,
    }));
    throw new BlockPropsValidationError(
      issues[0]?.message ?? 'Revisa las propiedades de la sección.',
      issues,
    );
  }

  const nextDocument = {
    ...document,
    pages: document.pages.map((candidate) => (
      candidate.id === pageId
        ? {
            ...candidate,
            blocks: candidate.blocks.map((candidateBlock) => (
              candidateBlock.id === blockId
                ? { ...candidateBlock, props: parsedProps.data as BlockProps }
                : candidateBlock
            )),
          }
        : candidate
    )),
  };

  return editorDocumentSchema.parse(nextDocument);
}

/** Adds a block with its registered defaults and validates the resulting document. */
export function addBlockToDocument(
  document: SiteDocument,
  pageId: string,
  blockType: string,
) {
  const definition = requireBlock(portfolioBlockRegistry, blockType);
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error('No se encontró la página donde agregar la sección.');

  const blockId = crypto.randomUUID();
  const newBlock = {
    id: blockId,
    type: definition.type,
    props: structuredClone(definition.defaultProps),
  };
  const blocks = [...page.blocks];
  blocks.push(newBlock);

  const nextDocument = {
    ...document,
    pages: document.pages.map((candidate) => (
      candidate.id === pageId ? { ...candidate, blocks } : candidate
    )),
  };

  return {
    document: editorDocumentSchema.parse(nextDocument),
    blockId,
  };
}

/** Reorders one block within its page and validates the resulting document. */
export function moveBlockInDocument(document: SiteDocument, pageId: string, blockId: string, targetIndex: number) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error('No se encontrÃ³ la pÃ¡gina seleccionada.');
  const sourceIndex = page.blocks.findIndex((block) => block.id === blockId);
  if (sourceIndex < 0) throw new Error('No se encontrÃ³ la secciÃ³n seleccionada.');
  const blocks = [...page.blocks];
  const [block] = blocks.splice(sourceIndex, 1);
  blocks.splice(Math.max(0, Math.min(targetIndex, blocks.length)), 0, block);
  return editorDocumentSchema.parse({
    ...document,
    pages: document.pages.map((candidate) => candidate.id === pageId ? { ...candidate, blocks } : candidate),
  });
}

/** Clones a block with a fresh id and places it immediately after the source. */
export function duplicateBlockInDocument(document: SiteDocument, pageId: string, blockId: string) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error('No se encontrÃ³ la pÃ¡gina seleccionada.');
  const sourceIndex = page.blocks.findIndex((block) => block.id === blockId);
  if (sourceIndex < 0) throw new Error('No se encontrÃ³ la secciÃ³n seleccionada.');
  const duplicate = { ...structuredClone(page.blocks[sourceIndex]), id: crypto.randomUUID() };
  const blocks = [...page.blocks];
  blocks.splice(sourceIndex + 1, 0, duplicate);
  const nextDocument = editorDocumentSchema.parse({
    ...document,
    pages: document.pages.map((candidate) => candidate.id === pageId ? { ...candidate, blocks } : candidate),
  });
  return { document: nextDocument, blockId: duplicate.id };
}

/** Removes a block and validates the resulting document. */
export function deleteBlockFromDocument(document: SiteDocument, pageId: string, blockId: string) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error('No se encontrÃ³ la pÃ¡gina seleccionada.');
  if (!page.blocks.some((block) => block.id === blockId)) throw new Error('No se encontrÃ³ la secciÃ³n seleccionada.');
  return editorDocumentSchema.parse({
    ...document,
    pages: document.pages.map((candidate) => candidate.id === pageId
      ? { ...candidate, blocks: candidate.blocks.filter((block) => block.id !== blockId) }
      : candidate),
  });
}
