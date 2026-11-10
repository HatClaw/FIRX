import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), delete: vi.fn(), archive: vi.fn(),
  findById: vi.fn(), findMany: vi.fn(), getHistorico: vi.fn(), addHistorico: vi.fn(),
}));

vi.mock('@/repositories/client-repository', () => ({ ClientRepository: repository }));

import { ClientService } from './client-service';

const cliente = {
  id: 'cliente-1', empresa_id: 'empresa-1', nome: 'Acme', documento: '123',
  tipo: 'pessoa_juridica' as const, status: 'ativo' as const,
  criado_em: '2026-01-01', atualizado_em: '2026-01-01', criado_por: 'user-1',
};

describe('ClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.create.mockResolvedValue(cliente);
    repository.update.mockResolvedValue(cliente);
    repository.delete.mockResolvedValue(undefined);
    repository.addHistorico.mockResolvedValue(undefined);
  });

  it('persists a new client using the schema empresa_id and records history', async () => {
    const payload = { empresa_id: 'empresa-1', nome: 'Acme', documento: '123', tipo: 'pessoa_juridica' as const };

    await expect(ClientService.create(payload, 'user-1', 'admin')).resolves.toEqual(cliente);

    expect(repository.create).toHaveBeenCalledWith(payload, 'user-1');
    expect(repository.addHistorico).toHaveBeenCalledWith('cliente-1', 'empresa-1', 'criacao', 'Cliente criado', 'user-1');
  });

  it('rejects creating a client without an empresa_id', async () => {
    await expect(ClientService.create({ nome: 'Acme', documento: '123', tipo: 'pessoa_juridica' } as never, 'user-1', 'admin'))
      .rejects.toThrow('Empresa e obrigatoria');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not report a persisted creation as failed when history recording fails', async () => {
    repository.addHistorico.mockRejectedValueOnce(new Error('history unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(ClientService.create({ empresa_id: 'empresa-1', nome: 'Acme', documento: '123', tipo: 'pessoa_juridica' }, 'user-1', 'admin'))
      .resolves.toEqual(cliente);

    errorSpy.mockRestore();
  });

  it('requires a tenant id when listing clients', async () => {
    await expect(ClientService.findMany({}, 'admin')).rejects.toThrow('Empresa e obrigatoria');
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});
