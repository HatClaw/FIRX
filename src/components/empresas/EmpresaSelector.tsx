import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Empresa {
  id: string;
  nome: string;
}

interface EmpresaSelectorProps {
  empresas?: Empresa[];
  currentEmpresa?: Empresa | null;
  onSelect?: (empresaId: string) => void;
  onCreateNew?: () => void;
  className?: string;
}

export function EmpresaSelector({ 
  empresas = [], 
  currentEmpresa, 
  onSelect, 
  onCreateNew,
  className 
}: EmpresaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2 text-sm',
          'bg-bg-secondary border border-border-color rounded-md',
          'text-text-primary hover:bg-bg-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-verde-discreto'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Selecionar empresa"
      >
        <span className="truncate">{currentEmpresa?.nome || 'Selecionar empresa'}</span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-10 w-full mt-1',
            'bg-bg-primary border border-border-color rounded-md shadow-lg'
          )}
          role="listbox"
        >
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              onClick={() => {
                if (onSelect) onSelect(empresa.id);
                setIsOpen(false);
              }}
              className={cn(
                'w-full text-left px-4 py-2 text-sm',
                'text-text-primary hover:bg-bg-tertiary',
                currentEmpresa?.id === empresa.id && 'bg-bg-tertiary'
              )}
              role="option"
              aria-selected={currentEmpresa?.id === empresa.id}
            >
              {empresa.nome}
            </button>
          ))}
          <button
            onClick={() => {
              if (onCreateNew) onCreateNew();
              setIsOpen(false);
            }}
            className={cn(
              'w-full text-left px-4 py-2 text-sm',
              'text-verde-discreto hover:bg-bg-tertiary border-t border-border-color'
            )}
          >
            + Criar nova empresa
          </button>
        </div>
      )}
    </div>
  );
}

