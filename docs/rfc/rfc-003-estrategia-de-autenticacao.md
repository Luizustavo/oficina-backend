# RFC-003 — Estratégia de autenticação

| | |
|---|---|
| **Status** | Aceita |
| **Data** | 2026-09-13 |
| **Decisão** | JWT HS256 com segredo compartilhado, emitido por dois caminhos: Lambda (cliente, por CPF) e aplicação (funcionário, por senha) |

---

## Contexto

A Fase 3 exige uma função serverless que valide o CPF do cliente, consulte a base e devolva um JWT para consumir as APIs protegidas.

O sistema tem **dois públicos com naturezas diferentes**:

| Público | Identidade | Credencial |
|---|---|---|
| Cliente da oficina | CPF | nenhuma — ele não tem cadastro de acesso |
| Funcionário | e-mail | senha, mais um papel (`ADMIN`, `MECHANIC`, `ATTENDANT`) |

A aplicação já tinha autenticação de funcionário por JWT antes desta fase. O desafio é acrescentar o caminho do cliente **sem duplicar a lógica de autorização** nem quebrar o que existe.

## O problema central

Se a Lambda emitir um token em formato próprio, a aplicação precisa de um segundo validador, e as rotas passam a ter dois caminhos de autorização para manter em sincronia. Isso é onde erros de segurança nascem.

## Opções consideradas

### A. Cognito como provedor de identidade

- Serviço gerenciado, tokens RS256 com JWKS público, rotação de chave automática.
- O API Gateway tem JWT authorizer nativo que valida RS256 via JWKS — sem código.
- **Contra decisivo:** o Cognito é construído em torno de usuário com credencial. Um cliente que se identifica só por CPF, sem senha, exigiria criar usuário sob demanda com senha sintética, ou um fluxo custom auth com três Lambdas de trigger. Muito aparato para o que é uma consulta a uma tabela.
- **Contra:** obrigaria migrar a autenticação de funcionário que já funciona.

### B. Lambda emitindo token em formato próprio

- Total liberdade de formato.
- **Contra decisivo:** exige um segundo validador na aplicação e duplica a lógica de autorização. Rejeitada de saída.

### C. Lambda emitindo JWT no mesmo formato que a aplicação já valida

- A Lambda assina com o **mesmo segredo** e o **mesmo formato de payload** que o `JwtStrategy` da aplicação já espera.
- Nada muda do lado da aplicação.
- **Contra:** segredo simétrico compartilhado entre dois serviços; quem consegue ler o segredo consegue forjar token.

## Decisão

**Opção C: JWT HS256 com segredo compartilhado.**

Ao inspecionar o `JwtStrategy` existente, descobrimos que ele exige apenas `sub`, `email` e `role` no payload, e **não valida `role` contra o enum de papéis**. Isso significa que um token com `role: "CUSTOMER"` é aceito pela API exatamente como está — sem uma linha de alteração.

O payload emitido pela Lambda:

```json
{
  "sub": "<id do cliente>",
  "email": "<e-mail do cliente>",
  "role": "CUSTOMER",
  "name": "<nome>",
  "document": "<CPF>"
}
```

O segredo é gerado pelo Terraform do repositório `oficina-lambda-auth` e precisa estar também no `Secret` do Kubernetes como `JWT_SECRET`.

### Por que um Lambda Authorizer customizado no gateway

O JWT authorizer **nativo** do API Gateway só valida tokens assinados com chave assimétrica via JWKS/OIDC — ou seja, RS256. Nossos tokens são HS256. Por isso a verificação na borda é feita por uma Lambda authorizer própria, que roda fora da VPC (só verifica assinatura, não toca no banco) e tem a decisão cacheada por 5 minutos.

### Por que a validação acontece duas vezes

O authorizer barra na borda **e** o `JwtAuthGuard` valida de novo dentro da aplicação. Não é redundância desperdiçada: o `Service` é `NodePort` num nó com IP público, então a porta 30080 é alcançável sem passar pelo gateway. A aplicação não pode assumir que todo tráfego veio de lá.

### Por que 401 e não 404 para CPF inexistente

Responder "não encontrado" transformaria o endpoint em um oráculo para descobrir quais CPFs estão cadastrados na oficina. A resposta é idêntica para CPF válido inexistente e para cliente inativo.

O CPF também não aparece em log nenhum — é dado pessoal sob a LGPD.

## Consequências

**Positivas**
- Zero alteração na aplicação para aceitar o cliente. O risco de introduzir falha de autorização no que já funcionava é próximo de zero.
- Um único formato de token e um único caminho de autorização.
- Tráfego não autenticado é barrado antes de consumir um pod do cluster.
- Validação de CPF acontece antes de qualquer consulta ao banco: CPF malformado nunca chega ao Postgres.

**Negativas**
- **Segredo simétrico compartilhado.** Comprometer o segredo em qualquer um dos dois serviços permite forjar token para ambos. Com RS256 só a chave privada emitiria, e a pública validaria. É o principal débito técnico desta decisão.
- **Sincronização manual do segredo.** O Terraform gera o valor e ele precisa ser copiado para o `Secret` do Kubernetes. Um esquecimento aqui faz a API rejeitar todo token emitido pela Lambda — falha silenciosa e confusa de diagnosticar.
- **A validação de CPF está duplicada** entre os dois repositórios — ver [ADR-006](../adr/adr-006-duplicacao-da-validacao-de-cpf.md).
- **O papel `CUSTOMER` exigiu um guard próprio.** Um token de cliente é, do ponto de vista do `JwtAuthGuard`, tão válido quanto o de um funcionário. Como o `RolesGuard` libera toda rota sem `@Roles()`, o cliente alcançava rotas que não deveria. Resolvido com o `CustomerScopeGuard` (ver abaixo), mas é uma consequência direta de reaproveitar o mesmo formato de token para dois públicos.

## Escopo do papel CUSTOMER

Reaproveitar o formato de token trouxe um problema de autorização que só apareceu com o sistema no ar: o `RolesGuard` libera qualquer rota sem `@Roles()`, então um token de cliente alcançava 13 rotas que não deveria — listar todas as ordens da oficina, e até **apagar outros clientes e veículos**.

A correção é o `CustomerScopeGuard`, global, registrado depois do `RolesGuard`. Ele **nega por padrão**: se o papel é `CUSTOMER` e a rota não foi marcada com `@CustomerScope(...)`, o acesso é negado. Token de funcionário não é tocado.

| Rota liberada ao cliente | Restrição |
|---|---|
| `GET /api/auth/me` | nenhuma — devolve o próprio payload |
| `GET /api/services`, `GET /api/services/:id` | nenhuma — catálogo e preços |
| `GET /api/service-orders/customer/:customerId` | o parâmetro precisa ser o próprio id |
| `GET /api/vehicles/customer/:customerId` | o parâmetro precisa ser o próprio id |
| `GET /api/service-orders/:id` | a ordem é carregada e o dono conferido |

Ordem inexistente e ordem de outro cliente devolvem a **mesma** resposta: diferenciá-las permitiria descobrir quais ids existem.

Escolher negação por padrão, e não uma lista de rotas bloqueadas, é deliberado: com lista de bloqueio, toda rota nova nasce aberta e o erro é silencioso. Com negação por padrão, o erro é uma rota que não funciona — visível e barato de corrigir.

## Evolução recomendada

Em ordem de prioridade:

1. **Migrar para RS256**, com a chave privada apenas na Lambda e a pública distribuída via JWKS. Isso elimina o segredo compartilhado e passa a permitir o authorizer nativo do API Gateway.
3. **Rotação automática do segredo** via AWS Secrets Manager, com sincronização para o cluster por External Secrets Operator.
