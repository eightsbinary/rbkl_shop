import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

vi.mock('server-only', () => ({}));

const { requireMock, stepUpMock, state, revalidateMock } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
  state: {
    row: { email_provider: 'gmail' } as { email_provider: string } | null,
    updates: [] as Array<Record<string, unknown>>,
    updateError: null as { message: string } | null,
  },
  revalidateMock: vi.fn(),
}));

vi.mock('@/db/auth', async (orig) => {
  const actual = await orig<typeof import('@/db/auth')>();
  return { ...actual, requireOwnerOrDev: requireMock, stepUpGuard: stepUpMock };
});
vi.mock('next/cache', () => ({ revalidatePath: revalidateMock }));
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.row }) }),
      }),
    }),
  }),
  createServiceRoleSupabase: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: () => {
          state.updates.push(payload);
          return Promise.resolve({ error: state.updateError });
        },
      }),
    }),
  }),
}));

const { saveEmailProvider } = await import('@/server/actions/app-settings');
const { getEmailProvider } = await import('@/server/queries/app-settings');

describe('saveEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMock.mockResolvedValue(undefined);
    stepUpMock.mockResolvedValue(null);
    state.row = { email_provider: 'gmail' };
    state.updates = [];
    state.updateError = null;
  });

  it('rejects a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    await expect(saveEmailProvider('resend')).rejects.toBeInstanceOf(ForbiddenError);
    expect(state.updates).toHaveLength(0);
  });

  it('returns the step-up gate without writing', async () => {
    stepUpMock.mockResolvedValue({ error: STEP_UP_REQUIRED });
    const res = await saveEmailProvider('resend');
    expect(res).toEqual({ error: STEP_UP_REQUIRED });
    expect(state.updates).toHaveLength(0);
  });

  it('rejects an unknown provider value', async () => {
    const res = await saveEmailProvider('sendgrid');
    expect(res).toHaveProperty('error');
    expect(state.updates).toHaveLength(0);
  });

  it('updates the singleton row and revalidates the settings page', async () => {
    const res = await saveEmailProvider('resend');
    expect(res).toEqual({ ok: true });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ email_provider: 'resend' });
    expect(revalidateMock).toHaveBeenCalledWith('/admin/settings');
  });

  it('surfaces a DB error', async () => {
    state.updateError = { message: 'boom' };
    const res = await saveEmailProvider('gmail');
    expect(res).toEqual({ error: 'boom' });
  });
});

describe('getEmailProvider', () => {
  it('returns the stored provider', async () => {
    state.row = { email_provider: 'resend' };
    expect(await getEmailProvider()).toBe('resend');
  });

  it('defaults to gmail when the row is missing', async () => {
    state.row = null;
    expect(await getEmailProvider()).toBe('gmail');
  });
});
