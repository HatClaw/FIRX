import { supabase } from '@/lib/supabase/client';
import { requirePlatformAdmin } from '@/services/admin-resource-service';

export const SYSTEM_BACKUP_FORMAT = 'growmoney-system-backup';
export const SYSTEM_BACKUP_VERSION = 1;
const PAGE_SIZE = 500;
const MAX_RECORDS = 100_000;
const MAX_IMPORT_BYTES = 50_000_000;
const USER_REFERENCE_FIELDS = new Set([
  'responsavel_id', 'criado_por', 'atualizado_por', 'usuario_id', 'user_id', 'owner_id',
]);

/** Operational data only. Identity, audit/history, and authorization tables are deliberately excluded. */
export const SYSTEM_BACKUP_DATASETS = [
  'empresas',
  'clients',
  'services',
  'vendedores',
  'comissoes',
  'vendedor_desempenho',
  'contratos',
  'assinaturas',
  'parcelas',
  'lancamentos',
  'estornos',
  'agenda',
  'gm_contracts',
  'gm_files',
  'gm_financial_entries',
  'signature_envelopes',
] as const;

export type SystemBackupDataset = (typeof SYSTEM_BACKUP_DATASETS)[number];
export type SystemBackup = {
  format: typeof SYSTEM_BACKUP_FORMAT;
  version: typeof SYSTEM_BACKUP_VERSION;
  createdAt: string;
  datasets: Record<SystemBackupDataset, Record<string, unknown>[]>;
  exclusions: string[];
  redactions: string[];
};

export type ImportPreview = {
  valid: boolean;
  canApply: boolean;
  blockedReason: string;
  recordCount: number;
  tableCounts: Partial<Record<SystemBackupDataset, number>>;
  errors: string[];
  warnings: string[];
};

const EXCLUSIONS = [
  'Perfis, memberships, convites e identidades de autenticação',
  'Autorização de platform admin e registros de auditoria',
  'Históricos de domínio e eventos de assinatura',
  'Arquivos binários do Storage (somente metadados gm_files)',
  'Envelopes de assinatura e tokens privados de acesso',
];
const SENSITIVE_KEY = /(token|secret|password|passwd|credential|authorization|api.?key|private.?key)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_FIELDS: Partial<Record<SystemBackupDataset, string[]>> = {
  empresas: ['nome'],
  clients: ['empresa_id', 'nome', 'documento'],
  services: ['empresa_id', 'codigo', 'nome'],
  vendedores: ['empresa_id', 'nome', 'email', 'identificador_interno'],
  comissoes: ['empresa_id', 'vendedor_id'],
  vendedor_desempenho: ['empresa_id', 'vendedor_id', 'periodo'],
  contratos: ['empresa_id', 'numero', 'cliente_id', 'servico_id'],
  assinaturas: ['contrato_id', 'empresa_id', 'assinante'],
  parcelas: ['empresa_id', 'contrato_id', 'cliente_id', 'numero', 'data_vencimento'],
  lancamentos: ['empresa_id', 'parcela_id', 'valor', 'data_pagamento'],
  estornos: ['empresa_id', 'lancamento_id', 'valor', 'motivo', 'data_estorno'],
  agenda: ['empresa_id', 'responsavel_id', 'title', 'data_hora'],
  gm_contracts: ['user_id', 'status', 'payload'],
  gm_files: ['user_id', 'categoria', 'object_path', 'original_name', 'content_type', 'size_bytes'],
  gm_financial_entries: ['empresa_id', 'cliente', 'valor', 'vencimento', 'status'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeSecrets(value: unknown, path: string, redactions: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item, index) => sanitizeSecrets(item, `${path}[${index}]`, redactions));
  if (!isPlainObject(value)) return value;

  const safe: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (SENSITIVE_KEY.test(key)) {
      redactions.add(nestedPath.replace(/\[\d+\]/g, '[*]'));
      continue;
    }
    safe[key] = sanitizeSecrets(nestedValue, nestedPath, redactions);
  }
  return safe;
}

/** Creates a platform-admin-only JSON export of operational database records. */
export async function exportFullSystemBackup(): Promise<SystemBackup> {
  await requirePlatformAdmin();
  const datasets = {} as SystemBackup['datasets'];
  const redactions = new Set<string>();
  let recordCount = 0;

  for (const table of SYSTEM_BACKUP_DATASETS) {
    if (table === 'signature_envelopes') {
      // Signing links are bearer credentials. Never place them in a downloaded
      // backup; an envelope without its private signer tokens is not restorable.
      datasets[table] = [];
      continue;
    }
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw new Error(`Exportação de ${table} falhou: ${error.message}`);

      const page = (data || []) as unknown as Record<string, unknown>[];
      rows.push(...page.map((row, index) => sanitizeSecrets(row, `${table}[${from + index}]`, redactions) as Record<string, unknown>));
      recordCount += page.length;
      if (recordCount > MAX_RECORDS) {
        throw new Error(`A exportação excedeu o limite seguro de ${MAX_RECORDS} registros.`);
      }
      if (page.length < PAGE_SIZE) break;
    }
    datasets[table] = rows;
  }

  const exportSize = new TextEncoder().encode(JSON.stringify(datasets)).length;
  if (exportSize > MAX_IMPORT_BYTES) {
    throw new Error(`A exportação excedeu o limite seguro de ${MAX_IMPORT_BYTES / 1_000_000} MB.`);
  }

  return {
    format: SYSTEM_BACKUP_FORMAT,
    version: SYSTEM_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    datasets,
    exclusions: EXCLUSIONS,
    redactions: [...redactions].sort(),
  };
}

function collectSensitivePaths(value: unknown, path: string, output: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitivePaths(item, `${path}[${index}]`, output));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (SENSITIVE_KEY.test(key)) output.push(nestedPath);
    else collectSensitivePaths(nestedValue, nestedPath, output);
  }
}

/** Validates the complete backup before any destructive server-side restore. */
export function validateSystemBackup(input: unknown): ImportPreview {
  const errors: string[] = [];
  const warnings = [
    'Os IDs de usuários referenciados precisam existir no ambiente de destino; dados de identidade não são importados.',
    'Metadados de gm_files não contêm os binários; os arquivos do Storage precisam existir no ambiente de destino.',
    'Envelopes de assinatura e seus links privados não são incluídos no backup por segurança.',
  ];
  const tableCounts: Partial<Record<SystemBackupDataset, number>> = {};
  let recordCount = 0;

  if (!isPlainObject(input)) {
    errors.push('O arquivo deve conter um objeto JSON.');
  } else {
    let serializedSize = 0;
    try {
      serializedSize = new TextEncoder().encode(JSON.stringify(input)).length;
    } catch {
      errors.push('O conteúdo não pode ser convertido para JSON.');
    }
    if (serializedSize > MAX_IMPORT_BYTES) errors.push(`O arquivo excede o limite de ${MAX_IMPORT_BYTES / 1_000_000} MB.`);
    if (input.format !== SYSTEM_BACKUP_FORMAT) errors.push('Formato de backup não reconhecido.');
    if (input.version !== SYSTEM_BACKUP_VERSION) errors.push(`Versão de backup não suportada: ${String(input.version)}.`);
    if (typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt))) {
      errors.push('O backup precisa conter uma data createdAt válida.');
    }
    if (!Array.isArray(input.exclusions) || !input.exclusions.every((value) => typeof value === 'string')) {
      errors.push('O backup precisa listar as categorias excluídas.');
    }
    if (!Array.isArray(input.redactions) || !input.redactions.every((value) => typeof value === 'string')) {
      errors.push('O backup precisa listar as chaves secretas removidas.');
    }
    if (!isPlainObject(input.datasets)) {
      errors.push('O arquivo não contém o mapa de datasets esperado.');
    } else {
      const suppliedTables = Object.keys(input.datasets);
      for (const table of suppliedTables) {
        if (!(SYSTEM_BACKUP_DATASETS as readonly string[]).includes(table)) {
          errors.push(`Dataset não permitido: ${table}.`);
        }
      }
      for (const table of SYSTEM_BACKUP_DATASETS) {
        if (!Object.prototype.hasOwnProperty.call(input.datasets, table)) {
          errors.push(`Dataset obrigatório ausente: ${table}.`);
          continue;
        }

        const rows = input.datasets[table];
        if (!Array.isArray(rows)) {
          errors.push(`Dataset ${table} deve ser uma lista.`);
          continue;
        }
        tableCounts[table] = rows.length;
        recordCount += rows.length;
        const seenIds = new Set<string>();
        rows.forEach((row, index) => {
          if (!isPlainObject(row)) {
            errors.push(`${table}[${index}] deve ser um objeto.`);
            return;
          }
          if (typeof row.id !== 'string' || !UUID_PATTERN.test(row.id)) {
            errors.push(`${table}[${index}] precisa de um id UUID válido.`);
          } else if (seenIds.has(row.id)) {
            errors.push(`${table} contém id duplicado ${row.id}.`);
          } else {
            seenIds.add(row.id);
          }
          for (const field of REQUIRED_FIELDS[table] || []) {
            const value = row[field];
            if (value === null || value === undefined || value === '') {
              errors.push(`${table}[${index}].${field} é obrigatório.`);
            }
          }
          for (const field of USER_REFERENCE_FIELDS) {
            const value = row[field];
            if (typeof value === 'string' && !UUID_PATTERN.test(value)) {
              errors.push(`${table}[${index}].${field} precisa conter um UUID válido.`);
            }
          }
          if (table === 'signature_envelopes') {
            const hasOwner = typeof row.owner_id === 'string' && row.owner_id.length > 0;
            const hasTenant = typeof row.empresa_id === 'string' && row.empresa_id.length > 0;
            if (!hasOwner && !hasTenant) errors.push(`signature_envelopes[${index}] precisa de owner_id ou empresa_id.`);
            if (hasOwner && (row.payload === null || row.payload === undefined)) {
              errors.push(`signature_envelopes[${index}].payload é obrigatório para envelope owner-scoped.`);
            }
          }
          const sensitivePaths: string[] = [];
          collectSensitivePaths(row, `${table}[${index}]`, sensitivePaths);
          sensitivePaths.forEach((path) => errors.push(`Campo secreto não permitido no backup: ${path}.`));
        });
      }

      if (recordCount > MAX_RECORDS) errors.push(`O arquivo excede o limite de ${MAX_RECORDS} registros.`);
      validateIncludedReferences(input.datasets, errors);
    }
  }

  return {
    valid: errors.length === 0,
    canApply: errors.length === 0,
    blockedReason: errors.length === 0
      ? 'A restauração substitui os dados operacionais atuais em uma única transação. Identidades, auditoria, SMTP e arquivos binários são preservados.'
      : 'Corrija os erros do arquivo antes de restaurar.',
    recordCount,
    tableCounts,
    errors,
    warnings,
  };
}

function validateIncludedReferences(
  datasets: Record<string, unknown>,
  errors: string[]
) {
  const idsByTable = new Map<string, Set<string>>();
  for (const table of SYSTEM_BACKUP_DATASETS) {
    const rows = datasets[table];
    if (Array.isArray(rows)) {
      idsByTable.set(table, new Set(rows.filter(isPlainObject).flatMap((row) => typeof row.id === 'string' ? [row.id] : [])));
    }
  }

  const requiredReferenceTargets: Record<string, string> = {
    cliente_id: 'clients',
    servico_id: 'services',
    vendedor_id: 'vendedores',
    contrato_id: 'contratos',
    parcela_id: 'parcelas',
    lancamento_id: 'lancamentos',
  };
  for (const table of SYSTEM_BACKUP_DATASETS) {
    const rows = datasets[table];
    if (!Array.isArray(rows)) continue;
    rows.forEach((row, index) => {
      if (!isPlainObject(row)) return;
      if (typeof row.empresa_id === 'string' && !idsByTable.get('empresas')?.has(row.empresa_id)) {
        errors.push(`${table}[${index}].empresa_id não referencia uma empresa incluída.`);
      }
      for (const [field, targetTable] of Object.entries(requiredReferenceTargets)) {
        const value = row[field];
        if (typeof value === 'string' && !idsByTable.get(targetTable)?.has(value)) {
          errors.push(`${table}[${index}].${field} não referencia um registro incluído em ${targetTable}.`);
        }
      }
    });
  }
}

export const AdminSystemBackupService = {
  exportFullSystemBackup,
  validateSystemBackup,
  async restoreSystemBackup(input: unknown, confirmation: string) {
    const preview = validateSystemBackup(input);
    if (!preview.valid || !preview.canApply || !isPlainObject(input) || !isPlainObject(input.datasets)) {
      throw new Error('O backup precisa estar válido antes da restauração.');
    }
    if (confirmation !== 'RESTAURAR E SUBSTITUIR DADOS') {
      throw new Error('Confirmação de restauração inválida.');
    }
    const { data, error } = await supabase.rpc('admin_restore_system_backup', {
      p_datasets: input.datasets,
      p_confirmation: confirmation,
    });
    if (error) throw new Error(`A restauração foi cancelada: ${error.message}`);
    return data as { restored: boolean; recordCount: number; inserted: Record<string, number> };
  },
  async clearSystemData(confirmation: string) {
    await requirePlatformAdmin();
    if (confirmation !== 'APAGAR TODOS OS DADOS') {
      throw new Error('Confirmação inválida.');
    }
    const { data, error } = await supabase.rpc('admin_clear_operational_data', {
      p_confirmation: confirmation,
    });
    if (error) throw new Error(`A limpeza não foi realizada: ${error.message}`);
    return data as { cleared: boolean; deleted: Record<string, number> };
  },
};
