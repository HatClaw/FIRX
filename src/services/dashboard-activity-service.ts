import { supabase } from '@/lib/supabase/client';

export type DashboardActivityAction = 'created' | 'updated' | 'deleted';

export interface DashboardActivity {
  id: string;
  occurredAt: string;
  action: DashboardActivityAction;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string;
  scope: 'company' | 'personal';
  changedFields: string[];
}

export interface DashboardLiveNotification {
  id: string;
  title: string;
  occurredAt: string;
}

type AuditRow = {
  id: string;
  empresa_id: string | null;
  usuario_id: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
};

function getAction(row: AuditRow): DashboardActivityAction | null {
  const actionParts = row.acao.split('_');
  const operation = String(row.detalhes?.operacao || actionParts[actionParts.length - 1] || '').toLowerCase();
  if (operation === 'insert' || operation === 'create' || operation === 'created') return 'created';
  if (operation === 'update' || operation === 'updated') return 'updated';
  if (operation === 'delete' || operation === 'deleted') return 'deleted';
  return null;
}

function mapActivity(row: AuditRow, actorName: string): DashboardActivity | null {
  const action = getAction(row);
  if (!action || !row.entidade) return null;

  const fields = row.detalhes?.campos;
  return {
    id: row.id,
    occurredAt: row.criado_em,
    action,
    entity: row.entidade,
    entityId: row.entidade_id,
    actorId: row.usuario_id,
    actorName,
    scope: row.empresa_id ? 'company' : 'personal',
    changedFields: Array.isArray(fields)
      ? fields.filter((field): field is string => typeof field === 'string').slice(0, 20)
      : [],
  };
}

function toLiveNotification(activity: DashboardActivity): DashboardLiveNotification {
  const action = activity.action === 'created' ? 'criou' : activity.action === 'updated' ? 'alterou' : 'excluiu';
  return {
    id: activity.id,
    title: `${activity.actorName} ${action} ${activity.entity.replace(/[_-]+/g, ' ')}`,
    occurredAt: activity.occurredAt,
  };
}

/**
 * Streams newly-created audit entries. Postgres RLS is applied by Realtime,
 * so regular members only receive their company's and their own events.
 */
export function subscribeToDashboardActivity(
  empresaId: string | null,
  userId: string,
  isPlatformAdmin: boolean,
  onNotification: (notification: DashboardLiveNotification) => void
): () => void {
  const channel = supabase.channel(`dashboard-activity:${userId}:${empresaId || 'personal'}`);
  const receiveAudit = (payload: { new: AuditRow }) => {
    const row = payload.new;
    const activity = mapActivity(row, row.usuario_id === userId ? 'Você' : 'Outro usuário');
    if (activity) onNotification(toLiveNotification(activity));
  };

  if (isPlatformAdmin) {
    // Platform admins are authorized by RLS to see system-wide audit activity.
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria' }, receiveAudit);
  } else {
    if (empresaId) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auditoria', filter: `empresa_id=eq.${empresaId}` },
        receiveAudit
      );
    }
    // RLS additionally limits this subscription to personal rows owned by the user.
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'auditoria', filter: `usuario_id=eq.${userId}` },
      receiveAudit
    );
  }

  if (isPlatformAdmin) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'gm_admin_audit' },
      (payload: { new: { id: string; action: string; created_at: string } }) => {
        onNotification({
          id: payload.new.id,
          title: `Administração: ${payload.new.action.replace(/[_-]+/g, ' ')}`,
          occurredAt: payload.new.created_at,
        });
      }
    );
  }

  void channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/**
 * Loads recent activity visible to the current authenticated user. Tenant
 * activity is filtered by the selected company and owner-only activity by the
 * current user's own actor id; PostgreSQL RLS enforces both boundaries too.
 */
export async function getRecentDashboardActivity(
  empresaId: string | null,
  limit = 8
): Promise<DashboardActivity[]> {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 8;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Não foi possível validar a sessão: ${authError.message}`);
  const userId = authData.user?.id;
  if (!userId) throw new Error('Entre na sua conta para consultar a atividade recente.');

  const personalRequest = supabase
    .from('auditoria')
    .select('id, empresa_id, usuario_id, acao, entidade, entidade_id, detalhes, criado_em')
    .is('empresa_id', null)
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
    .limit(safeLimit);
  const companyRequest = empresaId
    ? supabase
        .from('auditoria')
        .select('id, empresa_id, usuario_id, acao, entidade, entidade_id, detalhes, criado_em')
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false })
        .limit(safeLimit)
    : Promise.resolve({ data: [], error: null });

  const [personalResult, companyResult] = await Promise.all([personalRequest, companyRequest]);
  if (personalResult.error) {
    throw new Error(`Não foi possível carregar a atividade pessoal: ${personalResult.error.message}`);
  }
  if (companyResult.error) {
    throw new Error(`Não foi possível carregar a atividade da empresa: ${companyResult.error.message}`);
  }

  const rows = [...(personalResult.data || []), ...(companyResult.data || [])] as AuditRow[];
  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()]
    .sort((left, right) => Date.parse(right.criado_em) - Date.parse(left.criado_em))
    .slice(0, safeLimit);
  const actorIds = [...new Set(uniqueRows.flatMap((row) => row.usuario_id ? [row.usuario_id] : []))];

  let actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nome')
      .in('id', actorIds);
    // Profiles are subject to their own RLS; an unavailable third-party label
    // must not prevent the user from seeing the audit event itself.
    if (!profilesError) {
      actorNames = new Map((profiles || []).map((profile) => [profile.id, profile.nome || 'Usuário']));
    }
  }

  return uniqueRows.flatMap((row) => {
    const name = row.usuario_id === userId ? 'Você' : actorNames.get(row.usuario_id || '') || 'Outro usuário';
    const activity = mapActivity(row, name);
    return activity ? [activity] : [];
  });
}
