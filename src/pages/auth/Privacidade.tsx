import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

export default function Privacidade() {
  const sections = ['Informacoes coletadas', 'Uso', 'Compartilhamento', 'Seguranca', 'Direitos do usuario', 'Cookies', 'Alteracoes', 'Contato'];
  return (
    <div className="min-h-screen bg-branco p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-preto text-center">Politica de Privacidade</h1>
        {sections.map((s) => (
          <Card key={s} className={cn('bg-grafite/5 border-grafite/10')}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-preto mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-verde-discreto" />
                {s}
              </h2>
              <p className="text-grafite">Conteudo da secao {s}.</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
