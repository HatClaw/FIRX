import { FileText, Download, BarChart3 } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { exportPdf } from '@/lib/export';

const reports = [
  { id: 'vendas', title: 'Relatório de vendas', desc: 'Contratos e valores por período' },
  { id: 'financeiro', title: 'Fluxo de caixa', desc: 'Recebimentos vs previstos' },
  { id: 'clientes', title: 'Base de clientes', desc: 'Ativos, inativos e prospects' },
  { id: 'equipe', title: 'Desempenho da equipe', desc: 'Metas e comissões' },
];

export default function Relatorios() {
  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Relatórios" description="Exportações e visões gerenciais" />
      <div className="grid sm:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Card key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 card-premium">
            <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{r.title}</h3>
              <p className="text-sm text-text-secondary">{r.desc}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" leftIcon={<FileText className="w-4 h-4" />}
                onClick={() => exportPdf(r.title, `<p>Relatório: ${r.id}</p><p>Gerado pelo Grow Money Digital.</p>`)}>
                PDF
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<Download className="w-4 h-4" />}>CSV</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

