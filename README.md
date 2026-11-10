# GrowMoney Softwares

## Status: EM DESENVOLVIMENTO

### Estrutura Atual
```
src/
├── components/
│   ├── auth/          # ProtectedRoute.tsx
│   ├── dashboard/     # KPICard, ChartContainer, charts
│   ├── empresas/      # EmpresaSelector
│   ├── forms/         # ClientForm, ServicoForm, VendedorForm, EmpresaForm, ConviteForm
│   ├── layout/        # Sidebar, Header, AppLayout
│   └── ui/            # Button, Card, EmptyState, Input, Loading
├── config/            # nav.ts
├── contexts/          # AuthContext, ThemeContext
├── design-system/     # tokens.css
├── lib/               # Types, permissions, utils, supabase client
├── pages/
│   ├── auth/          # Login, Cadastro, RecuperaçãoSenha, TermosUso, Privacidade
│   ├── dashboard/     # Dashboard, DashboardExecutivo, Clientes, Contratos, etc.
│   ├── public/        # LandingPage
│   └── empresas/      # Empresas
├── repositories/      # client, servico, vendedor, agenda, empresa
├── routes/            # index, ProtectedRoute
└── services/          # client, servico, vendedor, empresa
```

### Tecnologias
- React 18 + TypeScript + Vite
- Tailwind CSS + Radix UI
- TanStack Query + React Hook Form
- Supabase (Auth + PostgreSQL)
- Recharts para graficos
- Lucide React para icones

### proximos Passos
1. Configurar Supabase com credenciais reais
2. Executar migrações no banco de dados
3. Conectar dados reais (substituir mock data)
4. Configurar ambiente de testes
5. Executar build e deploy
# GrowMoney

## Instruções para assistentes de IA

Antes de entender ou alterar o projeto, consulte `AGENTS.md`, `graphify-out/GRAPH_REPORT.md` e o grafo completo em `graphify-out/graph.json`. Confirme as relações no código e no schema atual. Após mudanças, execute `npm run graphify` para atualizar o mapa, depois typecheck, testes e build. O fluxo completo e os limites de segurança estão em `AGENTS.md`.

`npm run build` regenera automaticamente o grafo antes da compilação.

