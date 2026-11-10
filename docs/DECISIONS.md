# docs/DECISIONS.md — GrowMoney Softwares

## Decisões Arquiteturais

### D-001: Utilizar Supabase como Backend
- **Data**: 2026-10-20
- **Decisão**: Usar Supabase (PostgreSQL + Auth + Edge Functions) como backend principal
- **Raciocínio**: Base técnica existente do ContratosAutomattize já utiliza Supabase
- **Alternativas consideradas**: Firebase, AWS Amplify, backend próprio
- **Consequências**: Depende da stable do Supabase, mas ganha autenticação e RLS nativos

### D-002: Camada de Repositório
- **Data**: 2026-10-20
- **Decisão**: Implementar camada de repositório entre serviços e Supabase
- **Raciocínio**: Separação de responsabilidades, permitir mock em testes, facilitar migração futura
- **Consequências**: Mais código, mas testabilidade muito melhor

### D-003: TypeScript Estrito
- **Data**: 2026-10-20
- **Decisão**: Usar TypeScript com configuração estrita
- **Raciocínio**: Prevenir bugs em tempo de desenvolvimento, melhorar manutenibilidade
- **Consequências**: Custo inicial de configuração, mas redução de bugs em produção

### D-004: Design System Próprio
- **Data**: 2026-10-20
- **Decisão**: Criar tokens de design system em CSS
- **Raciocínio**: Consistência visual, facilidade de theming, acessibilidade
- **Consequências**: Tempo inicial de configuração, mas manutenibilidade visual

### D-005: Testes por Camada
- **Data**: 2026-10-20
- **Decisão**: Unit tests para serviços e componentes, integration tests com mock
- **Raciocínio**: Prevenir regressões, documentar comportamento
- **Consequências**: Custo inicial, mas qualidade de código

### D-006: Graphify como Ferramenta de Análise
- **Data**: 2026-10-20
- **Decisão**: Utilizar Graphify para mapeamento de dependências
- **Status**: **NÃO INSTALADO** — dependência pendente
- **Ação**: Instalar em https://graphiffy.com/docs/install ou alternativa manual

### D-007: Nomenclatura em Português para Domínio
- **Data**: 2026-10-20
- **Decisão**: Usar nomes em português para domínio de negócios, inglês para código técnico
- **Raciocínio**: Domínio é em português, código técnico é universal
- **Consequências**: Código mais legível para desenvolvedores locais

### D-008: Dark Mode como Tema Padrão
- **Data**: 2026-10-20
- **Decisão**: Tema escuro como padrão, com suporte a tema claro
- **Raciocínio**: Preferência do usuário (configurado em `preferences.json`), redução de fadiga visual
- **Consequências**: Maior esforço em design de ambos os temas

### D-009: Edge Functions para Operações Sensíveis
- **Data**: 2026-10-20
- **Decisão**: Usar Supabase Edge Functions para operações que precisam de lógica do lado do servidor
- **Raciocínio**: Segurança, validação centralizada, performance
- **Consequências**: Mais infraestrutura, mas operações mais seguras

### D-010: Preservar Funcionalidades Existentes
- **Data**: 2026-10-20
- **Decisão**: Manter todas as funcionalidades do ContratosAutomattize que forem adequadas
- **Raciocínio**: Evitar perda de investimento, manter usuários atuais
- **Consequências**: Possível technical debt, mas menor risco de negócios
