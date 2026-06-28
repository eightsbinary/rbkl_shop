'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { resendStepUpLink } from '@/server/actions/auth';

/** Shown when an admin action returns the step-up sentinel. Re-sends a magic
 *  link to the signed-in admin; clicking it refreshes last_sign_in_at so the
 *  retried action passes the recency gate. */
export function StepUpPrompt() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>For your security, confirm it&apos;s you before this action.</p>
      {sent ? (
        <p className="text-success">Sign-in link sent — open it from your email, then retry.</p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await resendStepUpLink();
              if ('error' in res) setError(res.error);
              else setSent(true);
            })
          }
        >
          {pending ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      )}
      {error && <p className="text-error">{error}</p>}
    </div>
  );
}
