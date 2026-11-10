import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, MapPin, Plus, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, PageHeader } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { formatAddress, getGoogleMapsDirectionsUrl, visitStatusLabel, type VendorVisit } from '@/lib/vendor-visit-types';
import { VendorVisitRepository } from '@/repositories/vendor-visit-repository';
import { VendorVisitService } from '@/services/vendor-visit-service';

type SelectOption = { id: string; nome: string; email?: string; documento?: string; endereco?: any; cep?: string; telefone?: string };

export default function Visitas() {
  const { user, empresaAtiva } = useAuth();
  const role = empresaAtiva?.role || user?.role || '';
  const canCreate = role === 'admin';
  const [visitas, setVisitas] = useState<VendorVisit[]>([]);
  const [clientes, setClientes] = useState<SelectOption[]>([]);
  const [vendedores, setVendedores] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clienteId: '', vendedorId: '', titulo: 'Visita comercial', descricao: '', date: '', hora: '09:00' });

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) { setVisitas([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [rows, clients, sellers] = await Promise.all([
        VendorVisitService.listForCompany(empresaAtiva.id, role),
        supabase.from('clients').select('id,nome,documento,endereco,cep,telefone').eq('empresa_id', empresaAtiva.id).order('nome'),
        supabase.from('vendedores').select('id,nome,email').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo').order('nome'),
      ]);
      setVisitas(rows);
      setClientes((clients.data || []).map((item: any) => ({ ...item, endereco: item.endereco || (item.cep ? { cep: item.cep } : {}) })));
      setVendedores((sellers.data || []) as SelectOption[]);
      setError(clients.error?.message || sellers.error?.message || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar visitas.'); }
    finally { setLoading(false); }
  }, [empresaAtiva?.id, role]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    const channel = VendorVisitRepository.subscribe(empresaAtiva.id, () => { void load(); });
    return () => { void supabase.removeChannel(channel); };
  }, [empresaAtiva?.id, load]);

  const create = async () => {
    const client = clientes.find(({ id }) => id === form.clienteId);
    if (!client || !form.vendedorId || !form.date || !empresaAtiva?.id || !user?.id) {
      setError('Escolha um cliente, um vendedor e a data e hora da visita.'); return;
    }
    setSaving(true); setError('');
    try {
      const address = { ...(client.endereco || {}), cep: client.endereco?.cep || client.cep };
      if (!formatAddress(address)) throw new Error('Cadastre o endereço do cliente antes de agendar a visita.');
      await VendorVisitService.create({
        empresa_id: empresaAtiva.id, cliente_id: client.id, cliente_nome: client.nome,
        cliente_endereco: address, cliente_telefone: client.telefone, vendedor_id: form.vendedorId,
        titulo: form.titulo.trim() || 'Visita comercial', descricao: form.descricao.trim() || undefined,
        data_hora: new Date(`${form.date}T${form.hora || '09:00'}`).toISOString(), criado_por: user.id,
      }, role);
      setOpen(false); setForm({ clienteId: '', vendedorId: '', titulo: 'Visita comercial', descricao: '', date: '', hora: '09:00' });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a visita.'); }
    finally { setSaving(false); }
  };

  const updateVisit = async (visit: VendorVisit, action: 'editar' | 'cancelar') => {
    if (!canCreate || !empresaAtiva?.id) return;
    if (action === 'cancelar') {
      if (!window.confirm(`Cancelar a visita para ${visit.cliente_nome}?`)) return;
      const { error: updateError } = await supabase.from('vendedor_visitas').update({ status: 'cancelada' }).eq('id', visit.id).eq('empresa_id', empresaAtiva.id);
      if (updateError) setError(updateError.message); else await load();
      return;
    }
    const title = window.prompt('Título da visita', visit.titulo);
    if (title === null) return;
    const date = window.prompt('Data e hora (AAAA-MM-DD HH:MM)', new Date(visit.data_hora).toLocaleString('sv-SE').replace('T', ' '));
    if (date === null) return;
    const parsedDate = new Date(date.replace(' ', 'T'));
    if (!title.trim() || Number.isNaN(parsedDate.getTime())) { setError('Informe um título e uma data válida.'); return; }
    const { error: updateError } = await supabase.from('vendedor_visitas').update({ titulo: title.trim(), data_hora: parsedDate.toISOString() }).eq('id', visit.id).eq('empresa_id', empresaAtiva.id);
    if (updateError) setError(updateError.message); else await load();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader title="Visitas de campo" description="Envie visitas aos vendedores e acompanhe o deslocamento em tempo real."
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Atualizar</Button>{canCreate && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setError(''); setOpen(true); }}>Enviar visita</Button>}</div>} />
      {error && <p role="alert" className="rounded-xl border border-erro/30 bg-erro/10 p-3 text-sm text-erro">{error}</p>}
      {loading ? <Card><p className="text-center text-sm text-text-secondary">Carregando visitas…</p></Card> : visitas.length === 0 ? <Card><div className="py-12 text-center"><MapPin className="mx-auto mb-3 h-8 w-8 text-brand"/><p className="font-semibold">Nenhuma visita agendada</p><p className="mt-1 text-sm text-text-secondary">As visitas criadas para sua equipe aparecerão aqui.</p></div></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visitas.map((visit) => (
          <Card key={visit.id} className="space-y-4 border-l-4 border-l-brand">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-brand">{visitStatusLabel[visit.status]}</p><h2 className="mt-1 truncate text-lg">{visit.titulo}</h2></div><Badge variant={visit.status === 'realizada' ? 'success' : visit.status === 'cancelada' || visit.status === 'recusada' ? 'danger' : 'info'}>{visitStatusLabel[visit.status]}</Badge></div>
            <div className="space-y-1 text-sm"><p className="font-semibold">{visit.cliente_nome}</p><p className="text-text-secondary">{formatAddress(visit.cliente_endereco)}</p><p className="text-text-secondary">Vendedor: {visit.vendedor_nome || '—'}</p><p className="text-text-secondary">{new Date(visit.data_hora).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</p>{visit.descricao && <p className="text-text-secondary">{visit.descricao}</p>}</div>
            {visit.latitude_atual !== null && visit.longitude_atual !== null && <p className="rounded-lg bg-bg-secondary p-2 text-xs text-text-secondary">GPS recebido {visit.localizacao_atualizada_em ? new Date(visit.localizacao_atualizada_em).toLocaleTimeString('pt-BR') : ''}</p>}
            <div className="flex flex-wrap gap-2"><a href={getGoogleMapsDirectionsUrl(visit.cliente_endereco, visit.latitude_atual !== null && visit.longitude_atual !== null ? { latitude: visit.latitude_atual, longitude: visit.longitude_atual } : null)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4"/>Ver rota</a>{canCreate && <><Button variant="outline" size="sm" onClick={() => void updateVisit(visit, 'editar')}>Editar</Button>{visit.status !== 'realizada' && visit.status !== 'cancelada' && <Button variant="danger" size="sm" onClick={() => void updateVisit(visit, 'cancelar')}>Cancelar</Button>}</>}</div>
          </Card>
        ))}</div>
      )}
      {canCreate && <Modal open={open} onClose={() => setOpen(false)} title="Enviar visita ao vendedor" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Voltar</Button><Button loading={saving} onClick={() => void create()}>Enviar solicitação</Button></>}>
        <div className="space-y-4">
          <div><label htmlFor="visit-client" className="mb-1.5 block text-sm font-medium">Cliente</label><select id="visit-client" className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}><option value="">Selecione um cliente</option>{clientes.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}</select></div>
          <div><label htmlFor="visit-seller" className="mb-1.5 block text-sm font-medium">Vendedor</label><select id="visit-seller" className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.vendedorId} onChange={(e) => setForm({ ...form, vendedorId: e.target.value })}><option value="">Selecione um vendedor</option>{vendedores.map((seller) => <option key={seller.id} value={seller.id}>{seller.nome}</option>)}</select></div>
          <Input label="Assunto" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Data" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /><Input label="Hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required /></div>
          <div><label htmlFor="visit-notes" className="mb-1.5 block text-sm font-medium">Orientações</label><textarea id="visit-notes" className="min-h-24 w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          {error && <p role="alert" className="text-sm text-erro">{error}</p>}
        </div>
      </Modal>}
    </div>
  );
}
