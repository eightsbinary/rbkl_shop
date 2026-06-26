'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { requestMagicLink } from '@/server/actions/auth';

type Status = 'idle' | 'sent' | { error: string };

export default function AdminLoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  return (
    <div className="mx-auto max-w-md py-24 space-y-8 px-6">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">admin</p>
        <h1 className="font-serif text-3xl text-ink">Sign in</h1>
      </header>
      <form
        action={async (fd) => {
          setSubmitting(true);
          const r = await requestMagicLink(fd);
          setSubmitting(false);
          if ('ok' in r) setStatus('sent');
          else setStatus({ error: r.error });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Sending…' : 'Send magic link'}
        </Button>
        {status === 'sent' && (
          <p className="text-sm text-success">
            Check your inbox (or Mailpit at http://127.0.0.1:54324 for local dev).
          </p>
        )}
        {typeof status === 'object' && 'error' in status && (
          <p className="text-sm text-error">{status.error}</p>
        )}
      </form>
    </div>
  );
}
