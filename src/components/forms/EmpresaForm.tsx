import { useEffect, useState } from 'react';
import { Building2, LoaderCircle } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface EmpresaFormData {
  nome: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
  };
}

interface BrasilApiEmpresa {
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  ddd_telefone_1?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

interface EmpresaFormProps {
  onSubmit: (data: EmpresaFormData) => void | Promise<void>;
  loading?: boolean;
  defaultValues?: Partial<EmpresaFormData>;
  className?: string;
}

const emptyForm: EmpresaFormData = {
  nome: '',
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  email: '',
  telefone: '',
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '' },
};

const onlyCnpjCharacters = (value: string) => value.replace(/[^a-z\d]/gi, '').toUpperCase().slice(0, 14);

export function EmpresaForm({ onSubmit, loading = false, defaultValues, className }: EmpresaFormProps) {
  const [form, setForm] = useState<EmpresaFormData>(() => ({
    ...emptyForm,
    ...defaultValues,
    endereco: { ...emptyForm.endereco, ...defaultValues?.endereco },
  }));
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lookupMessage, setLookupMessage] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const cnpj = onlyCnpjCharacters(form.cnpj);
    if (cnpj.length !== 14) {
      setLookup('idle');
      setLookupMessage('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookup('loading');
      setLookupMessage('Consultando CNPJ na BrasilAPI…');
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(response.status === 404 ? 'CNPJ não encontrado.' : 'Não foi possível consultar este CNPJ.');
        const data = (await response.json()) as BrasilApiEmpresa;
        if (controller.signal.aborted) return;
        const endereco = {
          cep: data.cep || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
        };
        setForm((current) => ({
          ...current,
          nome: data.nome_fantasia || data.razao_social || current.nome,
          razao_social: data.razao_social || current.razao_social,
          nome_fantasia: data.nome_fantasia || current.nome_fantasia,
          email: current.email || data.email || '',
          telefone: current.telefone || data.ddd_telefone_1 || '',
          endereco: Object.fromEntries(
            Object.entries(endereco).map(([key, value]) => [key, value || current.endereco[key as keyof EmpresaFormData['endereco']]])
          ) as EmpresaFormData['endereco'],
        }));
        setLookup('success');
        setLookupMessage('Dados cadastrais preenchidos. Confira e complete o que faltar.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLookup('error');
        setLookupMessage(error instanceof Error ? error.message : 'Falha ao consultar CNPJ.');
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.cnpj]);

  const update = <K extends keyof EmpresaFormData>(key: K, value: EmpresaFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      await onSubmit({ ...form, cnpj: onlyCnpjCharacters(form.cnpj) });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a empresa.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {formError && <p className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro" role="alert">{formError}</p>}
      <Input
        label="CNPJ"
        value={form.cnpj}
        onChange={(event) => update('cnpj', onlyCnpjCharacters(event.target.value))}
        maxLength={14}
        autoComplete="off"
        aria-label="CNPJ da empresa"
        hint="Digite os 14 caracteres do CNPJ; os dados serão consultados automaticamente."
        rightIcon={lookup === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : undefined}
      />
      {lookupMessage && (
        <p className={`text-xs ${lookup === 'error' ? 'text-erro' : lookup === 'success' ? 'text-brand' : 'text-text-secondary'}`} role="status">
          {lookupMessage}
        </p>
      )}
      <Input label="Nome de exibição" value={form.nome} onChange={(event) => update('nome', event.target.value)} required />
      <Input label="Razão social" value={form.razao_social} onChange={(event) => update('razao_social', event.target.value)} />
      <Input label="Nome fantasia" value={form.nome_fantasia} onChange={(event) => update('nome_fantasia', event.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="E-mail" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
        <Input label="Telefone" value={form.telefone} onChange={(event) => update('telefone', event.target.value)} />
        <Input label="CEP" value={form.endereco.cep} onChange={(event) => update('endereco', { ...form.endereco, cep: event.target.value })} />
        <Input label="Logradouro" value={form.endereco.logradouro} onChange={(event) => update('endereco', { ...form.endereco, logradouro: event.target.value })} />
        <Input label="Número" value={form.endereco.numero} onChange={(event) => update('endereco', { ...form.endereco, numero: event.target.value })} />
        <Input label="Complemento" value={form.endereco.complemento} onChange={(event) => update('endereco', { ...form.endereco, complemento: event.target.value })} />
        <Input label="Bairro" value={form.endereco.bairro} onChange={(event) => update('endereco', { ...form.endereco, bairro: event.target.value })} />
        <Input label="Município" value={form.endereco.municipio} onChange={(event) => update('endereco', { ...form.endereco, municipio: event.target.value })} />
        <Input label="UF" value={form.endereco.uf} onChange={(event) => update('endereco', { ...form.endereco, uf: event.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading} leftIcon={<Building2 className="h-4 w-4" />}>
          Salvar empresa
        </Button>
      </div>
    </form>
  );
}

