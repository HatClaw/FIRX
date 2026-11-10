import { useState } from 'react';
import { User, Mail, Phone, MessageCircle, Fingerprint, Target, Percent, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Vendedor, CreateVendedorData } from '@/lib/servico-types';

interface VendedorFormProps {
  initialData?: Partial<Vendedor>;
  onSubmit: (data: Omit<CreateVendedorData, 'empresa_id'> & { empresa_id?: string; status?: 'ativo' | 'inativo' | 'suspenso' }, isEdit: boolean) => Promise<void>;
  empresaId?: string;
  isEdit?: boolean;
  loading?: boolean;
}

const ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'operador', label: 'Operador' },
];

const STATUS_VENDEDOR: { value: string; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'suspenso', label: 'Suspenso' },
];

export function VendedorForm({ initialData, onSubmit, empresaId, isEdit = false, loading: externalLoading }: VendedorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<string>(initialData?.role || 'vendedor');
  const [status, setStatus] = useState<string>(initialData?.status || 'ativo');
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    email: initialData?.email || '',
    telefone: initialData?.telefone || '',
    whatsapp: initialData?.whatsapp || '',
    identificador_interno: initialData?.identificador_interno || '',
    meta_mensal: initialData?.meta_mensal?.toString() || '',
    comissao_padrao: initialData?.comissao_padrao?.toString() || '',
  });

  const isLoadingFinal = isLoading || !!externalLoading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await onSubmit(
        {
          empresa_id: empresaId || '',
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone || undefined,
          whatsapp: formData.whatsapp || undefined,
          identificador_interno: formData.identificador_interno,
          role: role as 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador',
          meta_mensal: formData.meta_mensal ? Number(formData.meta_mensal) : undefined,
          comissao_padrao: formData.comissao_padrao ? Number(formData.comissao_padrao) : undefined,
          status: status as 'ativo' | 'inativo' | 'suspenso',
        },
        isEdit
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar vendedor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('space-y-4 bg-bg-primary border border-border-color rounded-lg shadow-sm p-6 sm:p-8')}>
      {error && (
        <div className={cn('rounded-md bg-erro/10 border border-erro/20 p-3 text-sm text-erro')} role="alert">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="nome" className="block text-sm font-medium text-text-secondary mb-1">Nome</label>
          <Input id="nome" leftIcon={<User className="w-4 h-4" />} value={formData.nome} onChange={(event) => setFormData({ ...formData, nome: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
          <Input id="email" type="email" leftIcon={<Mail className="w-4 h-4" />} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="telefone" className="block text-sm font-medium text-text-secondary mb-1">Telefone</label>
          <Input id="telefone" type="tel" leftIcon={<Phone className="w-4 h-4" />} value={formData.telefone} onChange={(event) => setFormData({ ...formData, telefone: event.target.value })} />
        </div>
        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-text-secondary mb-1">WhatsApp</label>
          <Input id="whatsapp" type="tel" leftIcon={<MessageCircle className="w-4 h-4" />} value={formData.whatsapp} onChange={(event) => setFormData({ ...formData, whatsapp: event.target.value })} />
        </div>
        <div>
          <label htmlFor="identificador_interno" className="block text-sm font-medium text-text-secondary mb-1">Identificador Interno</label>
          <Input id="identificador_interno" leftIcon={<Fingerprint className="w-4 h-4" />} value={formData.identificador_interno} onChange={(event) => setFormData({ ...formData, identificador_interno: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-text-secondary mb-1">Funcao</label>
          <select id="role" value={role} onChange={(event) => setRole(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {ROLES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {STATUS_VENDEDOR.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="meta_mensal" className="block text-sm font-medium text-text-secondary mb-1">Meta Mensal</label>
          <Input id="meta_mensal" type="number" leftIcon={<Target className="w-4 h-4" />} value={formData.meta_mensal} onChange={(event) => setFormData({ ...formData, meta_mensal: event.target.value })} />
        </div>
        <div>
          <label htmlFor="comissao_padrao" className="block text-sm font-medium text-text-secondary mb-1">Comissao Padrao</label>
          <Input id="comissao_padrao" type="number" leftIcon={<Percent className="w-4 h-4" />} value={formData.comissao_padrao} onChange={(event) => setFormData({ ...formData, comissao_padrao: event.target.value })} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
        <Button type="button" variant="outline" disabled={isLoadingFinal}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isLoadingFinal} leftIcon={<Save className="w-4 h-4" />}>
          {isEdit ? 'Atualizar vendedor' : 'Salvar vendedor'}
        </Button>
      </div>
    </form>
  );
}

