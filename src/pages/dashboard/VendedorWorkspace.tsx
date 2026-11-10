import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Camera, Check, Clock3, FileSignature, LogOut, MapPin, Navigation, Phone, Plus, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Badge, Button, Card, FileUpload, Input, Modal } from '@/components/ui';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { listContratosRemotos, type ContratoLocal, formatBRL } from '@/lib/contratos-store';
import { formatAddress, getGoogleMapsDirectionsUrl, visitStatusLabel, type VendorVisit } from '@/lib/vendor-visit-types';
import { VendorVisitRepository } from '@/repositories/vendor-visit-repository';
import { VendorVisitService } from '@/services/vendor-visit-service';

type Area = 'visitas' | 'agenda' | 'contratos' | 'perfil';
type Compromisso = { id: string; title: string; data_hora: string; tipo: 'reuniao' | 'ligacao' | 'visita' | 'videoconferencia' | 'outro'; status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado' };
const emptyAppointment = { title: '', date: '', time: '09:00', tipo: 'reuniao' as Compromisso['tipo'] };
const shortTime = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

export default function VendedorWorkspace() {
  const { user, logout, updateProfile } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [visits, setVisits] = useState<VendorVisit[]>([]);
  const [appointments, setAppointments] = useState<Compromisso[]>([]);
  const [contracts, setContracts] = useState<ContratoLocal[]>([]);
  const [area, setArea] = useState<Area>('visitas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyVisit, setBusyVisit] = useState<string | null>(null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [profileName, setProfileName] = useState(user?.nome || '');
  const [avatarPath, setAvatarPath] = useState<string | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const gpsWatch = useRef<number | null>(null);
  const gpsVisit = useRef<string | null>(null);
  const lastWrite = useRef<Record<string, number>>({});
  const noticeTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 5000);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) { setVisits([]); setAppointments([]); setContracts([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: lookupError } = await supabase.from('vendedores').select('id').eq('usuario_id', user.id).eq('status', 'ativo').maybeSingle();
      if (lookupError) throw lookupError;
      if (!data?.id) { setSellerId(null); setVisits([]); setAppointments([]); setContracts([]); setError('Seu usuário ainda não está vinculado a um cadastro ativo de vendedor. Fale com o administrador.'); return; }
      setSellerId(data.id);
      const [nextVisits, nextAppointments, nextContracts] = await Promise.all([
        VendorVisitService.listForSeller(data.id),
        user.empresa_id ? supabase.from('agenda').select('id,title,data_hora,tipo,status').eq('empresa_id', user.empresa_id).eq('responsavel_id', user.id).order('data_hora', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        listContratosRemotos(),
      ]);
      if (nextAppointments.error) throw nextAppointments.error;
      setVisits(nextVisits);
      setAppointments((nextAppointments.data || []) as Compromisso[]);
      setContracts(nextContracts);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados do app.'); }
    finally { setLoading(false); }
  }, [user?.id, user?.empresa_id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setProfileName(user?.nome || ''); setAvatarPreview(user?.avatar || ''); setAvatarPath(undefined); }, [user?.id, user?.nome, user?.avatar]);
  useEffect(() => () => { if (gpsWatch.current !== null) navigator.geolocation?.clearWatch(gpsWatch.current); if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    if (!sellerId || !user?.empresa_id) return;
    const channel = VendorVisitRepository.subscribe(user.empresa_id, () => { void load(); showNotice('Sua lista de visitas foi atualizada.'); });
    return () => { void supabase.removeChannel(channel); };
  }, [sellerId, user?.empresa_id, load, showNotice]);

  const accept = async (visit: VendorVisit, status: 'aceita' | 'recusada') => {
    setBusyVisit(visit.id); setError('');
    try { await VendorVisitService.updateStatus(visit.id, status); await load(); showNotice(status === 'aceita' ? 'Visita aceita.' : 'Visita recusada.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a visita.'); }
    finally { setBusyVisit(null); }
  };

  const startRoute = (visit: VendorVisit) => {
    if (!navigator.geolocation) { setError('Este navegador não oferece acesso ao GPS.'); return; }
    setBusyVisit(visit.id); setError('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await VendorVisitService.updateStatus(visit.id, 'em_deslocamento');
        await VendorVisitService.updateLocation(visit.id, position.coords.latitude, position.coords.longitude);
        if (gpsWatch.current !== null) navigator.geolocation.clearWatch(gpsWatch.current);
        gpsVisit.current = visit.id;
        gpsWatch.current = navigator.geolocation.watchPosition((current) => {
          const now = Date.now();
          if (now - (lastWrite.current[visit.id] || 0) < 5000 || gpsVisit.current !== visit.id) return;
          lastWrite.current[visit.id] = now;
          void VendorVisitService.updateLocation(visit.id, current.coords.latitude, current.coords.longitude).catch((cause) => setError(cause instanceof Error ? cause.message : 'Falha ao atualizar GPS.'));
        }, (cause) => setError(`GPS: ${cause.message}`), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        window.open(getGoogleMapsDirectionsUrl(visit.cliente_endereco, { latitude: position.coords.latitude, longitude: position.coords.longitude }), '_blank', 'noopener,noreferrer');
        await load(); showNotice('GPS ativo durante este deslocamento.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a rota.'); }
      finally { setBusyVisit(null); }
    }, (cause) => { setBusyVisit(null); setError(`Não foi possível acessar sua localização: ${cause.message}`); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const complete = async (visit: VendorVisit) => {
    setBusyVisit(visit.id); setError('');
    try {
      await VendorVisitService.updateStatus(visit.id, 'realizada');
      if (gpsWatch.current !== null && gpsVisit.current === visit.id) { navigator.geolocation.clearWatch(gpsWatch.current); gpsWatch.current = null; gpsVisit.current = null; }
      await load(); showNotice('Visita concluída.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a visita.'); }
    finally { setBusyVisit(null); }
  };

  const openRoute = (visit: VendorVisit) => {
    const origin = visit.latitude_atual !== null && visit.longitude_atual !== null ? { latitude: visit.latitude_atual, longitude: visit.longitude_atual } : null;
    window.open(getGoogleMapsDirectionsUrl(visit.cliente_endereco, origin), '_blank', 'noopener,noreferrer');
  };

  const saveAppointment = async () => {
    if (!user?.id || !user.empresa_id || !appointmentForm.title.trim() || !appointmentForm.date) { setError('Informe empresa, título e data do compromisso.'); return; }
    setSavingAppointment(true); setError('');
    const start = new Date(`${appointmentForm.date}T${appointmentForm.time || '09:00'}`);
    const { error: saveError } = await supabase.from('agenda').insert({ empresa_id: user.empresa_id, responsavel_id: user.id, criado_por: user.id, title: appointmentForm.title.trim(), tipo: appointmentForm.tipo, data_hora: start.toISOString(), data_fim: new Date(start.getTime() + 60 * 60 * 1000).toISOString(), duracao_minutos: 60 });
    setSavingAppointment(false);
    if (saveError) { setError(`Não foi possível salvar o compromisso: ${saveError.message}`); return; }
    setAppointmentOpen(false); setAppointmentForm(emptyAppointment); await load(); showNotice('Compromisso adicionado à sua agenda.');
  };

  const saveProfile = async () => {
    setSavingProfile(true); setError('');
    try { await updateProfile(profileName, avatarPath); setAvatarPath(undefined); showNotice('Perfil atualizado.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o perfil.'); }
    finally { setSavingProfile(false); }
  };

  const tabs = useMemo(() => [
    { id: 'visitas' as const, label: 'Visitas', icon: MapPin, count: visits.filter((visit) => !['realizada', 'recusada', 'cancelada'].includes(visit.status)).length },
    { id: 'agenda' as const, label: 'Agenda', icon: CalendarDays, count: appointments.filter((event) => !['realizado', 'cancelado'].includes(event.status)).length },
    { id: 'contratos' as const, label: 'Contratos', icon: FileSignature, count: contracts.length },
    { id: 'perfil' as const, label: 'Perfil', icon: UserRound },
  ], [visits, appointments, contracts]);

  return (
    <main className="vendor-shell min-h-dvh bg-bg-secondary text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-color bg-bg-primary/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <BrandLogo linkTo={false} heightClass="h-10" className="max-w-[140px]" />
          <div className="flex items-center gap-3">
            {user?.avatar && <img src={user.avatar} alt="Foto do perfil" className="h-9 w-9 rounded-full border border-border-color object-cover" />}
            <span className="hidden text-sm text-text-secondary sm:block">Olá, {user?.nome}</span>
            <InstallPwaButton className="min-h-9 px-3 py-2 text-xs" />
            <Button variant="ghost" size="sm" aria-label="Sair" onClick={() => void logout()}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-12 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#ff6a00] to-[#db4d00] p-5 text-white shadow-lg shadow-brand/20 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/80">GROW • VENDEDOR</p><h1 className="mt-1 text-2xl sm:text-3xl">Olá, {user?.nome?.split(' ')[0] || 'vendedor'}</h1><p className="mt-2 max-w-xl text-sm text-white/85">Acesse suas visitas, compromissos, contratos e perfil.</p></div><div className="overflow-hidden rounded-full border-2 border-white/40 bg-white/15 p-1">{user?.avatar ? <img src={user.avatar} alt="Foto do perfil" className="h-12 w-12 rounded-full object-cover" /> : <UserRound className="m-2 h-8 w-8" />}</div></div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-white/15 px-3 py-1">{visits.filter((visit) => !['realizada', 'recusada', 'cancelada'].includes(visit.status)).length} visitas pendentes</span><span className="rounded-full bg-white/15 px-3 py-1">{appointments.filter((event) => !['realizado', 'cancelado'].includes(event.status)).length} compromissos</span><span className="rounded-full bg-white/15 px-3 py-1">{contracts.length} contratos</span></div>
        </div>
        <nav aria-label="Áreas do app do vendedor" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" onClick={() => { setArea(id); setError(''); }} aria-current={area === id ? 'page' : undefined} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${area === id ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-border-color bg-bg-primary text-text-secondary hover:border-brand/50'}`}><Icon className="h-4 w-4" />{label}{count !== undefined && <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs">{count}</span>}</button>)}
        </nav>
        {notice && <p role="status" className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm font-medium">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-erro/30 bg-erro/10 p-3 text-sm text-erro">{error}</p>}
        {loading ? <Card><p className="text-center text-sm text-text-secondary">Carregando seu app…</p></Card> : !sellerId ? <Card><div className="py-6 text-center text-sm text-text-secondary">O cadastro precisa ser vinculado pelo administrador.</div></Card> : <>
          {area === 'visitas' && (visits.length === 0 ? <Card><div className="py-10 text-center"><MapPin className="mx-auto mb-3 h-8 w-8 text-brand" /><p className="font-semibold">Você está em dia</p><p className="mt-1 text-sm text-text-secondary">Nenhuma visita foi enviada para você.</p></div></Card> : <div className="space-y-4">{visits.map((visit) => <Card key={visit.id} className="space-y-4 border-l-4 border-l-brand p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-wide text-brand">{visitStatusLabel[visit.status]}</span><h2 className="mt-1 text-xl">{visit.titulo}</h2></div><div className="flex items-center gap-1 text-xs text-text-secondary"><Clock3 className="h-4 w-4" />{shortTime(visit.data_hora)}</div></div><div className="rounded-2xl bg-bg-secondary p-4"><p className="font-semibold">{visit.cliente_nome}</p><p className="mt-1 text-sm text-text-secondary">{formatAddress(visit.cliente_endereco)}</p>{visit.cliente_telefone && <a className="mt-2 inline-flex items-center gap-2 text-sm text-brand" href={`tel:${visit.cliente_telefone}`}><Phone className="h-4 w-4" />{visit.cliente_telefone}</a>}{visit.descricao && <p className="mt-3 text-sm">{visit.descricao}</p>}</div>{visit.latitude_atual !== null && visit.longitude_atual !== null && <p className="text-xs text-text-secondary">Sua posição sincronizada: {visit.localizacao_atualizada_em ? new Date(visit.localizacao_atualizada_em).toLocaleTimeString('pt-BR') : 'GPS ativo'}</p>}<div className="flex flex-wrap gap-2">{visit.status === 'solicitada' && <><Button loading={busyVisit === visit.id} leftIcon={<Check className="h-4 w-4" />} onClick={() => void accept(visit, 'aceita')}>Aceitar</Button><Button variant="outline" loading={busyVisit === visit.id} leftIcon={<X className="h-4 w-4" />} onClick={() => void accept(visit, 'recusada')}>Recusar</Button></>}{visit.status === 'aceita' && <Button loading={busyVisit === visit.id} leftIcon={<Navigation className="h-4 w-4" />} onClick={() => startRoute(visit)}>Iniciar rota com GPS</Button>}{visit.status === 'em_deslocamento' && <><Button leftIcon={<Navigation className="h-4 w-4" />} onClick={() => openRoute(visit)}>Abrir rota novamente</Button><Button variant="outline" loading={busyVisit === visit.id} leftIcon={<Check className="h-4 w-4" />} onClick={() => void complete(visit)}>Concluir visita</Button></>}{['solicitada', 'aceita'].includes(visit.status) && <Button variant="outline" leftIcon={<MapPin className="h-4 w-4" />} onClick={() => openRoute(visit)}>Ver endereço</Button>}</div></Card>)}</div>)}
          {area === 'agenda' && <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Sua agenda</h2><p className="text-sm text-text-secondary">Compromissos vinculados ao seu usuário.</p></div><Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setError(''); setAppointmentOpen(true); }}>Novo compromisso</Button></div>{appointments.length === 0 ? <Card><div className="py-10 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-brand" /><p className="font-semibold">Agenda vazia</p><p className="mt-1 text-sm text-text-secondary">Adicione reuniões, ligações ou visitas.</p></div></Card> : <Card padding="none"><ul className="divide-y divide-border-color">{appointments.map((event) => <li key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="min-w-24 rounded-xl bg-bg-secondary px-3 py-2 text-center"><p className="text-xs text-text-secondary">{new Date(event.data_hora).toLocaleDateString('pt-BR')}</p><p className="font-semibold">{new Date(event.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div><div className="min-w-0 flex-1"><p className="font-medium">{event.title}</p><p className="text-xs capitalize text-text-secondary">{event.tipo.replace('videoconferencia', 'videoconferência')}</p></div><Badge variant={event.status === 'confirmado' || event.status === 'realizado' ? 'success' : event.status === 'cancelado' ? 'danger' : 'info'}>{event.status}</Badge></li>)}</ul></Card>}</div>}
          {area === 'contratos' && <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Seus contratos</h2><p className="text-sm text-text-secondary">Os registros exibidos pertencem à sua conta.</p></div><Link to="/vendedor/contrato"><Button leftIcon={<Plus className="h-4 w-4" />}>Criar contrato</Button></Link></div>{contracts.length === 0 ? <Card><div className="py-10 text-center"><FileSignature className="mx-auto mb-3 h-8 w-8 text-brand" /><p className="font-semibold">Nenhum contrato criado</p><p className="mt-1 text-sm text-text-secondary">Crie um contrato para iniciar sua carteira.</p></div></Card> : <div className="space-y-3">{contracts.map((contract) => <Card key={contract.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">CT-{String(contract.numero).padStart(4, '0')} · {contract.cliente_nome}</p><p className="mt-1 text-sm text-text-secondary">{formatBRL(contract.valor)} · {contract.parcelas}x de {formatBRL(contract.valor_parcela)}</p></div><Badge variant={contract.status === 'assinado' ? 'success' : contract.status === 'cancelado' ? 'danger' : 'info'}>{contract.status}</Badge></Card>)}</div>}</div>}
          {area === 'perfil' && <Card className="mx-auto max-w-2xl space-y-5 p-5 sm:p-6"><div><h2 className="text-xl font-semibold">Seu perfil</h2><p className="mt-1 text-sm text-text-secondary">Atualize sua foto e o nome exibido no sistema.</p></div><div className="flex items-center gap-4">{avatarPreview ? <img src={avatarPreview} alt="Foto do perfil" className="h-20 w-20 rounded-full border border-border-color object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand"><UserRound className="h-9 w-9" /></div>}<div><p className="font-semibold">{profileName || user?.nome}</p><p className="text-sm text-text-secondary">{user?.email}</p></div></div><Input label="Nome" value={profileName} onChange={(event) => setProfileName(event.target.value)} /><div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><Camera className="h-4 w-4" />Foto de perfil</p><FileUpload accept="image/jpeg,image/png,image/webp" categoria="fotos" label="Escolher ou fotografar uma imagem" maxSizeMb={5} onUploaded={(files) => { const file = files[0]; if (!file) return; setAvatarPath(file.caminho); setAvatarPreview(file.url); }} /></div><Button loading={savingProfile} disabled={savingProfile || !profileName.trim()} onClick={() => void saveProfile()}>Salvar perfil</Button></Card>}
        </>}
        <p className="text-center text-xs text-text-secondary">A localização só é acessada após tocar em “Iniciar rota” e enquanto a visita estiver em deslocamento.</p>
      </section>
      <Modal open={appointmentOpen} onClose={() => setAppointmentOpen(false)} title="Novo compromisso" footer={<><Button variant="outline" onClick={() => setAppointmentOpen(false)}>Cancelar</Button><Button loading={savingAppointment} onClick={() => void saveAppointment()}>Agendar</Button></>}><div className="space-y-4"><Input label="Título" value={appointmentForm.title} onChange={(event) => setAppointmentForm({ ...appointmentForm, title: event.target.value })} required /><div className="grid gap-3 sm:grid-cols-2"><Input label="Data" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required /><Input label="Hora" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm({ ...appointmentForm, time: event.target.value })} /></div><div><label className="mb-1.5 block text-sm font-medium">Tipo</label><select className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={appointmentForm.tipo} onChange={(event) => setAppointmentForm({ ...appointmentForm, tipo: event.target.value as Compromisso['tipo'] })}><option value="reuniao">Reunião</option><option value="ligacao">Ligação</option><option value="visita">Visita</option><option value="videoconferencia">Videoconferência</option><option value="outro">Outro</option></select></div></div></Modal>
    </main>
  );
}

