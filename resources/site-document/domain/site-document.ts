import { z } from 'zod';

const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const SITE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_PATH_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/;
const BLOCK_TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;
const ID_MAX_LENGTH = 128;

const DEFAULT_THEME_VALUES = {
  colors: {
    background: '#ffffff',
    text: '#1f2937',
    accent: '#2563eb',
  },
  typography: {
    heading: 'sans',
    body: 'sans',
  },
  spacing: 'comfortable',
} as const;

const hexColorSchema = z.string().regex(HEX_COLOR_PATTERN, {
  message: 'Use un color hexadecimal de 3 o 6 dígitos.',
});

const themeTokensSchema = z
  .strictObject({
    colors: z
      .strictObject({
        background: hexColorSchema.default(DEFAULT_THEME_VALUES.colors.background),
        text: hexColorSchema.default(DEFAULT_THEME_VALUES.colors.text),
        accent: hexColorSchema.default(DEFAULT_THEME_VALUES.colors.accent),
      })
      .default(DEFAULT_THEME_VALUES.colors),
    typography: z
      .strictObject({
        heading: z.enum(['sans', 'serif', 'mono']).default(DEFAULT_THEME_VALUES.typography.heading),
        body: z.enum(['sans', 'serif', 'mono']).default(DEFAULT_THEME_VALUES.typography.body),
      })
      .default(DEFAULT_THEME_VALUES.typography),
    spacing: z.enum(['compact', 'comfortable', 'spacious']).default(DEFAULT_THEME_VALUES.spacing),
  })
  .default(DEFAULT_THEME_VALUES);

export type ThemeTokens = z.output<typeof themeTokensSchema>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = DEFAULT_THEME_VALUES;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonObjectSchema = z
  .custom<Record<string, JsonValue>>(isJsonObject, {
    message: 'El valor debe ser un objeto JSON.',
  })
  .transform((value) => z.record(z.string(), jsonValueSchema).parse(value))
  .default({});
const idSchema = z.string().trim().min(1).max(ID_MAX_LENGTH);

const siteSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  slug: z.string().regex(SITE_SLUG_PATTERN, {
    message: 'El slug debe usar minúsculas, números y guiones entre palabras.',
  }),
  description: z.string().trim().max(160).optional(),
  theme: themeTokensSchema,
});

const documentShape = {
  version: z.literal(1),
  site: siteSchema,
};

export type BlockSchemaDefinition = {
  propsSchema: z.ZodType;
  defaultProps: Record<string, JsonValue>;
};

export type BlockSchemaRegistry = Readonly<Record<string, BlockSchemaDefinition>>;

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    return (
      (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every(isJsonValue)
    );
  }

  return false;
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && isJsonValue(value);
}

function prepareBlockRegistry(registry: BlockSchemaRegistry) {
  const prepared = new Map<string, BlockSchemaDefinition>();

  for (const [type, definition] of Object.entries(registry)) {
    if (!BLOCK_TYPE_PATTERN.test(type)) {
      throw new TypeError(`El tipo de bloque "${type}" no tiene un nombre válido.`);
    }

    if (!isJsonObject(definition.defaultProps)) {
      throw new TypeError(`Los valores iniciales del bloque "${type}" deben ser un objeto JSON.`);
    }

    const parsedDefaults = definition.propsSchema.safeParse(definition.defaultProps);

    if (!parsedDefaults.success || !isJsonObject(parsedDefaults.data)) {
      throw new TypeError(`Los valores iniciales del bloque "${type}" no cumplen su schema.`);
    }

    const unknownProperty = '__site_document_unknown_property__';
    if (Object.hasOwn(definition.defaultProps, unknownProperty)) {
      throw new TypeError(`El bloque "${type}" usa una propiedad reservada.`);
    }

    const strictnessProbe = definition.propsSchema.safeParse({
      ...definition.defaultProps,
      [unknownProperty]: null,
    });

    if (strictnessProbe.success) {
      throw new TypeError(`El schema de props del bloque "${type}" debe rechazar propiedades desconocidas.`);
    }

    prepared.set(type, {
      propsSchema: definition.propsSchema,
      defaultProps: parsedDefaults.data,
    });
  }

  return prepared;
}

export function createSiteDocumentSchema(registry: BlockSchemaRegistry) {
  const preparedRegistry = prepareBlockRegistry(registry);

  const blockSchema = z
    .strictObject({
      id: idSchema,
      type: z.string().regex(BLOCK_TYPE_PATTERN),
      props: jsonObjectSchema,
    })
    .transform((block, context) => {
      const definition = preparedRegistry.get(block.type);

      if (!definition) {
        context.addIssue({
          code: 'custom',
          path: ['type'],
          message: `El tipo de bloque "${block.type}" no está registrado.`,
        });
        return z.NEVER;
      }

      const parsedProps = definition.propsSchema.safeParse({
        ...definition.defaultProps,
        ...block.props,
      });

      if (!parsedProps.success) {
        for (const issue of parsedProps.error.issues) {
          context.addIssue({
            code: 'custom',
            path: ['props', ...issue.path],
            message: issue.message,
          });
        }
        return z.NEVER;
      }

      if (!isJsonObject(parsedProps.data)) {
        context.addIssue({
          code: 'custom',
          path: ['props'],
          message: 'Las props del bloque deben producir un objeto JSON.',
        });
        return z.NEVER;
      }

      return { ...block, props: parsedProps.data };
    });

  const pageWithBlocksSchema = z.strictObject({
    id: idSchema,
    path: z.string().max(200).regex(PAGE_PATH_PATTERN, {
      message: 'La ruta debe comenzar con / y usar segmentos en minúsculas separados por guiones.',
    }),
    blocks: z.array(blockSchema).default([]),
  });

  return z
    .strictObject({
      ...documentShape,
      pages: z.array(pageWithBlocksSchema).min(1),
    })
    .superRefine((document, context) => {
      const pageIds = new Set<string>();
      const pagePaths = new Set<string>();

      document.pages.forEach((page, pageIndex) => {
        if (pageIds.has(page.id)) {
          context.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'id'],
            message: 'Cada página debe tener un id único dentro del documento.',
          });
        }
        pageIds.add(page.id);

        if (pagePaths.has(page.path)) {
          context.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'path'],
            message: 'Cada página debe tener una ruta única dentro del documento.',
          });
        }
        pagePaths.add(page.path);

        const blockIds = new Set<string>();
        page.blocks.forEach((block, blockIndex) => {
          if (blockIds.has(block.id)) {
            context.addIssue({
              code: 'custom',
              path: ['pages', pageIndex, 'blocks', blockIndex, 'id'],
              message: 'Cada bloque debe tener un id único dentro de su página.',
            });
          }
          blockIds.add(block.id);
        });
      });
    });
}

export type SiteDocumentSchema = ReturnType<typeof createSiteDocumentSchema>;
export type SiteDocument = z.output<SiteDocumentSchema>;
export type SiteDocumentInput = z.input<SiteDocumentSchema>;
