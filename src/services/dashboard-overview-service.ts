import { supabase } from '@/lib/supabase/client';

export interface DashboardOverview {
  receitaMensal: Array<{ mes: string; recebido: number; previsto: number }>;
  contratosPorStatus: Array<{ status: string; total: number }>;
  resumo: { clientes: number; contratos: number; parcelasAtrasadas: number; recebido: number; aReceber: number };
}

const monthName = (date: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');

export async function getDashboardOverview(empresaId: string | null): Promise<DashboardOverview> {
  if (!empresaId) return { receitaMensal: [], contratosPorStatus: [], resumo: { clientes: 0, contratos: 0, parcelasAtrasadas: 0, recebido: 0, aReceber: 0 } };

  const [clients, contracts, installments, entries] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    supabase.from('contratos').select('id,status,valor_total').eq('empresa_id', empresaId),
    supabase.from('parcelas').select('valor_previsto,valor_recebido,status,data_vencimento,data_pagamento').eq('empresa_id', empresaId),
    supabase.from('gm_financial_entries').select('valor,status,vencimento').eq('empresa_id', empresaId),
  ]);

  for (const result of [clients, contracts, installments, entries]) {
    if (result.error) throw new Error(`Não foi possível carregar os indicadores do dashboard: ${result.error.message}`);
  }

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return { date, mes: monthName(date), key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, recebido: 0, previsto: 0 };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  const installmentRows = installments.data || [];
  const entryRows = entries.data || [];

  installmentRows.forEach((row) => {
    const expectedDate = new Date(`${row.data_vencimento}T12:00:00`);
    const expected = monthMap.get(`${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}`);
    if (expected) expected.previsto += Number(row.valor_previsto || 0);
    if (row.data_pagamento && Number(row.valor_recebido) > 0) {
      const paidDate = new Date(`${row.data_pagamento}T12:00:00`);
      const paid = monthMap.get(`${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`);
      if (paid) paid.recebido += Number(row.valor_recebido);
    }
  });
  entryRows.forEach((row) => {
    const dueDate = new Date(`${row.vencimento}T12:00:00`);
    const month = monthMap.get(`${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`);
    if (!month) return;
    month.previsto += Number(row.valor || 0);
    if (row.status === 'pago') month.recebido += Number(row.valor || 0);
  });

  const contractsData = contracts.data || [];
  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho', revisao: 'Em revisão', enviado: 'Enviado',
    pendente_assinatura: 'Aguardando assinatura', assinado: 'Assinado', cancelado: 'Cancelado', expirado: 'Expirado',
  };
  const statusTotals = new Map<string, number>();
  contractsData.forEach((contract) => statusTotals.set(contract.status, (statusTotals.get(contract.status) || 0) + 1));
  const installmentsPaid = installmentRows.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0);
  const entriesPaid = entryRows.filter((row) => row.status === 'pago').reduce((sum, row) => sum + Number(row.valor || 0), 0);

  return {
    receitaMensal: months.map(({ mes, recebido, previsto }) => ({ mes, recebido, previsto })),
    contratosPorStatus: [...statusTotals].map(([status, total]) => ({ status: statusLabels[status] || status, total })),
    resumo: {
      clientes: clients.count || 0,
      contratos: contractsData.length,
      parcelasAtrasadas: installmentRows.filter((row) => row.status === 'atrasado').length + entryRows.filter((row) => row.status === 'atrasado').length,
      recebido: installmentsPaid + entriesPaid,
      aReceber: installmentRows.reduce((sum, row) => sum + Math.max(Number(row.valor_previsto || 0) - Number(row.valor_recebido || 0), 0), 0)
        + entryRows.filter((row) => row.status !== 'pago').reduce((sum, row) => sum + Number(row.valor || 0), 0),
    },
  };
}
