import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

vi.mock('server-only', () => ({}));

const { requireMock, stepUpMock, state, revalidateMock } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
  state: {
    row: { content: {} as Record<string, unknown> },
    upserts: [] as Array<Record<string, unknown>>,
    upsertError: null as { message: string } | null,
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
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row }) }) }),
    }),
  }),
  createServiceRoleSupabase: () => ({
    from: () => ({
      upsert: (payload: Record<string, unknown>) => {
        state.upserts.push(payload);
        return Promise.resolve({ error: state.upsertError });
      },
    }),
  }),
}));

const { saveProductCopy } = await import('@/server/actions/product-copy');
const { getProductCopy } = await import('@/server/queries/product-copy');

beforeEach(() => {
  vi.clearAllMocks();
  requireMock.mockResolvedValue(undefined);
  stepUpMock.mockResolvedValue(null);
  state.row = { content: {} };
  state.upserts = [];
  state.upsertError = null;
});

describe('saveProductCopy', () => {
  it('rejects a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    await expect(saveProductCopy({})).rejects.toBeInstanceOf(ForbiddenError);
    expect(state.upserts).toHaveLength(0);
  });

  it('returns the step-up gate without writing', async () => {
    stepUpMock.mockResolvedValue({ error: STEP_UP_REQUIRED });
    expect(await saveProductCopy({})).toEqual({ error: STEP_UP_REQUIRED });
    expect(state.upserts).toHaveLength(0);
  });

  it('persists trimmed known fields, drops blanks and unknowns, revalidates', async () => {
    const res = await saveProductCopy({
      detailsBody: { th: ' ดูแลด้วยใจ ', en: ' Wash cold. ' },
      detailsTitle: { th: '', en: '' },
      hacker: { en: 'x' },
    } as never);
    expect(res).toEqual({ ok: true });
    expect(state.upserts[0]).toMatchObject({
      id: 'singleton',
      content: { detailsBody: { th: 'ดูแลด้วยใจ', en: 'Wash cold.' } },
    });
    const content = state.upserts[0]?.content as Record<string, unknown>;
    expect(content.detailsTitle).toBeUndefined();
    expect(content.hacker).toBeUndefined();
    expect(revalidateMock).toHaveBeenCalled();
  });

  it('surfaces a DB error', async () => {
    state.upsertError = { message: 'boom' };
    expect(await saveProductCopy({})).toEqual({ error: 'boom' });
  });
});

describe('getProductCopy', () => {
  it('returns an empty object when unset', async () => {
    expect(await getProductCopy()).toEqual({});
  });

  it('returns stored overrides', async () => {
    state.row = { content: { shippingBody: { en: 'Ships fast.' } } };
    expect(await getProductCopy()).toEqual({ shippingBody: { en: 'Ships fast.' } });
  });
});
