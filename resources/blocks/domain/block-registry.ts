import type { AnyBlockDefinition } from './block-definition';

/** Error thrown when a block type is not present in the registry. */
export class UnknownBlockTypeError extends Error {
  readonly code = 'unknown_block_type';
  readonly blockType: string;

  constructor(blockType: string) {
    super(`El tipo de bloque "${blockType}" no está registrado.`);
    this.name = 'UnknownBlockTypeError';
    this.blockType = blockType;
  }
}

export type BlockRegistry = ReadonlyMap<string, AnyBlockDefinition>;

/**
 * Builds the registry and rejects duplicate types so a silent override cannot hide a block.
 *
 * The registry is keyed by `type`, which is the same value persisted in the document, so lookup at
 * render time never needs a second index.
 */
export function createBlockRegistry(
  definitions: readonly AnyBlockDefinition[],
): BlockRegistry {
  const registry = new Map<string, AnyBlockDefinition>();

  for (const definition of definitions) {
    if (registry.has(definition.type)) {
      throw new TypeError(`El tipo de bloque "${definition.type}" está registrado dos veces.`);
    }
    registry.set(definition.type, definition);
  }

  return registry;
}

/**
 * Resolves a block type or throws, so callers never render `undefined`.
 *
 * A document that passed `createSiteDocumentSchema` can only reference registered types; this guard
 * covers registries that changed after a document was validated.
 */
export function requireBlock(registry: BlockRegistry, blockType: string): AnyBlockDefinition {
  const definition = registry.get(blockType);

  if (!definition) {
    throw new UnknownBlockTypeError(blockType);
  }

  return definition;
}

/** Same lookup without throwing, for callers that need to branch on an unknown type. */
export function findBlock(
  registry: BlockRegistry,
  blockType: string,
): AnyBlockDefinition | undefined {
  return registry.get(blockType);
}

/** Projects the registry into the validation-only shape `createSiteDocumentSchema` expects. */
export function toBlockSchemaRegistry(registry: BlockRegistry) {
  return Object.fromEntries(
    [...registry].map(([type, definition]) => [
      type,
      {
        propsSchema: definition.propsSchema,
        defaultProps: definition.defaultProps,
        assetIdsFromProps: definition.assetIdsFromProps,
      },
    ]),
  );
}

