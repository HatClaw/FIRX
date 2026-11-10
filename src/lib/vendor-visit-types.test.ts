import { describe, expect, it } from 'vitest';
import { formatAddress, getGoogleMapsDirectionsUrl } from './vendor-visit-types';

describe('rotas de visita do vendedor', () => {
  it('formata o endereço registrado do cliente', () => {
    expect(formatAddress({ logradouro: 'Rua A', numero: '12', cidade: 'São Paulo', estado: 'SP' }))
      .toBe('Rua A, 12, São Paulo, SP');
  });

  it('gera URL oficial do Google Maps com destino e origem GPS opcional', () => {
    const url = new URL(getGoogleMapsDirectionsUrl({ cidade: 'São Paulo', estado: 'SP' }, { latitude: -23.5, longitude: -46.6 }));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('-23.5,-46.6');
    expect(url.searchParams.get('destination')).toBe('São Paulo, SP');
  });
});
