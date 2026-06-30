'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ShipOrderForm, type ShipOrderFormProps } from './ShipOrderForm';

/** Collapsed "Edit tracking" affordance shown on an already-shipped order;
 *  expands the ShipOrderForm in edit mode (silent tracking correction). */
export function EditTracking({
  orderId,
  initial,
}: {
  orderId: string;
  initial: ShipOrderFormProps['initial'];
}) {
  const t = useTranslations('admin.orders');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-rose-deep transition-colors duration-150 ease-out-soft hover:text-ink hover:underline"
      >
        {t('ship.editTracking')}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <ShipOrderForm orderId={orderId} mode="edit" initial={initial} />
    </div>
  );
}
