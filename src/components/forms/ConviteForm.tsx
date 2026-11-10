import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ConviteFormProps {
  onSubmit?: (data: { email: string; role: string }) => void;
  loading?: boolean;
  className?: string;
}

export function ConviteForm({ onSubmit, loading = false, className }: ConviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('vendedor');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ email, role });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <Input
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-label="E-mail do convidado"
      />
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-text-secondary mb-1">
          Função
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-md',
            'bg-bg-secondary border border-border-color',
            'text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-verde-discreto'
          )}
          aria-label="Função do convidado"
        >
          <option value="vendedor">Vendedor</option>
          <option value="gestor">Gestor</option>
          <option value="financeiro">Financeiro</option>
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        Enviar Convite
      </Button>
    </form>
  );
}

