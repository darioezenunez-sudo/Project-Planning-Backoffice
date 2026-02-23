export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Company {id}</div>;
}
