import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, getCurrentRole, requireDev, requireOwnerOrDev } from '@/db/auth';

function mockClient(role: 'customer' | 'owner' | 'dev' | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: role === null ? null : { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: role === null ? null : { role },
            error: null,
          }),
        }),
      }),
    }),
  };
}

describe('getCurrentRole', () => {
  it('returns null when unauthenticated', async () => {
    const c = mockClient(null);
    expect(await getCurrentRole(c as never)).toBeNull();
  });

  it('returns the role for an authenticated user', async () => {
    const c = mockClient('owner');
    expect(await getCurrentRole(c as never)).toBe('owner');
  });
});

describe('requireOwnerOrDev', () => {
  it('passes for owner', async () => {
    const c = mockClient('owner');
    await expect(requireOwnerOrDev(c as never)).resolves.toBeUndefined();
  });

  it('passes for dev', async () => {
    const c = mockClient('dev');
    await expect(requireOwnerOrDev(c as never)).resolves.toBeUndefined();
  });

  it('throws ForbiddenError for customer', async () => {
    const c = mockClient('customer');
    await expect(requireOwnerOrDev(c as never)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ForbiddenError for unauthenticated', async () => {
    const c = mockClient(null);
    await expect(requireOwnerOrDev(c as never)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('requireDev', () => {
  it('passes for dev', async () => {
    await expect(requireDev(mockClient('dev') as never)).resolves.toBeUndefined();
  });

  it('throws ForbiddenError for owner', async () => {
    await expect(requireDev(mockClient('owner') as never)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ForbiddenError for customer', async () => {
    await expect(requireDev(mockClient('customer') as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
