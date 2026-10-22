'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { slugifyProjectName } from '../domain/project';

type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  hasDraft: boolean;
  hasPublished: boolean;
  canEdit: boolean;
  canDelete: boolean;
  updatedAt: string;
};

type ApiResult = {
  projects?: ProjectSummary[];
  projectId?: string;
  error?: string;
  message?: string;
};

type FormMode = 'create' | 'edit';

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

export default function ProjectsDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpened, setFormOpened] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [slugIsAutomatic, setSlugIsAutomatic] = useState(true);
  const [formError, setFormError] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const loadProjects = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      const result = await response.json() as ApiResult;
      if (!response.ok) {
        if (response.status === 401) {
          setLoadError('Inicia sesión para consultar tus proyectos.');
        } else {
          setLoadError(result.message ?? 'No se pudieron cargar tus proyectos.');
        }
        return;
      }
      setLoadError('');
      setProjects(result.projects ?? []);
    } catch {
      setLoadError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/projects', { cache: 'no-store' })
      .then(async (response) => ({ response, result: await response.json() as ApiResult }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) {
          setLoadError(response.status === 401
            ? 'Inicia sesión para consultar tus proyectos.'
            : result.message ?? 'No se pudieron cargar tus proyectos.');
          return;
        }
        setProjects(result.projects ?? []);
      })
      .catch(() => {
        if (active) setLoadError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  function openCreateForm() {
    setFormMode('create');
    setEditingProject(null);
    setFormName('');
    setFormSlug('');
    setSlugIsAutomatic(true);
    setFormError('');
    setFormOpened(true);
  }

  function openEditForm(project: ProjectSummary) {
    setFormMode('edit');
    setEditingProject(project);
    setFormName(project.name);
    setFormSlug(project.slug);
    setSlugIsAutomatic(false);
    setFormError('');
    setFormOpened(true);
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formBusy) return;

    setFormBusy(true);
    setFormError('');
    try {
      const editedProjectId = formMode === 'edit' ? editingProject?.id : undefined;
      const isEditing = Boolean(editedProjectId);
      const response = await fetch(
        editedProjectId ? `/api/projects/${encodeURIComponent(editedProjectId)}` : '/api/projects',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, slug: formSlug }),
        },
      );
      const result = await response.json() as ApiResult;
      if (!response.ok) {
        setFormError(result.message ?? 'No se pudo guardar el proyecto.');
        return;
      }

      setFormOpened(false);
      setEditingProject(null);
      await loadProjects(false);
    } catch {
      setFormError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmDeleteProject() {
    if (!projectToDelete || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectToDelete.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json() as ApiResult;
      if (!response.ok) {
        setDeleteError(result.message ?? 'No se pudo eliminar el proyecto.');
        return;
      }

      setProjectToDelete(null);
      await loadProjects(false);
    } catch {
      setDeleteError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function signOut() {
    setSignOutBusy(true);
    setLoadError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        const result = await response.json() as ApiResult;
        setLoadError(result.message ?? 'No se pudo cerrar la sesión.');
        return;
      }
      router.push('/');
    } catch {
      setLoadError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Text size="sm" fw={700} c="indigo" tt="uppercase">Tu espacio</Text>
            <Title order={1} mt={6}>Proyectos</Title>
            <Text c="dimmed" mt={8} maw={640}>
              Administra tus portafolios, borradores y versiones publicadas.
            </Text>
          </div>
          {loadError.includes('Inicia sesión') ? (
            <Button component="a" href="/">Iniciar sesión</Button>
          ) : (
            <Group>
              <Button variant="default" onClick={signOut} loading={signOutBusy}>
                Cerrar sesión
              </Button>
              <Button onClick={openCreateForm}>Crear proyecto</Button>
            </Group>
          )}
        </header>

        {loadError && (
          <Alert color="red" title="No se pudo completar la solicitud" role="alert">
            {loadError}
          </Alert>
        )}

        {loading ? (
          <div className="grid min-h-56 place-items-center" aria-label="Cargando proyectos">
            <Loader />
          </div>
        ) : loadError.includes('Inicia sesión') ? null : projects.length === 0 ? (
          <Card withBorder radius="lg" padding="xl" className="text-center">
            <Stack align="center" gap="sm">
              <Title order={2}>Empieza con tu portafolio</Title>
              <Text c="dimmed" maw={500}>
                Crea un proyecto desde la plantilla de portafolio. Tendrá un borrador inicial listo para continuar en el editor.
              </Text>
              <Button mt="sm" onClick={openCreateForm}>Crear mi primer proyecto</Button>
            </Stack>
          </Card>
        ) : (
          <section aria-label="Tus proyectos" className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id} withBorder radius="lg" padding="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div className="min-w-0">
                      <Title order={3} lineClamp={2}>{project.name}</Title>
                      <Text size="sm" c="dimmed" mt={4}>
                        <span className="font-mono">/s/{project.slug}</span>
                      </Text>
                    </div>
                    <Badge variant="light" color={project.status === 'archived' ? 'gray' : project.status === 'published' ? 'green' : 'indigo'}>
                      {project.status === 'archived' ? 'Archivado' : project.status === 'published' ? 'Activo' : 'En preparación'}
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Badge variant={project.hasDraft ? 'light' : 'default'} color={project.hasDraft ? 'indigo' : 'gray'}>
                      {project.hasDraft ? 'Borrador disponible' : 'Sin borrador'}
                    </Badge>
                    <Badge variant={project.hasPublished ? 'light' : 'default'} color={project.hasPublished ? 'green' : 'gray'}>
                      {project.hasPublished ? 'Versión publicada' : 'Sin publicar'}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed">Actualizado {formatUpdatedAt(project.updatedAt)}</Text>

                  <Group justify="space-between" mt="xs">
                    <Group gap="xs">
                      {project.canEdit && (
                        <Button variant="default" onClick={() => openEditForm(project)}>
                          Editar
                        </Button>
                      )}
                      {project.canDelete && (
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setProjectToDelete(project);
                            setDeleteError('');
                          }}
                        >
                          Eliminar
                        </Button>
                      )}
                    </Group>
                    {project.hasPublished && (
                      <Anchor href={`/s/${encodeURIComponent(project.slug)}`} target="_blank" rel="noreferrer">
                        Ver sitio
                      </Anchor>
                    )}
                  </Group>
                </Stack>
              </Card>
            ))}
          </section>
        )}
      </div>

      <Modal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        title={formMode === 'create' ? 'Crear proyecto' : 'Editar proyecto'}
        centered
      >
        <form onSubmit={submitProject}>
          <Stack>
            {formError && <Alert color="red" role="alert">{formError}</Alert>}
            <TextInput
              label="Nombre del proyecto"
              value={formName}
              onChange={(event) => {
                const nextName = event.currentTarget.value;
                setFormName(nextName);
                if (slugIsAutomatic) setFormSlug(slugifyProjectName(nextName));
              }}
              maxLength={120}
              required
              autoFocus
            />
            <TextInput
              label="Slug"
              description="Se usa en la dirección pública del proyecto."
              value={formSlug}
              onChange={(event) => {
                setSlugIsAutomatic(false);
                setFormSlug(event.currentTarget.value);
              }}
              maxLength={160}
              required
            />
            <Text size="sm" c="dimmed">
              Dirección: /s/{slugifyProjectName(formSlug) || 'tu-proyecto'}
            </Text>
            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="default" onClick={() => setFormOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={formBusy}>
                {formMode === 'create' ? 'Crear proyecto' : 'Guardar cambios'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        title="Eliminar proyecto"
        centered
      >
        <Stack>
          {deleteError && <Alert color="red" role="alert">{deleteError}</Alert>}
          <Text>
            ¿Eliminar <strong>{projectToDelete?.name}</strong>? Se eliminarán su borrador y su versión publicada.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setProjectToDelete(null)}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmDeleteProject} loading={deleteBusy}>
              Eliminar proyecto
            </Button>
          </Group>
        </Stack>
      </Modal>
    </main>
  );
}

