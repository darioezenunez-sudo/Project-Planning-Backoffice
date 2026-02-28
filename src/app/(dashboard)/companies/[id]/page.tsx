import { CompanyDetailContent } from '@/components/screens/companies/company-detail-content';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDetailContent companyId={id} />;
}
