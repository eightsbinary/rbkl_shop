'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { syncSheets } from '@/server/actions/sync-sheets';

export function SyncPanel() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await syncSheets();
            if ('error' in res) setMsg({ tone: 'error', text: res.error });
            else
              setMsg({
                tone: 'ok',
                text: `Synced — ${res.applied} applied, ${res.rejected} rejected.`,
              });
          })
        }
      >
        {pending ? 'Syncing…' : 'Sync now'}
      </Button>
      {msg && (
        <p className={`text-sm ${msg.tone === 'ok' ? 'text-success' : 'text-error'}`}>{msg.text}</p>
      )}
    </div>
  );
}
