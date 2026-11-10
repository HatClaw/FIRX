import { useState } from 'react';
import { Tag, User, Folder, DollarSign, Clock, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Servico, CreateServicoData, ServicoStatus } from '@/lib/servico-types';

interface ServicoFormProps {
  initialData?: Partial<Servico>;
  onSubmit: (data: Omit<CreateServicoData, 'empresa_id'> & { empresa_id?: string; status?: ServicoStatus }, isEdit: boolean) => Promise<void>;
  empresaId?: string;
  isEdit?: boolean;
  loading?: boolean;
}

const UNIDADES: { value: string; label: string }[] = [
  { value: 'hora', label: 'Hora' },
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'ano', label: 'Ano' },
  { value: 'unidade', label: 'Unidade' },
];

const STATUS_SERVICO: { value: ServicoStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'arquivado', label: 'Arquivado' },
];

export function ServicoForm({ initialData, onSubmit, empresaId, isEdit = false, loading: externalLoading }: ServicoFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [unidade, setUnidade] = useState<string>(initialData?.unidade || 'unidade');
  const [status, setStatus] = useState<string>(initialData?.status || 'ativo');
  const [formData, setFormData] = useState({
    codigo: initialData?.codigo || '',
    nome: initialData?.nome || '',
    categoria: initialData?.categoria || '',
    valor_base: initialData?.valor_base?.toString() || '',
    duracao_minutos: initialData?.duracao_minutos?.toString() || '',
    condicoes_comerciais: initialData?.condicoes_comerciais || '',
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
          codigo: formData.codigo,
          nome: formData.nome,
          categoria: formData.categoria,
          valor_base: Number(formData.valor_base) || 0,
          duracao_minutos: formData.duracao_minutos ? Number(formData.duracao_minutos) : undefined,
          unidade: unidade as NonNullable<CreateServicoData['unidade']>,
          condicoes_comerciais: formData.condicoes_comerciais || undefined,
          status: status as ServicoStatus,
        },
        isEdit
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar servico');
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
        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-text-secondary mb-1">Codigo</label>
          <Input id="codigo" leftIcon={<Tag className="w-4 h-4" />} value={formData.codigo} onChange={(event) => setFormData({ ...formData, codigo: event.target.value })} required />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="nome" className="block text-sm font-medium text-text-secondary mb-1">Nome</label>
          <Input id="nome" leftIcon={<User className="w-4 h-4" />} value={formData.nome} onChange={(event) => setFormData({ ...formData, nome: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="categoria" className="block text-sm font-medium text-text-secondary mb-1">Categoria</label>
          <Input id="categoria" leftIcon={<Folder className="w-4 h-4" />} value={formData.categoria} onChange={(event) => setFormData({ ...formData, categoria: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="valor_base" className="block text-sm font-medium text-text-secondary mb-1">Valor Base</label>
          <Input id="valor_base" type="number" leftIcon={<DollarSign className="w-4 h-4" />} value={formData.valor_base} onChange={(event) => setFormData({ ...formData, valor_base: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="duracao_minutos" className="block text-sm font-medium text-text-secondary mb-1">Duracao (minutos)</label>
          <Input id="duracao_minutos" type="number" leftIcon={<Clock className="w-4 h-4" />} value={formData.duracao_minutos} onChange={(event) => setFormData({ ...formData, duracao_minutos: event.target.value })} />
        </div>
        <div>
          <label htmlFor="unidade" className="block text-sm font-medium text-text-secondary mb-1">Unidade</label>
          <select id="unidade" value={unidade} onChange={(event) => setUnidade(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {UNIDADES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} required className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed">
            {STATUS_SERVICO.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="condicoes_comerciais" className="block text-sm font-medium text-text-secondary mb-1">Condicoes Comerciais</label>
          <textarea id="condicoes_comerciais" value={formData.condicoes_comerciais} onChange={(event) => setFormData({ ...formData, condicoes_comerciais: event.target.value })} rows={3} className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
        <Button type="button" variant="outline" disabled={isLoadingFinal}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={isLoadingFinal} leftIcon={<Save className="w-4 h-4" />}>
          {isEdit ? 'Atualizar servico' : 'Salvar servico'}
        </Button>
      </div>
    </form>
  );
}

