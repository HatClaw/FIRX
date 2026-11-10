import { addMonths, type ContratoItem, type ServicoCatalogo } from '@/lib/contratos-store';

export type PeriodicidadeContrato = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export function mesesDaPeriodicidade(periodicidade: PeriodicidadeContrato | null | undefined) {
  switch (periodicidade) {
    case 'trimestral': return 3;
    case 'semestral': return 6;
    case 'anual': return 12;
    default: return 1;
  }
}

export function calcularDescontoComercial(valorTabela: number, valorInformado: number, modo: 'valor' | 'percentual') {
  const base = Math.max(0, Number(valorTabela) || 0);
  const informado = Math.max(0, Number(valorInformado) || 0);
  const bruto = modo === 'percentual' ? base * (Math.min(100, informado) / 100) : informado;
  return Math.round(Math.min(base, bruto) * 100) / 100;
}

export function gerarCronogramaParcelas(
  dataPrimeiraParcela: string,
  quantidade: number,
  valorParcela: number,
  valorUltimaParcela: number,
  intervaloMeses = 1,
) {
  const total = Math.min(99, Math.max(1, Math.floor(Number(quantidade) || 1)));
  const intervalo = Math.max(1, Math.floor(Number(intervaloMeses) || 1));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrimeiraParcela) || Number.isNaN(Date.parse(`${dataPrimeiraParcela}T12:00:00`))) return [];
  return Array.from({ length: total }, (_, index) => ({
    numero: index + 1,
    data: addMonths(dataPrimeiraParcela, index * intervalo),
    valor: index === total - 1 ? valorUltimaParcela : valorParcela,
  }));
}

export function parseCurrencyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '');
  if (!normalized) return 0;
  const decimal = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(normalized) ? normalized.replace(/\./g, '') : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function isValidCurrencyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '');
  return !normalized || /^\d+(?:[,.]\d{1,2})?$/.test(normalized) || /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
}

export function calcularItensContrato(
  servicos: ServicoCatalogo[],
  selecionados: string[],
  bonusIds: string[],
  unidades: number,
  prazoMeses: number,
) {
  let cobradoBruto = 0;
  let bonusTotal = 0;
  const quantidade = Math.max(1, Math.floor(unidades) || 1);
  const prazo = Math.max(1, Math.floor(prazoMeses) || 1);
  const itens: ContratoItem[] = servicos
    .filter((service) => selecionados.includes(service.id) || bonusIds.includes(service.id))
    .map((service) => {
      const isBonus = bonusIds.includes(service.id) && !selecionados.includes(service.id) && service.bonus_permitido !== false;
      const mesesCobrados = service.tipo === 'mensal' ? prazo : 1;
      const valorComercialTotal = Math.round(Math.max(0, Number(service.valor) || 0) * quantidade * mesesCobrados * 100) / 100;
      const valorTotal = isBonus ? 0 : valorComercialTotal;
      if (isBonus) bonusTotal += valorComercialTotal;
      else cobradoBruto += valorTotal;
      return {
        servico_id: service.id,
        nome: service.nome,
        valor: isBonus ? 0 : Math.max(0, Number(service.valor) || 0),
        tipo: service.tipo,
        isBonus,
        quantidade,
        valor_total: valorTotal,
        ...(isBonus ? { valor_comercial_total: valorComercialTotal } : {}),
        prazo_meses: mesesCobrados,
      };
    });
  return { itens, cobradoBruto, bonusTotal };
}
