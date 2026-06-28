import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireRecentAuth, StepUpRequiredError, stepUpGuard } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

type Client = Parameters<typeof requireRecentAuth>[0];

function clientWithUser(user: { last_sign_in_at?: string | null } | null): Client {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  } as unknown as Client;
}

const WINDOW = 30 * 60_000;
const NOW = 1_700_000_000_000;
const now = () => NOW;

describe('requireRecentAuth', () => {
  it('resolves when the last sign-in is within the window', async () => {
    const client = clientWithUser({ last_sign_in_at: new Date(NOW - 10 * 60_000).toISOString() });
    await expect(requireRecentAuth(client, WINDOW, now)).resolves.toBeUndefined();
  });

  it('throws StepUpRequiredError when the last sign-in is stale', async () => {
    const client = clientWithUser({ last_sign_in_at: new Date(NOW - 40 * 60_000).toISOString() });
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(
      StepUpRequiredError,
    );
  });

  it('throws when last_sign_in_at is missing', async () => {
    const client = clientWithUser({ last_sign_in_at: null });
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(
      StepUpRequiredError,
    );
  });

  it('throws when there is no user', async () => {
    const client = clientWithUser(null);
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(
      StepUpRequiredError,
    );
  });
});

describe('stepUpGuard', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bypasses the check outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    // Stale session, but dev bypass should still return null.
    const client = clientWithUser({ last_sign_in_at: new Date(0).toISOString() });
    expect(await stepUpGuard(client)).toBeNull();
  });

  it('returns null in production when the session is recent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const client = clientWithUser({ last_sign_in_at: new Date(Date.now() - 1000).toISOString() });
    expect(await stepUpGuard(client)).toBeNull();
  });

  it('returns the step-up sentinel in production when the session is stale', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const client = clientWithUser({
      last_sign_in_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    expect(await stepUpGuard(client)).toEqual({ error: STEP_UP_REQUIRED });
  });

  it('rethrows unexpected errors in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const client = {
      auth: {
        getUser: async () => {
          throw new Error('network');
        },
      },
    } as unknown as Parameters<typeof stepUpGuard>[0];
    await expect(stepUpGuard(client)).rejects.toThrow('network');
  });
});
