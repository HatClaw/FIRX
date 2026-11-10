import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
  from: vi.fn(),
}));
const query = vi.hoisted(() => ({
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: supabaseMock }));

import { listContratosRemotos } from './contratos-store';

describe('listContratosRemotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'seller-1' } }, error: null });
    supabaseMock.from.mockReturnValue(query);
    query.upsert.mockResolvedValue({ error: null });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
  });

  it('does not import the shared legacy bucket into a seller account', async () => {
    localStorage.setItem('empresaAtiva', 'company-1');
    localStorage.setItem('gm_contratos_v1', JSON.stringify([{ id: 'legacy-1', status: 'rascunho' }]));
    supabaseMock.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === 'empresa_role' ? 'vendedor' : false,
      error: null,
    }));

    await listContratosRemotos();

    expect(query.upsert).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'seller-1');
    expect(localStorage.getItem('gm_contratos_v1')).not.toBeNull();
  });

  it('allows a platform admin to migrate legacy contracts', async () => {
    localStorage.setItem('gm_contratos_v1', JSON.stringify([{ id: 'legacy-1', status: 'rascunho' }]));
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null });

    await listContratosRemotos();

    expect(query.upsert).toHaveBeenCalledOnce();
    expect(query.upsert.mock.calls[0][0][0]).toMatchObject({ user_id: 'seller-1', status: 'rascunho' });
    expect(localStorage.getItem('gm_contratos_v1')).toBeNull();
  });
});
