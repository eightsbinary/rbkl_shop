import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

vi.mock('server-only', () => ({}));

const { requireMock, stepUpMock, state, revalidateMock } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
  state: {
    row: { bg_light: null, bg_dark: null } as {
      bg_light: string | null;
      bg_dark: string | null;
    } | null,
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

const { saveSiteAppearance } = await import('@/server/actions/site-appearance');
const { getSiteAppearance } = await import('@/server/queries/site-appearance');

describe('saveSiteAppearance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMock.mockResolvedValue(undefined);
    stepUpMock.mockResolvedValue(null);
    state.row = { bg_light: null, bg_dark: null };
    state.updates = [];
    state.updateError = null;
  });

  it('rejects a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    await expect(saveSiteAppearance({ bgLight: '#ffffff', bgDark: null })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(state.updates).toHaveLength(0);
  });

  it('returns the step-up gate without writing', async () => {
    stepUpMock.mockResolvedValue({ error: STEP_UP_REQUIRED });
    const res = await saveSiteAppearance({ bgLight: '#ffffff', bgDark: null });
    expect(res).toEqual({ error: STEP_UP_REQUIRED });
    expect(state.updates).toHaveLength(0);
  });

  it('rejects non-hex values without writing', async () => {
    for (const bad of ['red', '#fff', '#12345g', 'red;}body{display:none']) {
      const res = await saveSiteAppearance({ bgLight: bad, bgDark: null });
      expect(res).toHaveProperty('error');
    }
    expect(state.updates).toHaveLength(0);
  });

  it('normalizes case/whitespace and treats empty as cleared', async () => {
    const res = await saveSiteAppearance({ bgLight: ' #FFF7EF ', bgDark: '' });
    expect(res).toEqual({ ok: true });
    expect(state.updates[0]).toEqual({ bg_light: '#fff7ef', bg_dark: null });
  });

  it('updates the singleton and revalidates the storefront layout', async () => {
    const res = await saveSiteAppearance({ bgLight: '#fff7ef', bgDark: '#0a0a14' });
    expect(res).toEqual({ ok: true });
    expect(state.updates[0]).toEqual({ bg_light: '#fff7ef', bg_dark: '#0a0a14' });
    expect(revalidateMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidateMock).toHaveBeenCalledWith('/admin/settings');
  });

  it('surfaces a DB error', async () => {
    state.updateError = { message: 'boom' };
    const res = await saveSiteAppearance({ bgLight: null, bgDark: null });
    expect(res).toEqual({ error: 'boom' });
  });
});

describe('getSiteAppearance', () => {
  it('returns stored overrides', async () => {
    state.row = { bg_light: '#fff7ef', bg_dark: '#0a0a14' };
    expect(await getSiteAppearance()).toEqual({ bgLight: '#fff7ef', bgDark: '#0a0a14' });
  });

  it('returns nulls when the row is missing', async () => {
    state.row = null;
    expect(await getSiteAppearance()).toEqual({ bgLight: null, bgDark: null });
  });
});
