export default async function EchelonSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Sessions of echelon {id}</div>;
}
