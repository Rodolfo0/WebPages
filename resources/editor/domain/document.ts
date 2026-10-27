import { portfolioBlockRegistry, requireBlock, toBlockSchemaRegistry } from '../../blocks';
import { createSiteDocumentSchema } from '../../site-document';
import type { SiteDocument } from '../../site-document';

const editorDocumentSchema = createSiteDocumentSchema(toBlockSchemaRegistry(portfolioBlockRegistry));

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
