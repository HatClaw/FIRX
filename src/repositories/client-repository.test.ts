import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  insert: vi.fn(), select: vi.fn(), single: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: vi.fn(() => query) },
}));

import { ClientRepository } from './client-repository';

describe('ClientRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({ data: { id: 'client-1', empresa_id: 'company-1' }, error: null });
  });

  it('maps the Portuguese client payload to supported database columns', async () => {
    const payload = {
      empresa_id: 'company-1', nome: 'Acme', tipo: 'pessoa_juridica' as const,
      documento: '123', endereco: { logradouro: 'Rua A', numero: '10' }, cep: '01000-000',
    };

    await ClientRepository.create(payload, 'user-1');

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 'company-1', nome: 'Acme', tipo: 'pessoa_juridica',
      documento: '123', endereco: payload.endereco, cep: payload.cep,
      criado_por: 'user-1', status: 'ativo',
    }));
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty('empresaId');
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty('cao');
  });
});
