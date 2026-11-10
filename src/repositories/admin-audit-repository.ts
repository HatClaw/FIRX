import { supabase } from '@/lib/supabase/client';

export type AdminAuditEvent = {
  id: string;
  admin_user_id: string;
  email: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export async function listAdminAuditEvents(limit = 100): Promise<AdminAuditEvent[]> {
  const { data, error } = await supabase.rpc('admin_list_audit', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data || []) as AdminAuditEvent[];
}
