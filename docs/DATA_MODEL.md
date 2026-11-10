# docs/DATA_MODEL.md — GrowMoney Softwares

## Banco de Dados: Supabase (PostgreSQL)

## Tabelas e Relacionamentos

### Perfis de Usuário
```sql
perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'vendedor', 'visualizador')),
  uo_id UUID REFERENCES uos(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
)
```

### Unidades Operacionais (UOs)
```sql
uos (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  responsavel_id UUID REFERENCES perfis(id),
  configuracoes JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT now()
)
```

### Clientes
```sql
 clientes (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj_cpf TEXT,
  email TEXT,
  telefone TEXT,
  tipo TEXT CHECK (tipo IN ('pessoa_juridica', 'pessoa_fisica')),
  uo_id UUID REFERENCES uos(id),
  criado_em TIMESTAMPTZ DEFAULT now()
)
```

### Serviços
```sql
servicos (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  valor_base NUMERIC(15,2) NOT NULL,
  categoria TEXT,
  uo_id UUID REFERENCES uos(id),
  ativo BOOLEAN DEFAULT true
)
```

### Contratos
```sql
contratos (
  id UUID PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id),
  servico_id UUID REFERENCES servicos(id),
  valor NUMERIC(15,2) NOT NULL,
  forma_pagamento TEXT,
  parcelas INTEGER DEFAULT 1,
  data_vencimento DATE,
  template_usado TEXT,
  status TEXT CHECK (status IN ('rascunho', 'enviado', 'assinado', 'cancelado')),
  observacoes TEXT,
  uo_id UUID REFERENCES uos(id),
  criado_por UUID REFERENCES perfis(id),
  criado_em TIMESTAMPTZ DEFAULT now()
)
```

### Assinaturas
```sql
assinaturas (
  id UUID PRIMARY KEY,
  contrato_id UUID REFERENCES contratos(id),
  assinante TEXT NOT NULL,
  email TEXT,
  status TEXT CHECK (status IN ('pendente', 'assinado', 'recusado')),
  data_envio TIMESTAMPTZ,
  data_assinatura TIMESTAMPTZ,
  ip_assinatura TEXT,
  user_agent TEXT
)
```

### Parcelas
```sql
parcelas (
  id UUID PRIMARY KEY,
  contrato_id UUID REFERENCES contratos(id),
  numero INTEGER NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento TEXT,
  uo_id UUID REFERENCES uos(id)
)
```

### Entradas e Saídas
```sql
entradas (
  id UUID PRIMARY KEY,
  parcela_id UUID REFERENCES parcelas(id),
  valor NUMERIC(15,2) NOT NULL,
  data DATE NOT NULL,
  conta TEXT,
  observacoes TEXT,
  uo_id UUID REFERENCES uos(id),
  criado_por UUID REFERENCES perfis(id)
)

saidas (
  id UUID PRIMARY KEY,
  valor NUMERIC(15,2) NOT NULL,
  data DATE NOT NULL,
  categoria TEXT,
  conta TEXT,
  observacoes TEXT,
  uo_id UUID REFERENCES uos(id),
  criado_por UUID REFERENCES perfis(id)
)
```

### Agendamentos
```sql
agendamentos (
  id UUID PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES perfis(id),
  contracts_id UUID REFERENCES contratos(id),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao INTEGER DEFAULT 60,
  tipo TEXT CHECK (tipo IN ('reuniao', 'ligacao', 'whatsapp', 'outro')),
  status TEXT CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado')),
  observacoes TEXT,
  lembrete BOOLEAN DEFAULT true,
  uo_id UUID REFERENCES uos(id)
)
```

### Configurações
```sql
configuracoes (
  id UUID PRIMARY KEY,
  uo_id UUID REFERENCES uos(id),
  chave TEXT NOT NULL,
  valor JSONB NOT NULL,
  tipo TEXT CHECK (tipo IN ('sistema', 'integracao', 'template', 'preferencia'))
)
```

### Histórico
```sql
historico (
  id UUID PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('criacao', 'edicao', 'exclusao', 'status_change')),
  dados_antigos JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES perfis(id),
  criado_em TIMESTAMPTZ DEFAULT now()
)
```

## Relacionamentos

```
uos (1)───(N) perfis
uos (1)───(N) clientes
uos (1)───(N) contratos
uos (1)───(N) parcelas
uos (1)───(N) agendamentos
uos (1)───(N) configuracoes

contratos (1)───(N) assinaturas
contratos (1)───(N) parcelas

parcelas (1)───(1) entradas

contratos (1)───(1) agendamentos
cliente (1)───(N) agendamentos
perfil (1)───(N) agendamentos
```

## Migrações
- Arquivos em `supabase/migrations/`
- Formato: `YYYYMMDDHHMMSS_descrica.sql`
- Ordem numérica crescente
- Nunca alterar migrações aplicadas

## Políticas RLS (Row Level Security)
- Todas as tabelas devem ter RLS habilitado
- Usuários veem apenas dados de sua UO
- Admin veem todas as UOs
- Vendedores veem apenas dados atribuídos
- Auditoria via tabela `historico`
