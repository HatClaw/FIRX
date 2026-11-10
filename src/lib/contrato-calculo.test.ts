import { describe, expect, it } from 'vitest';
import { calcularDescontoComercial, calcularItensContrato, gerarCronogramaParcelas, isValidCurrencyInput, mesesDaPeriodicidade, parseCurrencyInput } from './contrato-calculo';
import type { ServicoCatalogo } from './contratos-store';

const catalogo: ServicoCatalogo[] = [
  { id: 'mensal', nome: 'Gestão', categoria: 'mídia', valor: 100, tipo: 'mensal', ordem: 1, ativo: true },
  { id: 'unico', nome: 'Site', categoria: 'web', valor: 50, tipo: 'unico', ordem: 2, ativo: true },
  { id: 'bonus', nome: 'SEO bônus', categoria: 'seo', valor: 20, tipo: 'mensal', ordem: 3, ativo: true, bonus_permitido: true },
];

describe('cálculo do fechamento de contrato', () => {
  it('acumula automaticamente os serviços mensais pelo prazo anual e mantém os serviços únicos', () => {
    const result = calcularItensContrato(catalogo, ['mensal', 'unico'], [], 2, 12);
    expect(result.cobradoBruto).toBe(2500);
    expect(result.itens.map((item) => item.valor_total)).toEqual([2400, 100]);
  });

  it('aplica o bônus selecionado como valor zero e contabiliza sua economia comercial anual', () => {
    const result = calcularItensContrato(catalogo, ['mensal'], ['bonus'], 1, 12);
    expect(result.cobradoBruto).toBe(1200);
    expect(result.bonusTotal).toBe(240);
    expect(result.itens[1]).toMatchObject({ isBonus: true, valor: 0, valor_total: 0, valor_comercial_total: 240 });
  });

  it('interpreta valores brasileiros e decimais digitados com ponto', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
    expect(parseCurrencyInput('1234.56')).toBe(1234.56);
    expect(isValidCurrencyInput('1234.')).toBe(false);
    expect(isValidCurrencyInput('1.234,56')).toBe(true);
    expect(isValidCurrencyInput('valor inválido')).toBe(false);
    expect(parseCurrencyInput('')).toBe(0);
  });

  it('gera as datas das parcelas e preserva o ajuste da última parcela', () => {
    expect(gerarCronogramaParcelas('2026-01-31', 3, 10, 10.01)).toEqual([
      { numero: 1, data: '2026-01-31', valor: 10 },
      { numero: 2, data: '2026-02-28', valor: 10 },
      { numero: 3, data: '2026-03-31', valor: 10.01 },
    ]);
    expect(gerarCronogramaParcelas('2026-01-10', 3, 20, 20, 3).map((row) => row.data)).toEqual([
      '2026-01-10', '2026-04-10', '2026-07-10',
    ]);
    expect(gerarCronogramaParcelas('data-inválida', 3, 20, 20)).toEqual([]);
  });

  it('converte a periodicidade em prazo e intervalo de cobranças', () => {
    expect(['mensal', 'trimestral', 'semestral', 'anual'].map((periodo) => mesesDaPeriodicidade(periodo as 'mensal' | 'trimestral' | 'semestral' | 'anual'))).toEqual([1, 3, 6, 12]);
    expect(gerarCronogramaParcelas('2026-01-31', 3, 300, 300, mesesDaPeriodicidade('trimestral')).map((row) => row.data)).toEqual([
      '2026-01-31', '2026-04-30', '2026-07-31',
    ]);
  });

  it('calcula desconto por percentual ou valor fixo sem ultrapassar o total', () => {
    expect(calcularDescontoComercial(1000, 15, 'percentual')).toBe(150);
    expect(calcularDescontoComercial(1000, 150, 'valor')).toBe(150);
    expect(calcularDescontoComercial(1000, 125, 'percentual')).toBe(1000);
    expect(calcularDescontoComercial(1000, 1500, 'valor')).toBe(1000);
  });
});
