import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  blockAlignmentSchema,
  blockSetupSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockTagList } from '../block-parts';
import { BlockSection } from '../block-renderer';

/**
 * Skills as a short, flat list of labels.
 *
 * The block deliberately has no levels or percentages: those would imply measurements the product
 * does not collect. Ordering is the only expression of emphasis.
 */
const skillSchema = shortTextSchema(40, 'La habilidad');

const MAX_SKILLS = 24;

export const skillsPropsSchema = z.strictObject({
  setup: blockSetupSchema.default('default'),
  heading: shortTextSchema(60, 'El título'),
  items: z.array(skillSchema).max(MAX_SKILLS, `Puedes añadir hasta ${MAX_SKILLS} habilidades.`),
  align: blockAlignmentSchema.default('left'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type SkillsProps = z.output<typeof skillsPropsSchema>;

export const skillsBlock = defineBlock<SkillsProps>({
  type: 'skills',
  label: 'Habilidades',
  description: 'Una lista breve de herramientas y capacidades.',
  propsSchema: skillsPropsSchema,
  defaultProps: skillsPropsSchema.parse({
    setup: 'default',
    heading: 'Habilidades',
    items: [
      'Diseño de interfaces',
      'Sistemas de diseño',
      'Accesibilidad',
      'Investigación con usuarios',
      'Prototipado',
      'HTML y CSS',
      'React',
      'Documentación',
    ],
    align: 'left',
    spacing: 'comfortable',
  }),
  // A flat list of labels never references an image.
  assetIdsFromProps: () => [],
  reactComponent: ({ props, blockId, theme }) => (
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
      <BlockTagList items={props.items} />
    </BlockSection>
  ),
});
