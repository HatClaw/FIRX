# Segurança do painel administrativo

## Autoridade de administração global

O painel `/admin` autentica com a mesma identidade Supabase usada pelo restante do sistema. A autorização global vem exclusivamente de `public.platform_admins(user_id)` e é consultada pela função `public.is_platform_admin()`. `profiles.role` representa permissões da empresa ativa; não concede acesso global.

Inclua ou remova administradores globais somente por operação confiável no servidor ou pelo console administrativo do Supabase. Não coloque `service_role` no navegador, em `VITE_*` ou no repositório. A migration local de hardening não cria nem promove administradores.

## Contas de vendedores

`supabase/functions/admin-users` recebe `create` e `delete` com JWT Supabase. Ela valida o usuário com Auth, autoriza por `platform_admins` ou por membership ativo com papel `admin`, cria vendedores com papel fixo e registra a operação. A chave `SUPABASE_SERVICE_ROLE_KEY` só é lida no runtime server-side da Edge Function. A função foi adicionada localmente e ainda precisa ser configurada e publicada no projeto pelo fluxo de deploy apropriado.

A exclusão de conta é recusada se o vendedor tiver vínculo com outra empresa, for responsável por uma empresa ou tiver papel diferente de vendedor. O Supabase pode recusar a exclusão caso haja objetos de Storage sob propriedade dessa conta; a função retorna erro sem ocultar a falha.

Tokens de acesso já emitidos são JWTs e podem continuar válidos até expirarem. A remoção do usuário encerra sessões de renovação e elimina seus vínculos/perfil; operações sensíveis ainda devem validar autorização no servidor/RLS em cada requisição.

## Auditoria e estado do schema

O painel de auditoria consome `admin_list_audit(p_limit)`, que retorna `id`, `admin_user_id`, `email`, `action`, `details` e `created_at`. Os eventos administrativos globais ficam em `gm_admin_audit`; eventos de empresa usam `auditoria`.

O schema remoto GrowMoney está à frente das migrations versionadas neste repositório. As políticas locais de hardening aplicam-se condicionalmente às tabelas `gm_*` presentes e ao bucket `growmoney-files`; elas não criam os dados/tabelas/RPCs que faltam na cadeia local. Em um banco novo, alinhe primeiro as migrations de negócio ausentes antes de usar as telas que dependem de `gm_contracts`, `gm_files`, `gm_financial_entries`, `gm_admin_audit` e `admin_list_audit`.
