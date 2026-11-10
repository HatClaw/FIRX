# docs/ARCHITECTURE.md — GrowMoney Softwares

## Visão Geral
Sistema de gestão financeira para pequenas empresas, construído com React + TypeScript + Supabase + Cloudflare Workers.

## Arquitetura por Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    Camada de Apresentação                 │
│  Componentes React (React Hook Form + TanStack Query)    │
├─────────────────────────────────────────────────────────┤
│                    Camada de Aplicação                    │
│  Serviços de Domínio → Validações → Casos de uso        │
├─────────────────────────────────────────────────────────┤
│                    Camada de Dados                        │
│  Repositórios → Supabase Client → PostgreSQL            │
├─────────────────────────────────────────────────────────┤
│                    Camada de Infraestrutura               │
│  Autenticação → Autorização (RLS) → Edge Functions       │
└─────────────────────────────────────────────────────────┘
```

## Módulos de Domínio

### 1. `auth` — Autenticação e Autorização
- Login/registro com Supabase Auth
- Controle de sessão
- Verificação de permissões por papel (vendedor, administrador)
- Redirecionamento por permissão

### 2. `contratos` — Gestão de Contratos
- CRUD de contratos
- Geração de PDF
- Envio por e-mail/WhatsApp
- Histórico de assinaturas
- Status de assinatura

### 3. `uos` — Unidades Operacionais
- Cadastro de filiais/UOs
- Vinculo com vendedores
- Configurações por UO

### 4. `vendedores` — Equipe Comercial
- CRUD de vendedores
- Perfis e permissões
- Agenda de compromissos
- Performance por vendedor

### 5. `agendamentos` — Agenda da Equipe
- Calendário de compromissos
- Lembretes
- Status de comparecimento
- Histórico de agendamentos

### 6. `financeiro` — Gestão Financeira
- Parcelas (a receber/pagar)
- Entradas e saídas
- Relatórios (fluxo de caixa, aging)
- Contas a receber/pagar
- Categorização

### 7. `configuracoes` — Configurações
- Preferências do sistema
- Templates de contrato
- Integrações (WhatsApp, E-mail)
- Categorizações financeiras

## Padrões de Tratamento de Erros

### Hierarquia de Erros
```typescript
class AppError extends Error {
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'AppError';
  }
}

class ApiError extends AppError {
  constructor(message: string, code: string, status: number) {
    super(message, code, status);
    this.name = 'ApiError';
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

### Fluxo de Tratamento
1. Serviços capturam erros e convertem para tipos conhecidos
2. Repositórios propagam erros do Supabase
3. Componentes exibem via Error Boundary ou toast
4. APIs de backend (Edge Functions) devolvem JSON padronizado

## Contratos entre Camadas

### Serviços → Repositórios
```typescript
interface IContratoRepository {
  create(data: CreateContrato): Promise<Contrato>;
  findById(id: string): Promise<Contrato | null>;
  findByCliente(clienteId: string): Promise<Contrato[]>;
  update(id: string, data: Partial<Contrato>): Promise<Contrato>;
  delete(id: string): Promise<void>;
}
```

### Componentes → Serviços
- Componentes chamam serviços via hooks customizados
- Serviços retornam `Result<T, Error>` ou `Promise<T>`
- Nunca acessam Supabase diretamente

## Migrações Versionadas
- Utilizar `supabase migration new` para criar novas migrações
- Arquivos em `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Ordem de aplicação: numérica
- Nunca modificar migrações já aplicadas

## Testes
- Unit: Jest + Testing Library
- Services: mock de dependências
- Components: render + user interaction
- Integration: fluxo completo com Supabase mock

## Design System
- Tokens em `src/design-system/tokens.css`
- Cores: grafite, preto, branco, verde discreto
- Temas: claro e escuro
- Acessibilidade: WCAG AA

## Documentação Relacionada
- `docs/DATA_MODEL.md` — Modelo de dados
- `docs/API.md` — Contratos de API
- `docs/DECISIONS.md` — Decisões arquiteturais
- `docs/DEVELOPMENT_STATUS.md` — Status de desenvolvimento
