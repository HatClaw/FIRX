import { useEffect, useState } from 'react';
import { Button, Card, FileUpload, Input, PageHeader } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function Configuracoes() {
  const { user, empresaAtiva, refreshEmpresas } = useAuth();
  const { isAdmin } = useAdminAuth();
  const canManage = isAdmin || empresaAtiva?.role === 'admin';
  const [nomeEmpresa, setNomeEmpresa] = useState(empresaAtiva?.nome || '');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNomeEmpresa(empresaAtiva?.nome || '');
    setSaved('');
    if (!empresaAtiva?.id) { setLogoPath(null); return; }
    let active = true;
    void supabase.from('empresas').select('configuracoes').eq('id', empresaAtiva.id).maybeSingle().then(({ data }) => {
      if (active) setLogoPath((data?.configuracoes as Record<string, unknown> | null)?.logo_path as string || null);
    });
    return () => { active = false; };
  }, [empresaAtiva?.id, empresaAtiva?.nome]);

  const salvar = async () => {
    if (!empresaAtiva?.id || !user?.id) { setError('Sua conta ainda não está vinculada a uma empresa.'); return; }
    if (!nomeEmpresa.trim()) { setError('Informe o nome da empresa.'); return; }
    setSaving(true); setError(''); setSaved('');
    const { data: current, error: readError } = await supabase.from('empresas').select('configuracoes').eq('id', empresaAtiva.id).maybeSingle();
    if (readError || !current) {
      setError(`Não foi possível carregar as configurações da empresa: ${readError?.message || 'empresa não encontrada'}`);
      setSaving(false); return;
    }
    const configuracoes = { ...((current.configuracoes || {}) as Record<string, unknown>), logo_path: logoPath };
    const { data, error: saveError } = await supabase.from('empresas').update({ nome: nomeEmpresa.trim(), configuracoes, atualizado_em: new Date().toISOString() }).eq('id', empresaAtiva.id).select('id').maybeSingle();
    setSaving(false);
    if (saveError || !data) { setError(`Não foi possível salvar as configurações: ${saveError?.message || 'nenhum registro foi atualizado'}`); return; }
    await refreshEmpresas();
    setSaved('Alterações salvas no servidor.');
  };

  return <div className="max-w-3xl space-y-6">
    <PageHeader title="Configurações" description="Preferências da empresa e do workspace" />
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">Empresa</h2>
      <Input label="Nome da empresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} disabled={!canManage} />
      {canManage && <><div><p className="mb-2 text-sm font-medium">Logo</p><FileUpload accept="image/*" categoria="fotos" label="Enviar logo (PNG, SVG, JPG)" onUploaded={(files) => { if (files[0]) { setLogoPath(files[0].caminho); setSaved('Logo enviada. Salve as alterações para vinculá-la à empresa.'); } }} /></div>
      <Button loading={saving} onClick={() => void salvar()}>Salvar alterações</Button></>}
      {error && <p className="text-sm text-erro" role="alert">{error}</p>}
      {saved && <p className="text-sm text-brand" role="status">{saved}</p>}
    </Card>
    <Card className="space-y-2 p-5"><h2 className="font-semibold">Conta</h2><p className="text-sm text-text-secondary">Usuário: {user?.email || '—'}</p><p className="text-sm text-text-secondary">Papel: {empresaAtiva?.role || user?.role || '—'}</p></Card>
  </div>;
}
