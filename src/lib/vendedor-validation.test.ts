import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCpf, somenteDigitos } from './vendedor-validation';

describe('validação de dados pessoais do vendedor', () => {
  it('normaliza e formata CPF', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('valida os dígitos verificadores e rejeita sequências repetidas', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
});
