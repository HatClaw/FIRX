import { useState } from 'react';
import { User, Building2, FileText, Mail, Phone, MessageCircle, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Cliente, ClientType, ClientStatus, CreateClienteData } from '@/lib/client-types';

interface ClientFormProps {
  initialData?: Partial<Cliente>;
  onSubmit: (data: Omit<CreateClienteData, 'empresa_id'> & { empresa_id?: string }, isEdit: boolean) => Promise<void>;
  empresaId?: string;
  isEdit?: boolean;
  loading?: boolean;
}

const TIPOS: { value: ClientType; label: string }[] = [
  { value: 'pessoa_fisica', label: 'Pessoa Fisica' },
  { value: 'pessoa_juridica', label: 'Pessoa Juridica' },
];

const STATUS_CLIENTE: { value: ClientStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'arquivado', label: 'Arquivado' },
];

export function ClientForm({ initialData, onSubmit, empresaId, isEdit = false, loading: externalLoading }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tipo, setTipo] = useState<string>(initialData?.tipo || 'pessoa_fisica');
  const [status, setStatus] = useState<string>(initialData?.status || 'ativo');
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    razao_social: initialData?.razao_social || '',
    documento: initialData?.documento || '',
    email: initialData?.email || '',
    telefone: initialData?.telefone || '',
    whatsapp: initialData?.whatsapp || '',
    responsavel: initialData?.responsavel || '',
    observacoes: initialData?.observacoes || '',
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
          razao_social: formData.razao_social || undefined,
          tipo: tipo as ClientType,
          documento: formData.documento,
          email: formData.email || undefined,
          telefone: formData.telefone || undefined,
          whatsapp: formData.whatsapp || undefined,
          responsavel: formData.responsavel || undefined,
          observacoes: formData.observacoes || undefined,
          status: status as ClientStatus,
        },
        isEdit
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cliente');
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
        <div className="md:col-span-2">
          <label htmlFor="razao_social" className="block text-sm font-medium text-text-secondary mb-1">Razao Social</label>
          <Input id="razao_social" leftIcon={<Building2 className="w-4 h-4" />} value={formData.razao_social} onChange={(event) => setFormData({ ...formData, razao_social: event.target.value })} />
        </div>
        <div>
          <label htmlFor="tipo" className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
          <select id="tipo" value={tipo} onChange={(event) => setTipo(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {TIPOS.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="documento" className="block text-sm font-medium text-text-secondary mb-1">Documento</label>
          <Input id="documento" leftIcon={<FileText className="w-4 h-4" />} value={formData.documento} onChange={(event) => setFormData({ ...formData, documento: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
          <Input id="email" type="email" leftIcon={<Mail className="w-4 h-4" />} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
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
          <label htmlFor="responsavel" className="block text-sm font-medium text-text-secondary mb-1">Responsavel</label>
          <Input id="responsavel" leftIcon={<User className="w-4 h-4" />} value={formData.responsavel} onChange={(event) => setFormData({ ...formData, responsavel: event.target.value })} />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {STATUS_CLIENTE.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="observacoes" className="block text-sm font-medium text-text-secondary mb-1">Observacoes</label>
          <textarea id="observacoes" value={formData.observacoes} onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })} rows={3} className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
        <Button type="button" variant="outline" disabled={isLoadingFinal}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isLoadingFinal} leftIcon={<Save className="w-4 h-4" />}>
          {isEdit ? 'Atualizar cliente' : 'Salvar cliente'}
        </Button>
      </div>
    </form>
  );
}

