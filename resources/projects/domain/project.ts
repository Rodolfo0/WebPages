import { z } from 'zod';

const projectNameSchema = z.string().trim().min(1, 'Escribe un nombre para el proyecto.').max(
  120,
  'El nombre no puede superar 120 caracteres.',
).refine(
  (name) => !/[\u0000-\u001f\u007f-\u009f]/.test(name),
  'El nombre no puede contener caracteres de control.',
);
const projectSlugSchema = z.string().trim().max(160, 'El slug es demasiado largo.');

const createProjectSchema = z.strictObject({
  name: projectNameSchema,
  slug: projectSlugSchema.optional(),
});

const updateProjectSchema = z.strictObject({
  name: projectNameSchema,
  slug: projectSlugSchema,
});

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PROJECT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'login',
  'public',
  'register',
  's',
  'settings',
]);

export class ProjectInputError extends Error {
  readonly code = 'project_invalid';
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ProjectInputError';
  }
}

export function slugifyProjectName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeProjectSlug(value: string) {
  const slug = slugifyProjectName(value);
  if (!slug) {
    throw new ProjectInputError('El slug debe incluir al menos una letra o un número.');
  }
  if (slug.length > 63 || !PROJECT_SLUG_PATTERN.test(slug)) {
    throw new ProjectInputError('El slug debe tener hasta 63 caracteres y usar minúsculas, números y guiones.');
  }
  if (RESERVED_PROJECT_SLUGS.has(slug)) {
    throw new ProjectInputError('Ese slug está reservado. Elige otro.');
  }
  return slug;
}

function parseDetails(
  input: unknown,
  schema: typeof createProjectSchema | typeof updateProjectSchema,
  useNameAsSlug: boolean,
) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ProjectInputError(result.error.issues[0]?.message ?? 'Revisa los datos del proyecto.');
  }

  const name = result.data.name;
  const slugInput = 'slug' in result.data && result.data.slug
    ? result.data.slug
    : useNameAsSlug ? name : '';

  return { name, slug: normalizeProjectSlug(slugInput) };
}

export function parseCreateProjectInput(input: unknown) {
  return parseDetails(input, createProjectSchema, true);
}

export function parseUpdateProjectInput(input: unknown) {
  return parseDetails(input, updateProjectSchema, false);
}

