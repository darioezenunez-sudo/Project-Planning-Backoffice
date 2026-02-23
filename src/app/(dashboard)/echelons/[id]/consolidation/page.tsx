export default async function ConsolidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Consolidation for echelon {id}</div>;
}
