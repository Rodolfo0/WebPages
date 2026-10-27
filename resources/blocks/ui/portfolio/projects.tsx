import { z } from 'zod';
import { defineBlock } from '../../domain/block-definition';
import {
  altTextSchema,
  blockAlignmentSchema,
  blockSpacingSchema,
  hiddenSchema,
  anchorSchema,
  optionalAccentColorSchema,
  optionalAssetIdSchema,
  optionalBlockUrlSchema,
  shortTextSchema,
} from '../../domain/shared-props';
import { BlockMedia } from '../block-parts';
import { BlockSection } from '../block-renderer';
import styles from '../portfolio-blocks.module.css';

/**
 * Featured projects as a grid of cards.
 *
 * This is the block that references images most heavily, so its `assetIdsFromProps` selector is
 * what makes project thumbnails visible on a published page. The selector reads only validated
 * props, so a thumbnail mentioned in the description does not become publicly readable.
 */
const projectEntrySchema = z.strictObject({
  title: shortTextSchema(80, 'El proyecto'),
  summary: z.string().trim().max(300, 'El resumen no puede superar 300 caracteres.'),
  imageAssetId: optionalAssetIdSchema,
  imageAlt: altTextSchema.default(''),
  url: optionalBlockUrlSchema,
  linkLabel: shortTextSchema(40, 'El texto del enlace'),
});

const MAX_PROJECT_ENTRIES = 9;

export const projectsPropsSchema = z.strictObject({
  heading: shortTextSchema(60, 'El título'),
  entries: z
    .array(projectEntrySchema)
    .max(MAX_PROJECT_ENTRIES, `Puedes añadir hasta ${MAX_PROJECT_ENTRIES} proyectos.`),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  align: blockAlignmentSchema.default('left'),
  spacing: blockSpacingSchema.default('comfortable'),
  accentColor: optionalAccentColorSchema,
  hidden: hiddenSchema,
  anchor: anchorSchema,
});

export type ProjectsProps = z.output<typeof projectsPropsSchema>;

export const projectsBlock = defineBlock<ProjectsProps>({
  type: 'projects',
  label: 'Proyectos',
  description: 'Proyectos destacados con imagen opcional y enlace.',
  propsSchema: projectsPropsSchema,
  defaultProps: projectsPropsSchema.parse({
    heading: 'Proyectos destacados',
    entries: [
      {
        title: 'Atlas de rutas',
        summary: 'Una guía interactiva para planificar recorridos de larga distancia.',
        linkLabel: 'Ver proyecto',
        url: 'https://example.com/proyectos/atlas',
      },
      {
        title: 'Panel de métricas',
        summary: 'Un tablero que traduce datos operativos en decisiones diarias.',
        linkLabel: 'Ver proyecto',
        url: 'https://example.com/proyectos/metricas',
      },
      {
        title: 'Biblioteca de componentes',
        summary: 'Sesenta componentes accesibles documentados y probados.',
        linkLabel: 'Ver proyecto',
        url: 'https://example.com/proyectos/componentes',
      },
    ],
    columns: 3,
    align: 'left',
    spacing: 'comfortable',
  }),
  assetIdsFromProps: (props) =>
    props.entries.flatMap((entry) => (entry.imageAssetId ? [entry.imageAssetId] : [])),
  reactComponent: ({ props, blockId, theme }) => (
    <BlockSection
      align={props.align}
      theme={props.accentColor ? { ...theme, colors: { ...theme.colors, accent: props.accentColor } } : theme}
      anchor={props.anchor}
      headingId={`${blockId}-heading`}
      heading={props.heading}
      headingLevel={2}
      hidden={props.hidden}
    >
      <ul className={styles.projectGrid} data-columns={props.columns}>
        {props.entries.map((entry, index) => (
          <li key={`${entry.title}-${index}`} className={styles.projectCard}>
            <BlockMedia
              assetId={entry.imageAssetId}
              alt={entry.imageAlt}
              className={styles.projectImage}
            />
            <h3 className={styles.entryTitle}>{entry.title}</h3>
            <p className={styles.entryDescription}>{entry.summary}</p>
            {entry.url ? (
              <a className={styles.actionLink} href={entry.url}>{entry.linkLabel}</a>
            ) : null}
          </li>
        ))}
      </ul>
    </BlockSection>
  ),
});
