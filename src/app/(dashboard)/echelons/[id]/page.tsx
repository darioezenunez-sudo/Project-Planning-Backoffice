import { EchelonDetailContent } from '@/components/screens/echelons/echelon-detail-content';

export default async function EchelonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EchelonDetailContent echelonId={id} />;
}
