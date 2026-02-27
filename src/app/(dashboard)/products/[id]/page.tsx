import { ProductDetailContent } from '@/components/screens/products/product-detail-content';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailContent productId={id} />;
}
