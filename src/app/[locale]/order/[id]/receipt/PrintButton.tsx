'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function PrintButton() {
  const t = useTranslations('receipt');
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {t('print')}
    </Button>
  );
}
