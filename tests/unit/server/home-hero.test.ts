import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';
import { STEP_UP_REQUIRED } from '@/lib/step-up';

vi.mock('server-only', () => ({}));

const { requireMock, stepUpMock, state, revalidateMock } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
  state: {
    row: { content: {} as Record<string, unknown>, images: {} as Record<string, string> },
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

const fakeDb = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: state.row }) }),
    }),
    upsert: (payload: Record<string, unknown>) => {
      state.upserts.push(payload);
      return Promise.resolve({ error: state.upsertError });
    },
  }),
  storage: {
    from: (bucket: string) => ({
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `http://storage.local/${bucket}/${path}` },
      }),
    }),
  },
};
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => fakeDb,
  createServiceRoleSupabase: () => fakeDb,
}));

const { saveHomeHero } = await import('@/server/actions/home');
const { getHomeHero } = await import('@/server/queries/home');

const validInput = {
  content: { heroCta: { th: 'ช้อปเลย', en: 'Shop now' } },
  image: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireMock.mockResolvedValue(undefined);
  stepUpMock.mockResolvedValue(null);
  state.row = { content: {}, images: {} };
  state.upserts = [];
  state.upsertError = null;
});

describe('saveHomeHero', () => {
  it('rejects a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    await expect(saveHomeHero(validInput)).rejects.toBeInstanceOf(ForbiddenError);
    expect(state.upserts).toHaveLength(0);
  });

  it('returns the step-up gate without writing', async () => {
    stepUpMock.mockResolvedValue({ error: STEP_UP_REQUIRED });
    expect(await saveHomeHero(validInput)).toEqual({ error: STEP_UP_REQUIRED });
    expect(state.upserts).toHaveLength(0);
  });

  it('rejects an image path outside home/', async () => {
    const res = await saveHomeHero({ content: {}, image: 'about/sneaky.png' });
    expect(res).toHaveProperty('error');
    expect(state.upserts).toHaveLength(0);
  });

  it('persists trimmed known fields and the hero image, then revalidates', async () => {
    const res = await saveHomeHero({
      content: {
        heroCta: { th: ' ช้อปเลย ', en: ' Shop now ' },
        heroLine1: { th: '', en: '' }, // blank → dropped (falls back to i18n)
        bogus: { en: 'x' }, // unknown → dropped
      } as never,
      image: 'home/hero-1.webp',
    });
    expect(res).toEqual({ ok: true });
    expect(state.upserts[0]).toMatchObject({
      id: 'singleton',
      content: { heroCta: { th: 'ช้อปเลย', en: 'Shop now' } },
      images: { hero: 'home/hero-1.webp' },
    });
    expect((state.upserts[0]?.content as Record<string, unknown>).heroLine1).toBeUndefined();
    expect((state.upserts[0]?.content as Record<string, unknown>).bogus).toBeUndefined();
    expect(revalidateMock).toHaveBeenCalledWith('/en');
    expect(revalidateMock).toHaveBeenCalledWith('/th');
  });

  it('clears the image back to default with null', async () => {
    await saveHomeHero({ content: {}, image: null });
    expect(state.upserts[0]).toMatchObject({ images: {} });
  });

  it('surfaces a DB error', async () => {
    state.upsertError = { message: 'boom' };
    expect(await saveHomeHero(validInput)).toEqual({ error: 'boom' });
  });
});

describe('getHomeHero', () => {
  it('returns defaults when nothing is stored', async () => {
    const hero = await getHomeHero();
    expect(hero.content).toEqual({});
    expect(hero.imageUrl).toBe('/hero.png');
    expect(hero.imagePath).toBeNull();
  });

  it('resolves a stored image path to its public URL', async () => {
    state.row = { content: { heroCta: { en: 'Go' } }, images: { hero: 'home/x.webp' } };
    const hero = await getHomeHero();
    expect(hero.content).toEqual({ heroCta: { en: 'Go' } });
    expect(hero.imageUrl).toBe('http://storage.local/home-assets/home/x.webp');
    expect(hero.imagePath).toBe('home/x.webp');
  });
});
