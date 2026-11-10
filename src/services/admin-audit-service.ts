import { listAdminAuditEvents, type AdminAuditEvent } from '@/repositories/admin-audit-repository';

export async function getRecentAdminAuditEvents(): Promise<AdminAuditEvent[]> {
  try {
    return await listAdminAuditEvents(100);
  } catch {
    throw new Error('Não foi possível carregar a auditoria. Verifique o acesso administrativo e as políticas aplicadas.');
  }
}
