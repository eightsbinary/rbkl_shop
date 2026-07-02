import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

vi.mock('server-only', () => ({}));

const { requireMock, stepUpMock, state, revalidateMock } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
  state: {
    images: {} as Record<string, string>,
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

const fakeDb = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { images: state.images } }) }),
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: () => {
        state.updates.push(payload);
        return Promise.resolve({ error: state.updateError });
      },
    }),
  }),
  storage: {
    from: (bucket: string) => ({
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `http://127.0.0.1:54321/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  },
};
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => fakeDb,
  createServiceRoleSupabase: () => fakeDb,
}));

const { saveAboutImages } = await import('@/server/actions/about');
const { getAboutImages } = await import('@/server/queries/about');

beforeEach(() => {
  vi.clearAllMocks();
  requireMock.mockResolvedValue(undefined);
  stepUpMock.mockResolvedValue(null);
  state.images = {};
  state.updates = [];
  state.updateError = null;
});

describe('saveAboutImages', () => {
  it('rejects a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    await expect(saveAboutImages({ hero: 'about/x.png' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(state.updates).toHaveLength(0);
  });

  it('returns the step-up gate without writing', async () => {
    stepUpMock.mockResolvedValue({ error: STEP_UP_REQUIRED });
    expect(await saveAboutImages({ hero: 'about/x.png' })).toEqual({ error: STEP_UP_REQUIRED });
    expect(state.updates).toHaveLength(0);
  });

  it('rejects a path outside the about/ prefix', async () => {
    const res = await saveAboutImages({ hero: '../products/sneaky.png' });
    expect(res).toHaveProperty('error');
    expect(state.updates).toHaveLength(0);
  });

  it('rejects an unknown section', async () => {
    const res = await saveAboutImages({ banner: 'about/x.png' } as never);
    expect(res).toHaveProperty('error');
    expect(state.updates).toHaveLength(0);
  });

  it('merges the selection into existing images and revalidates', async () => {
    state.images = { craft: 'about/old-craft.png' };
    const res = await saveAboutImages({ hero: 'about/new-hero.png' });
    expect(res).toEqual({ ok: true });
    expect(state.updates[0]).toMatchObject({
      images: { hero: 'about/new-hero.png', craft: 'about/old-craft.png' },
    });
    expect(revalidateMock).toHaveBeenCalledWith('/en/about');
    expect(revalidateMock).toHaveBeenCalledWith('/th/about');
  });

  it('clears a section back to the default with null', async () => {
    state.images = { hero: 'about/custom.png', craft: 'about/c.png' };
    await saveAboutImages({ hero: null });
    expect(state.updates[0]).toMatchObject({ images: { craft: 'about/c.png' } });
    expect((state.updates[0]?.images as Record<string, string>).hero).toBeUndefined();
  });

  it('surfaces a DB error', async () => {
    state.updateError = { message: 'boom' };
    expect(await saveAboutImages({ hero: 'about/x.png' })).toEqual({ error: 'boom' });
  });
});

describe('getAboutImages', () => {
  it('returns the built-in defaults when nothing is selected', async () => {
    expect(await getAboutImages()).toEqual({
      hero: '/about-hero.png',
      craft: '/about-craft.png',
      inspiration: '/about-inspiration.png',
    });
  });

  it('resolves selected paths to public storage URLs, defaults elsewhere', async () => {
    state.images = { hero: 'about/me.png' };
    const imgs = await getAboutImages();
    expect(imgs.hero).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/about-assets/about/me.png',
    );
    expect(imgs.craft).toBe('/about-craft.png');
  });
});
