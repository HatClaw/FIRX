# GrowMoney Softwares — Documentação de Segurança

## Políticas de Autorização

### Regra Central
Toda operação no banco de dados deve ser verificada pelo `AuthorizationService` antes de ser executada.

### Verificação de Empresa
- Nenhum identificador de empresa enviado pelo navegador é confiável
- A empresa ativa é obtida do contexto de autenticação (session)
- Queries sempre filtram por `empresa_id = user.empresaAtiva.id`

### Políticas RLS (Row Level Security)
Todas as tabelas Devem ter RLS habilitado:
- `profiles` - Usuário vê apenas seu perfil
- `empresas` - Usuário vê apenas empresas onde é membro
- `empresa_members` - Usuário vê apenas membros de suas empresas
- `clients` - Isolamento por empresa_id
- `services` - Isolamento por empresa_id
- `contratos` - Isolamento por empresa_id
- `parcelas` - Isolamento por empresa_id (via contrato)
- `agenda` - Isolamento por empresa_id
- `configuracoes` - Isolamento por empresa_id
- `historico` - Leitura apenas para usuários da empresa

### Permissões por Função
| Função | Permissões |
|--------|-----------|
| Administrador | Acesso total |
| Gestor | CRUD clients, contratos, servicos, financeiro export, relatorios |
| Vendedor | CRUD clients, contratos, agenda, relatorios leitura |
| Financeiro | Leitura clients, CRUD financeiro, export, relatorios |
| Operador | Leitura basica, CRUD agenda |

### Testes de Acesso Cruzado
- Usuário A não pode ver dados de Usuário B
- Usuário com permissão limitada não pode exportar
- Tentativas de alteração de empresa_id são bloqueadas
- Webhooks devem ser autenticados e idempotentes

### Exportação
- Apenas funções com permissão `*:export` podem exportar
- Exportações são registradas no histórico de auditoria
- Limites de exportação por período
