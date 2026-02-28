import { SessionDetailContent } from '@/components/screens/sessions/session-detail-content';

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetailContent sessionId={id} />;
}
