# docs/API.md — GrowMoney Softwares

## Contratos de API

### Autenticação
- Todos os endpoints (exceto auth) exigem token JWT
- Token no header: `Authorization: Bearer <token>`
- Token expira em 24h

### Padrão de Resposta
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

### Padrão de Erro
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": {
      "campo": [" mensagem de erro"]
    }
  }
}
```

## Endpoints

### Autenticação
```
POST /auth/login
POST /auth/register
POST /auth/logout
POST /auth/refresh
```

### Clientes
```
GET    /api/clientes
POST   /api/clientes
GET    /api/clientes/:id
PUT    /api/clientes/:id
DELETE /api/clientes/:id
```

### Contratos
```
GET    /api/contratos
POST   /api/contratos
GET    /api/contratos/:id
PUT    /api/contratos/:id
DELETE /api/contratos/:id
POST   /api/contratos/:id/enviar
POST   /api/contratos/:id/assinar
GET    /api/contratos/:id/assinaturas
```

### Serviços
```
GET    /api/servicos
POST   /api/servicos
GET    /api/servicos/:id
PUT    /api/servicos/:id
DELETE /api/servicos/:id
```

### Parcelas
```
GET    /api/parcelas
POST   /api/parcelas
GET    /api/parcelas/:id
PUT    /api/parcelas/:id
POST   /api/parcelas/:id/pagar
```

### Agendamentos
```
GET    /api/agendamentos
POST   /api/agendamentos
GET    /api/agendamentos/:id
PUT    /api/agendamentos/:id
DELETE /api/agendamentos/:id
```

### Relatórios
```
GET /api/relatorios/fluxo-caixa?data_init=YYYY-MM-DD&data_fim=YYYY-MM-DD
GET /api/relatorios/aging
GET /api/relatorios/vendedores
GET /api/relatorios/contratos
```

### Configurações
```
GET    /api/configuracoes
PUT    /api/configuracoes/:chave
```

## Códigos de Erro
| Código | Mensagem | Status |
|--------|----------|--------|
| UNAUTHORIZED | Não autenticado | 401 |
| FORBIDDEN | Acesso negado | 403 |
| NOT_FOUND | Reccurso não encontrado | 404 |
| VALIDATION_ERROR | Dados inválidos | 422 |
| API_ERROR | Erro interno | 500 |
| NETWORK_ERROR | Erro de conexão | 0 |

## Rate Limiting
- 100 requisições por minuto por usuário
- 1000 requisições por minuto por IP (não autenticado)
