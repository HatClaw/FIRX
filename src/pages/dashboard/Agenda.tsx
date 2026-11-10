import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

type Evento = { id: string; title: string; data_hora: string; tipo: 'reuniao' | 'ligacao' | 'visita' | 'videoconferencia' | 'outro'; status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado' };
const emptyForm = { title: '', date: '', time: '09:00', tipo: 'reuniao' as Evento['tipo'] };
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function Agenda() {
  const { user, empresaAtiva, hasPermission } = useAuth();
  const { isAdmin } = useAdminAuth();
  const canManage = isAdmin || empresaAtiva?.role === 'admin';
  const [rows, setRows] = useState<Evento[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase.from('agenda')
      .select('id, title, data_hora, tipo, status')
      .eq('empresa_id', empresaAtiva.id)
      .order('data_hora', { ascending: true });
    if (loadError) setError(`Não foi possível carregar a agenda: ${loadError.message}`);
    else { setRows((data || []) as Evento[]); setError(''); }
    setLoading(false);
  }, [empresaAtiva?.id]);
  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.data_hora.localeCompare(b.data_hora)), [rows]);
  const salvar = async () => {
    if (!empresaAtiva?.id || !user?.id) { setError('Selecione uma empresa para agendar compromissos.'); return; }
    if (!form.title.trim() || !form.date) { setError('Informe o título e a data do compromisso.'); return; }
    setSaving(true); setError('');
    const dateTime = new Date(`${form.date}T${form.time || '09:00'}`);
    const { error: saveError } = await supabase.from('agenda').insert({
      empresa_id: empresaAtiva.id,
      responsavel_id: user.id,
      criado_por: user.id,
      title: form.title.trim(),
      tipo: form.tipo,
      data_hora: dateTime.toISOString(),
      data_fim: new Date(dateTime.getTime() + 60 * 60 * 1000).toISOString(),
      duracao_minutos: 60,
    });
    setSaving(false);
    if (saveError) { setError(`Não foi possível salvar o compromisso: ${saveError.message}`); return; }
    setOpen(false); setForm(emptyForm); await load();
  };
  const excluir = async (evento: Evento) => {
    if (!empresaAtiva?.id || !confirm(`Excluir o compromisso “${evento.title}”?`)) return;
    const { error: deleteError } = await supabase.from('agenda').delete().eq('id', evento.id).eq('empresa_id', empresaAtiva.id);
    if (deleteError) setError(`Não foi possível excluir o compromisso: ${deleteError.message}`);
    else await load();
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Agenda" description="Compromissos da equipe" actions={hasPermission('agendamentos:write') && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setError(''); setOpen(true); }}>Novo</Button>} />
      {error && !open && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="none">
          {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando agenda…</p> : sorted.length === 0 ? (
            <div className="p-8"><EmptyState title="Agenda vazia" description="Agende reuniões, visitas e ligações." icon={<CalendarIcon className="h-6 w-6" />} /></div>
          ) : <ul className="divide-y divide-border-color">{sorted.map((event) => (
            <li key={event.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg-secondary/40">
              <div className="w-14 shrink-0 text-center"><p className="text-xs text-text-secondary">{formatDate(event.data_hora)}</p><p className="text-sm font-semibold">{new Date(event.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{event.title}</p><p className="text-xs capitalize text-text-secondary">{event.tipo.replace('videoconferencia', 'videoconferência')}</p></div>
              <Badge variant={event.status === 'confirmado' || event.status === 'realizado' ? 'success' : event.status === 'cancelado' ? 'danger' : 'info'}>{event.status}</Badge>
              {canManage && <button type="button" aria-label={`Excluir ${event.title}`} className="rounded-lg p-2 hover:bg-erro/10" onClick={() => void excluir(event)}><Trash2 className="h-4 w-4 text-erro" /></button>}
            </li>
          ))}</ul>}
        </Card>
        <Card><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Resumo</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-text-secondary">Total</span><span className="font-semibold">{rows.length}</span></div><div className="flex justify-between"><span className="text-text-secondary">Agendados</span><span className="font-semibold">{rows.filter((row) => row.status === 'agendado').length}</span></div></div></Card>
      </div>
      {hasPermission('agendamentos:write') && <Modal open={open} onClose={() => setOpen(false)} title="Novo compromisso" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={() => void salvar()}>Agendar</Button></>}>
        <div className="space-y-4">
          <Input label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Data" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /><Input label="Hora" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Tipo</label><select className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Evento['tipo'] })}><option value="reuniao">Reunião</option><option value="ligacao">Ligação</option><option value="visita">Visita</option><option value="videoconferencia">Videoconferência</option><option value="outro">Outro</option></select></div>
          {error && <p className="text-sm text-erro" role="alert">{error}</p>}
        </div>
      </Modal>}
    </div>
  );
}
