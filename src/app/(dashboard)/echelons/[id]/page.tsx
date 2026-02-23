export default async function EchelonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Echelon {id}</div>;
}
