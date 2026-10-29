import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  blockAlignmentSchema,
  blockSetupSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  optionalBlockUrlSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockActions, BlockEntries, type BlockEntry } from '../block-parts';
import { BlockSection } from '../block-renderer';

/**
 * Work history as an ordered list of entries.
 *
 * Each entry reuses the same limited vocabulary: a title, an optional organization, a period and a
 * description. Lists are capped so a single block cannot grow into an arbitrary data store.
 */
const experienceEntrySchema = z.strictObject({
  title: shortTextSchema(80, 'El puesto'),
  organization: shortTextSchema(80, 'La empresa'),
  period: shortTextSchema(40, 'El periodo'),
  description: z.string().trim().max(400, 'La descripción no puede superar 400 caracteres.'),
  url: optionalBlockUrlSchema,
});

const MAX_EXPERIENCE_ENTRIES = 12;

export const experiencePropsSchema = z.strictObject({
  setup: blockSetupSchema.default('default'),
  heading: shortTextSchema(60, 'El título'),
  entries: z
    .array(experienceEntrySchema)
    .max(MAX_EXPERIENCE_ENTRIES, `Puedes añadir hasta ${MAX_EXPERIENCE_ENTRIES} puestos.`),
  align: blockAlignmentSchema.default('left'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type ExperienceProps = z.output<typeof experiencePropsSchema>;
type ExperienceEntry = z.output<typeof experienceEntrySchema>;

function toEntry(entry: ExperienceEntry): BlockEntry {
  return {
    title: entry.title,
    subtitle: entry.organization,
    period: entry.period,
    description: entry.description,
  };
}

export const experienceBlock = defineBlock<ExperienceProps>({
  type: 'experience',
  label: 'Experiencia',
  description: 'Puestos y etapas profesionales en orden cronológico.',
  propsSchema: experiencePropsSchema,
  defaultProps: experiencePropsSchema.parse({
    setup: 'default',
    heading: 'Experiencia',
    entries: [
      {
        title: 'Diseñador de producto senior',
        organization: 'Estudio Horizonte',
        period: '2022 — actualidad',
        description:
          'Lidero el sistema de diseño de una plataforma usada por 40.000 personas cada mes.',
      },
      {
        title: 'Diseñador de producto',
        organization: 'Nexo Labs',
        period: '2019 — 2022',
        description: 'Investigación, prototipado y entrega de interfaces para un producto B2B.',
      },
      {
        title: 'Diseñador de interfaces',
        organization: 'Freelance',
        period: '2017 — 2019',
        description: 'Sitios y aplicaciones para estudios pequeños y profesionales independientes.',
      },
    ],
    align: 'left',
    spacing: 'comfortable',
  }),
  // Experience entries may link to an employer, but they hold no images today.
  assetIdsFromProps: () => [],
  reactComponent: ({ props, blockId, theme }) => {
    const linkedEntries = props.entries.filter((entry) => entry.url);

    return (
      <BlockSection
        align={props.align}
        spacing={props.spacing}
        theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
        anchor={props.anchor}
        headingId={`${blockId}-heading`}
        heading={props.heading}
        headingLevel={2}
        hidden={props.hidden}
        data-setup={props.setup}
      >
        <BlockEntries entries={props.entries.map(toEntry)} />
        <BlockActions
          items={linkedEntries.map((entry) => ({
            label: entry.title,
            url: entry.url,
            style: 'text',
          }))}
        />
      </BlockSection>
    );
  },
});
