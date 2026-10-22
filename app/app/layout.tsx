import '@mantine/core/styles.css';
import ProjectsAppProvider from '@/resources/projects/ui/app-provider';

export default function PrivateAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProjectsAppProvider>{children}</ProjectsAppProvider>;
}

