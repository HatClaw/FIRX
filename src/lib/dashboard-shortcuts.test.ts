import { describe, expect, it } from 'vitest';
import { getDefaultShortcutHrefs, moveShortcut, normalizeShortcutHrefs } from './dashboard-shortcuts';

describe('atalhos rápidos do dashboard', () => {
  it('usa seções disponíveis como padrão', () => {
    expect(getDefaultShortcutHrefs()).toEqual(['/clientes', '/contratos', '/agenda', '/financeiro']);
  });

  it('remove caminhos duplicados ou inválidos da preferência salva', () => {
    expect(normalizeShortcutHrefs(['/clientes', '/clientes', '/rota-inexistente'])).toEqual(['/clientes']);
  });

  it('reordena um atalho pela posição de destino', () => {
    expect(moveShortcut(['/clientes', '/contratos', '/agenda'], 0, 2))
      .toEqual(['/contratos', '/agenda', '/clientes']);
  });
});
