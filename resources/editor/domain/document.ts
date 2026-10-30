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
