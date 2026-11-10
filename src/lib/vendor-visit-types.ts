import type { Endereco } from '@/lib/client-types';

export type VendorVisitStatus = 'solicitada' | 'aceita' | 'recusada' | 'em_deslocamento' | 'realizada' | 'cancelada';

export interface VendorVisit {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_endereco: Endereco;
  cliente_telefone: string | null;
  vendedor_id: string;
  vendedor_nome?: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  status: VendorVisitStatus;
  latitude_atual: number | null;
  longitude_atual: number | null;
  localizacao_atualizada_em: string | null;
  criado_em: string;
}

export interface CreateVendorVisit {
  empresa_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_endereco: Endereco;
  cliente_telefone?: string;
  vendedor_id: string;
  titulo: string;
  descricao?: string;
  data_hora: string;
  criado_por: string;
}

export const visitStatusLabel: Record<VendorVisitStatus, string> = {
  solicitada: 'Nova solicitação', aceita: 'Aceita', recusada: 'Recusada',
  em_deslocamento: 'A caminho', realizada: 'Realizada', cancelada: 'Cancelada',
};

export function formatAddress(address: Endereco) {
  return [address.logradouro, address.numero, address.complemento, address.bairro, address.cidade, address.estado, address.cep, address.pais]
    .filter(Boolean).join(', ');
}

export function getGoogleMapsDirectionsUrl(address: Endereco, origin?: { latitude: number; longitude: number } | null) {
  const destination = formatAddress(address);
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
