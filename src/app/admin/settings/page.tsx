import { getTranslations } from 'next-intl/server';
import { EmailProviderForm } from '@/components/admin/EmailProviderForm';
import { PaymentSettingsForm } from '@/components/admin/PaymentSettingsForm';
import { ProductCopyForm } from '@/components/admin/ProductCopyForm';
import { ShippingZonesForm } from '@/components/admin/ShippingZonesForm';
import { PRODUCT_COPY_FIELDS, type ProductCopyField } from '@/domain/product-copy';
import { getEmailProvider } from '@/server/queries/app-settings';
import { getPaymentSettings } from '@/server/queries/payment-settings';
import { getProductCopy } from '@/server/queries/product-copy';
import { getShippingZones } from '@/server/queries/shipping';

export default async function AdminSettingsPage() {
  const t = await getTranslations('admin.settings');
  const ts = await getTranslations('admin.shipping');
  const tc = await getTranslations('admin.productCopy');
  const [settings, zones, emailProvider, productCopy, pdpEn, pdpTh] = await Promise.all([
    getPaymentSettings(),
    getShippingZones(),
    getEmailProvider(),
    getProductCopy(),
    getTranslations({ locale: 'en', namespace: 'pdp' }),
    getTranslations({ locale: 'th', namespace: 'pdp' }),
  ]);

  // Effective values to pre-fill: stored override, else the i18n default.
  const copyInitial = Object.fromEntries(
    PRODUCT_COPY_FIELDS.map((field) => [
      field,
      {
        th: productCopy[field]?.th ?? pdpTh(field),
        en: productCopy[field]?.en ?? pdpEn(field),
      },
    ]),
  ) as Record<ProductCopyField, { th: string; en: string }>;

  return (
    <div className="max-w-2xl space-y-12">
      <h1 className="font-serif text-3xl text-ink">{t('heading')}</h1>

      <section className="space-y-6">
        <h2 className="font-serif text-xl text-ink">{t('paymentSection')}</h2>
        <PaymentSettingsForm
          initialQrUrl={settings.qrUrl}
          initialAccountLabel={settings.accountLabel ?? ''}
          initialInstructions={settings.instructions}
        />
      </section>

      <section className="space-y-6 border-t border-line pt-12">
        <h2 className="font-serif text-xl text-ink">{ts('sectionTitle')}</h2>
        <ShippingZonesForm initial={zones} />
      </section>

      <section className="space-y-6 border-t border-line pt-12">
        <h2 className="font-serif text-xl text-ink">{tc('heading')}</h2>
        <p className="text-sm text-muted">{tc('hint')}</p>
        <ProductCopyForm initial={copyInitial} />
      </section>

      <section className="space-y-6 border-t border-line pt-12">
        <h2 className="font-serif text-xl text-ink">{t('emailSection')}</h2>
        <p className="text-sm text-muted">{t('emailSectionHint')}</p>
        <EmailProviderForm initialProvider={emailProvider} />
      </section>
    </div>
  );
}
