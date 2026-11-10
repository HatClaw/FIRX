import { useEffect, useState } from 'react';
import { Button, Input, Card, PageHeader, FileUpload } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function Perfil() {
  const { user, updateProfile } = useAuth();
  const [nome, setNome] = useState(user?.nome || '');
  const [msg, setMsg] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNome(user?.nome || '');
    setAvatarPreview(user?.avatar || '');
    setAvatarPath(undefined);
  }, [user?.id, user?.nome, user?.avatar]);

  const salvar = async () => {
    setSaving(true);
    setMsg('');
    try {
      await updateProfile(nome, avatarPath);
      setAvatarPath(undefined);
      setMsg('Perfil salvo no servidor.');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Falha ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Meu perfil" description="Dados pessoais e avatar" />
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand/15 text-brand flex items-center justify-center text-xl font-bold">
              {(nome || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold">{nome || user?.nome}</p>
            <p className="text-sm text-text-secondary">{user?.email}</p>
          </div>
        </div>
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div>
          <p className="text-sm font-medium mb-2">Foto de perfil</p>
          <FileUpload
            accept="image/*"
            categoria="fotos"
            label="Enviar foto de perfil"
            onUploaded={(files) => {
              const file = files[0];
              if (!file) return;
              setAvatarPath(file.caminho);
              setAvatarPreview(file.url);
              setMsg('Foto salva. Clique em Salvar para vinculá-la ao seu perfil.');
            }}
          />
        </div>
        <Button disabled={saving} onClick={() => void salvar()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        {msg && <p className={`text-sm ${msg.includes('Falha') || msg.includes('Não foi') ? 'text-erro' : 'text-brand'}`}>{msg}</p>}
      </Card>
    </div>
  );
}

