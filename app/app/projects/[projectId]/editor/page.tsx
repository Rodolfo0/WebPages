import ProjectEditor from '@/resources/editor/ui/project-editor';

type ProjectEditorPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectEditorPage({ params }: ProjectEditorPageProps) {
  const { projectId } = await params;
  return <ProjectEditor projectId={projectId} />;
}
