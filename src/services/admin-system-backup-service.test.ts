import { describe, expect, it } from 'vitest';
import {
  SYSTEM_BACKUP_DATASETS,
  SYSTEM_BACKUP_FORMAT,
  SYSTEM_BACKUP_VERSION,
  validateSystemBackup,
} from './admin-system-backup-service';

const companyId = 'bda65574-51ba-46d5-b9c3-a26d367a8e45';
const clientId = '9b653e85-859b-496e-acb0-30b6b079aa47';

function backupWith(overrides: Record<string, unknown[]> = {}) {
  const datasets = Object.fromEntries(SYSTEM_BACKUP_DATASETS.map((table) => [table, []])) as Record<string, unknown[]>;
  return {
    format: SYSTEM_BACKUP_FORMAT,
    version: SYSTEM_BACKUP_VERSION,
    createdAt: '2026-10-23T00:00:00.000Z',
    datasets: {
      ...datasets,
      empresas: [{ id: companyId, nome: 'Empresa' }],
      clients: [{ id: clientId, empresa_id: companyId, nome: 'Cliente', documento: '12345678901' }],
      ...overrides,
    },
    exclusions: [],
    redactions: [],
  };
}

describe('validateSystemBackup', () => {
  it('accepts a structurally complete backup for transactional restoration', () => {
    const preview = validateSystemBackup(backupWith());

    expect(preview.valid).toBe(true);
    expect(preview.recordCount).toBe(2);
    expect(preview.canApply).toBe(true);
    expect(preview.blockedReason).toContain('única transação');
  });

  it('rejects secret fields and datasets outside the allowlist', () => {
    const input = backupWith({
      clients: [{ id: clientId, empresa_id: companyId, token: 'must-not-import' }],
      platform_admins: [{ user_id: companyId }],
    });
    const preview = validateSystemBackup(input);

    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('Campo secreto'))).toBe(true);
    expect(preview.errors.some((error) => error.includes('Dataset não permitido'))).toBe(true);
  });

  it('rejects references to records omitted from the backup', () => {
    const input = backupWith({
      contratos: [{ id: 'f0ea67ae-15f1-4fc8-91c2-5449f1d77be1', empresa_id: companyId, numero: 'C-1', cliente_id: clientId, servico_id: 'b8e4962e-7a3b-47b3-a945-3bcb9739881b' }],
    });
    const preview = validateSystemBackup(input);

    expect(preview.valid).toBe(false);
    expect(preview.errors.some((error) => error.includes('servico_id'))).toBe(true);
  });
});
