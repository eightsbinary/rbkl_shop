import { describe, expect, it } from 'vitest';
import { requireRecentAuth, StepUpRequiredError } from '@/db/auth';

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
