import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">New product</h1>
      <ProductForm initial={{}} />
    </div>
  );
}
