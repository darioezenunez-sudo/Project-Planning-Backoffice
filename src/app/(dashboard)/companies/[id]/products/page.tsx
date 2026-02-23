export default async function CompanyProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Products of company {id}</div>;
}
