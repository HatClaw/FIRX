# Supabase — GrowMoney

## Como aplicar o schema

### Opção A — SQL Editor (mais simples)

1. Abra o projeto: https://supabase.com/dashboard/project/qgzplvrpzjqhqpbtszxs
2. Vá em **SQL Editor** → New query
3. Cole o conteúdo de `migrations/20261021000000_init_schema.sql`
4. Clique **Run**

### Opção B — CLI

```bash
npx supabase link --project-ref qgzplvrpzjqhqpbtszxs
npx supabase db push
```

## Variáveis de ambiente (frontend)

```env
VITE_SUPABASE_URL=https://qgzplvrpzjqhqpbtszxs.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

## Tabelas criadas

| Tabela | Uso no app |
|--------|------------|
| `profiles` | AuthContext / perfil |
| `empresas` | Multiempresa |
| `empresa_members` | Membros + role |
| `convites` | Convites |
| `clients` | Clientes |
| `client_historico` | Histórico de clientes |
| `services` | Serviços |
| `vendedores` | Equipe comercial |
| `comissoes` | Regras de comissão |
| `vendedor_desempenho` | Métricas |
| `contratos` | Contratos |
| `assinaturas` | Assinatura digital |
| `contrato_historico` | Auditoria de contrato |
| `parcelas` | Financeiro |
| `lancamentos` | Pagamentos |
| `estornos` | Estornos |
| `agenda` | Agenda |
| `agenda_historico` | Histórico agenda |
| `auditoria` | Log geral |

RLS: isolamento por `empresa_id` via `is_empresa_member()`.
No signup, trigger cria linha em `profiles` automaticamente.

