import { ConsolidationReviewContent } from '@/components/screens/echelons/consolidation-review-content';

export default async function ConsolidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsolidationReviewContent echelonId={id} />;
}
