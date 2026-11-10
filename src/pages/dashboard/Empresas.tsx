import { useMemo, useState } from 'react';
import { Building2, Download, FileText, Plus, Search } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { EmpresaForm, type EmpresaFormData } from '@/components/forms/EmpresaForm';
import { useAuth } from '@/contexts/AuthContext';
import { EmpresaService } from '@/services/empresa-service';
import { exportCsv, exportPdf } from '@/lib/export';

export default function Empresas() {
  const { empresas, user, refreshEmpresas } = useAuth();
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => empresas.filter((empresa) =>
      empresa.nome.toLowerCase().includes(busca.toLowerCase()) || (empresa.cnpj || '').includes(busca)
    ),
    [empresas, busca]
  );

  const save = async (data: EmpresaFormData) => {
    if (!user) throw new Error('Entre novamente para cadastrar uma empresa.');
    setSaving(true);
    setError('');
    try {
      await EmpresaService.createEmpresa(data, user.id);
      await refreshEmpresas();
      setOpen(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível salvar a empresa.';
      setError(message);
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader
        title="Empresas"
        description="Organizações às quais sua conta tem acesso"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCsv('empresas', filtered.map((empresa) => ({ Nome: empresa.nome, CNPJ: empresa.cnpj || '' })))}>
              CSV
            </Button>
            <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4" />} onClick={() => exportPdf('Empresas — Grow Money', `<table><thead><tr><th>Nome</th><th>CNPJ</th></tr></thead><tbody>${filtered.map((empresa) => `<tr><td>${empresa.nome}</td><td>${empresa.cnpj || ''}</td></tr>`).join('')}</tbody></table>`)}>
              PDF
            </Button>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Nova empresa
            </Button>
          </div>
        }
      />

      {error && <p className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro" role="alert">{error}</p>}

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-border-color p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
            <Input placeholder="Buscar empresa..." value={busca} onChange={(event) => setBusca(event.target.value)} className="pl-10" />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title="Nenhuma empresa" description="Cadastre uma empresa para começar a operar." icon={<Building2 className="h-6 w-6" />} />
          </div>
        ) : (
          <ul className="divide-y divide-border-color">
            {filtered.map((empresa) => (
              <li key={empresa.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{empresa.nome}</span>
                <span className="text-sm text-text-secondary">CNPJ: {empresa.cnpj || 'não informado'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Cadastrar empresa" size="lg">
        <EmpresaForm onSubmit={save} loading={saving} />
      </Modal>
    </div>
  );
}
