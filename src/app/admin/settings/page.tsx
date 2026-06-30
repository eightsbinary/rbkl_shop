import { getTranslations } from 'next-intl/server';
import { PaymentSettingsForm } from '@/components/admin/PaymentSettingsForm';
import { ShippingZonesForm } from '@/components/admin/ShippingZonesForm';
import { getPaymentSettings } from '@/server/queries/payment-settings';
import { getShippingZones } from '@/server/queries/shipping';

export default async function AdminSettingsPage() {
  const t = await getTranslations('admin.settings');
  const ts = await getTranslations('admin.shipping');
  const [settings, zones] = await Promise.all([getPaymentSettings(), getShippingZones()]);

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
    </div>
  );
}
