export default async function ProductEchelonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Echelons of product {id}</div>;
}
