import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  success: 'bg-brand/15 text-brand-dark',
  warning: 'bg-aviso/15 text-aviso',
  danger: 'bg-erro/15 text-erro',
  info: 'bg-informacao/15 text-informacao',
  neutral: 'bg-bg-tertiary text-text-secondary',
  brand: 'bg-brand/15 text-brand-dark',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

