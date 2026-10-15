import EmailLinkConfirmation, { type EmailLinkSearchParams } from '@/resources/auth/ui/email-link-confirmation';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Confirmar correo',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function EmailLinkPage({ searchParams }: { searchParams: EmailLinkSearchParams }) {
  return <EmailLinkConfirmation searchParams={searchParams} purpose='confirmation' />;
}
