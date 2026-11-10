import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, header, footer, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-bg-primary border border-border-color rounded-2xl shadow-sm transition-[box-shadow,border-color] duration-200',
        paddings[padding],
        className
      )}
    >
      {header && (
        <div className={cn('border-b border-border-color', padding !== 'none' && 'pb-3 mb-3')}>
          {header}
        </div>
      )}
      {children}
      {footer && (
        <div className={cn('border-t border-border-color', padding !== 'none' && 'pt-3 mt-3')}>
          {footer}
        </div>
      )}
    </div>
  );
}
