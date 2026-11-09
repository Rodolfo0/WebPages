'use client';

import {
  Alert,
  Anchor,
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ArrowUpRight, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { slugifyProjectName } from '../domain/project';
import styles from './projects-dashboard.module.css';

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

  function openEditor(project: ProjectSummary) {
    router.push(`/app/projects/${encodeURIComponent(project.id)}/editor`);
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
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <Text className={styles.eyebrow}>Tu espacio</Text>
            <Title order={1} className={styles.title}>Proyectos</Title>
            <Text className={styles.description}>
              Administra tus portafolios, borradores y versiones publicadas.
            </Text>
          </div>
          {loadError.includes('Inicia sesión') ? (
            <div className={styles.headerActions}>
              <Button component="a" href="/">Iniciar sesión</Button>
            </div>
          ) : (
            <div className={styles.headerActions}>
              <Button variant="default" onClick={signOut} loading={signOutBusy}>
                Cerrar sesión
              </Button>
              <Button onClick={openCreateForm}>Crear proyecto</Button>
            </div>
          )}
        </header>

        {loadError && (
          <Alert color="red" title="No se pudo completar la solicitud" role="alert">
            {loadError}
          </Alert>
        )}

        {loading ? (
          <div className={styles.loadingState} aria-label="Cargando proyectos">
            <Loader />
          </div>
        ) : loadError.includes('Inicia sesión') ? null : projects.length === 0 ? (
          <Card withBorder radius="lg" padding="xl" className={styles.emptyCard}>
            <div className={styles.emptyContent}>
              <div className={styles.emptyIcon} aria-hidden="true">
                <FolderPlus size={25} strokeWidth={1.7} />
              </div>
              <Title order={2} className={styles.emptyTitle}>Empieza con tu portafolio</Title>
              <Text className={styles.emptyCopy}>
                Crea un proyecto desde la plantilla de portafolio. Tendrá un borrador inicial listo para continuar en el editor.
              </Text>
              <Button mt="sm" onClick={openCreateForm}>Crear mi primer proyecto</Button>
            </div>
          </Card>
        ) : (
          <section aria-label="Tus proyectos" className={styles.projectGrid}>
            {projects.map((project) => (
              <Card key={project.id} withBorder radius="lg" padding="lg" className={styles.projectCard}>
                <Stack gap="md" className={styles.cardStack}>
                  <div className={styles.cardTop}>
                    <div className={styles.projectIdentity}>
                      <div className={styles.projectMark} aria-hidden="true">
                        {project.name.trim().slice(0, 1).toUpperCase() || 'P'}
                      </div>
                      <div className="min-w-0">
                        <Text className={styles.projectName} lineClamp={2}>{project.name}</Text>
                        <span className={styles.slug}>/s/{project.slug}</span>
                      </div>
                    </div>
                    <Badge
                      className={styles.statusBadge}
                      variant="light"
                      color={project.status === 'archived' ? 'gray' : project.status === 'published' ? 'green' : 'indigo'}
                    >
                      {project.status === 'archived' ? 'Archivado' : project.status === 'published' ? 'Publicado' : 'En preparación'}
                    </Badge>
                  </div>

                  <div className={styles.statusLine} aria-label="Estado del contenido">
                    <Badge variant={project.hasDraft ? 'light' : 'default'} color={project.hasDraft ? 'indigo' : 'gray'}>
                      {project.hasDraft ? 'Borrador disponible' : 'Sin borrador'}
                    </Badge>
                    <Badge variant={project.hasPublished ? 'light' : 'default'} color={project.hasPublished ? 'green' : 'gray'}>
                      {project.hasPublished ? 'Sitio publicado' : 'Sin publicar'}
                    </Badge>
                  </div>

                  <div className={styles.cardFooter}>
                    <Text className={styles.updatedAt}>Actualizado {formatUpdatedAt(project.updatedAt)}</Text>
                    <div className={styles.cardActions}>
                      {project.hasDraft && (
                        <Button size="sm" className={styles.primaryAction} onClick={() => openEditor(project)}>
                          {project.canEdit ? 'Abrir editor' : 'Ver borrador'}
                        </Button>
                      )}
                      {project.hasPublished && (
                        <Anchor className={styles.viewSite} href={`/s/${encodeURIComponent(project.slug)}`} target="_blank" rel="noreferrer" aria-label={`Ver sitio de ${project.name}`}>
                          <span className="sr-only">Ver sitio</span>
                          <ArrowUpRight size={17} aria-hidden="true" />
                        </Anchor>
                      )}
                      {(project.canEdit || project.canDelete) && (
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label={`Acciones para ${project.name}`}>
                              <MoreHorizontal size={19} aria-hidden="true" />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {project.canEdit && (
                              <Menu.Item leftSection={<Pencil size={15} />} onClick={() => openEditForm(project)}>
                                Editar nombre y dirección
                              </Menu.Item>
                            )}
                            {project.canDelete && (
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={15} />}
                                onClick={() => {
                                  setProjectToDelete(project);
                                  setDeleteError('');
                                }}
                              >
                                Eliminar proyecto
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </div>
                  </div>
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
        radius="lg"
      >
        <form onSubmit={submitProject}>
          <Stack gap="md">
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
            <div className={styles.slugPreview}>
              <span className={styles.slugPreviewLabel}>Dirección pública</span>
              <code className={styles.slugPreviewValue}>/s/{slugifyProjectName(formSlug) || 'tu-proyecto'}</code>
            </div>
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
        radius="lg"
      >
        <Stack gap="md">
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

