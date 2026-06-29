import { getTranslations } from 'next-intl/server';
import { PaymentSettingsForm } from '@/components/admin/PaymentSettingsForm';
import { getPaymentSettings } from '@/server/queries/payment-settings';

export default async function AdminSettingsPage() {
  const t = await getTranslations('admin.settings');
  const settings = await getPaymentSettings();
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
      <PaymentSettingsForm
        initialQrUrl={settings.qrUrl}
        initialAccountLabel={settings.accountLabel ?? ''}
        initialInstructions={settings.instructions}
      />
    </div>
  );
}
