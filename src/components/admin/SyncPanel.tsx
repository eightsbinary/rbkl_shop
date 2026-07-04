'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import type { ChangeDetail } from '@/domain/sheets-sync/diff';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { previewSheets, syncSheets } from '@/server/actions/sync-sheets';

interface Preview {
  applied: number;
  rejected: number;
  details: ChangeDetail[];
}

/** Two-step sync: Preview (dry run, shows every cell that would change) gates
 *  Apply (the real run). Nothing writes until the admin has seen the diff. */
export function SyncPanel() {
  const t = useTranslations('admin.sync');
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [stepUp, setStepUp] = useState(false);

  function fail(error: string) {
    if (error === STEP_UP_REQUIRED) setStepUp(true);
    else setMsg({ tone: 'error', text: error });
  }

  function doPreview() {
    start(async () => {
      setMsg(null);
      setStepUp(false);
      setPreview(null);
      const res = await previewSheets();
      if ('error' in res) return fail(res.error);
      setPreview({ applied: res.applied, rejected: res.rejected, details: res.details });
    });
  }

  function doApply() {
    start(async () => {
      setMsg(null);
      setStepUp(false);
      const res = await syncSheets();
      setPreview(null);
      if ('error' in res) return fail(res.error);
      setMsg({ tone: 'ok', text: t('synced', { applied: res.applied, rejected: res.rejected }) });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={pending} onClick={doPreview}>
          {pending && !preview ? t('previewing') : t('previewCta')}
        </Button>
        {preview && (
          <Button variant="solid" disabled={pending} onClick={doApply}>
            {pending
              ? t('syncing')
              : preview.details.length > 0
                ? t('applyCta', { count: preview.details.length })
                : t('refreshCta')}
          </Button>
        )}
      </div>

      {preview && (
        <div className="border border-line bg-surface p-4 text-sm">
          {preview.details.length === 0 ? (
            <p className="text-muted">{t('noChanges')}</p>
          ) : (
            <>
              <p className="pb-2 text-xs uppercase tracking-[0.12em] text-muted">
                {t('previewTitle', { count: preview.details.length })}
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {preview.details.map((d) => (
                  <li
                    key={`${d.table_name}:${d.row_pk}:${d.column_name}`}
                    className="text-ink-soft"
                  >
                    <span className="text-muted">
                      {d.table_name} · {d.row_pk.slice(0, 8)} · {d.column_name}:
                    </span>{' '}
                    <span className="line-through">{d.from || '∅'}</span>{' '}
                    <span className="text-ink">→ {d.to || '∅'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {preview.rejected > 0 && (
            <p className="pt-2 text-xs text-warn">
              {t('previewRejected', { count: preview.rejected })}
            </p>
          )}
        </div>
      )}

      {msg && (
        <p className={`text-sm ${msg.tone === 'ok' ? 'text-success' : 'text-error'}`}>{msg.text}</p>
      )}
      {stepUp && <StepUpPrompt />}
    </div>
  );
}
