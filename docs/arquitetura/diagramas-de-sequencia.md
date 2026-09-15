# Diagramas de Sequência

Os dois fluxos exigidos pela Fase 3: **autenticação** e **abertura de ordem de serviço**.

---

## 1. Autenticação do cliente por CPF

O cliente da oficina não tem usuário e senha — tem CPF. Uma função serverless valida o documento, confirma que o cliente existe na base e emite um JWT que a API principal aceita.

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant G as API Gateway
    participant L as Lambda auth-cpf
    participant D as RDS PostgreSQL

    C->>G: POST /auth/cpf<br/>{ "cpf": "529.982.247-25" }
    Note over G: Rota pública — é ela que emite o token,<br/>então não pode exigir token

    G->>L: invoke (AWS_PROXY)

    L->>L: valida dígitos verificadores
    alt CPF inválido
        L-->>G: 400 CPF inválido
        G-->>C: 400
        Note over L,D: Não consulta o banco:<br/>CPF malformado nunca existirá
    end

    L->>D: SELECT id, name, email, document<br/>FROM customers WHERE document = $1
    D-->>L: cliente ou vazio

    alt cliente não encontrado
        L-->>G: 401 Cliente não encontrado ou inativo
        G-->>C: 401
        Note over L: 401 e não 404, para o endpoint não virar<br/>um oráculo de quais CPFs estão cadastrados
    end

    L->>L: assina JWT HS256<br/>{ sub, email, role: CUSTOMER, name, document }
    L-->>G: 200 { accessToken, expiresIn, customer }
    G-->>C: 200
```

O payload carrega `sub`, `email` e `role` porque é o que o `JwtStrategy` da aplicação exige. Manter esses três campos é o que faz o token emitido pela Lambda ser aceito pela API **sem nenhuma alteração do lado dela**.

### Consumo de rota protegida

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant G as API Gateway
    participant Z as Lambda authorizer
    participant A as Aplicação no k3s
    participant D as RDS

    C->>G: GET /api/service-orders<br/>Authorization: Bearer ...

    alt decisão não está em cache
        G->>Z: authorize
        Z->>Z: verifica assinatura HS256
        Z-->>G: { isAuthorized, customerId }
        Note over G,Z: Resultado cacheado 5 min por token
    end

    alt token ausente, expirado ou adulterado
        G-->>C: 401
        Note over G,A: Barrado na borda — não consome pod do cluster
    end

    G->>A: HTTP_PROXY :30080
    A->>A: JwtAuthGuard valida o token de novo
    Note over A: Defesa em profundidade: a aplicação não confia<br/>em ter sido chamada só pelo gateway
    A->>D: consulta
    D-->>A: dados
    A-->>G: 200
    G-->>C: 200
```

A validação acontece duas vezes de propósito. A porta 30080 é alcançável diretamente pelo IP do nó (consequência do `NodePort`, ver o diagrama de componentes), então a aplicação não pode assumir que todo tráfego passou pelo gateway.

### Autenticação do funcionário

Caminho separado, para outro público — funcionário tem senha e papel.

```mermaid
sequenceDiagram
    autonumber
    actor F as Funcionário
    participant G as API Gateway
    participant A as Aplicação · LoginUseCase
    participant D as RDS

    F->>G: POST /api/auth/login<br/>{ email, password }
    Note over G: Rota pública no gateway —<br/>a autenticação é da aplicação
    G->>A: HTTP_PROXY
    A->>D: SELECT * FROM users WHERE email = $1
    D-->>A: usuário

    alt usuário inexistente ou inativo
        A-->>F: 401 Invalid credentials
    end

    A->>A: bcrypt.compare(senha, hash)
    alt senha incorreta
        A-->>F: 401 Invalid credentials
        Note over A: Mesma mensagem dos dois casos:<br/>não revela se o e-mail existe
    end

    A-->>F: 200 { accessToken (15 min),<br/>refreshToken (7 dias), user }
```

Os dois tokens são assinados com o mesmo `JWT_SECRET` compartilhado entre Lambda e aplicação. O segredo é gerado pelo Terraform do repositório da Lambda e precisa estar no `Secret` do Kubernetes — ver [RFC-003](../rfc/rfc-003-estrategia-de-autenticacao.md).

---

## 2. Abertura de ordem de serviço

```mermaid
sequenceDiagram
    autonumber
    actor U as Atendente
    participant G as API Gateway
    participant Z as Lambda authorizer
    participant C as ServiceOrdersController
    participant UC as CreateServiceOrderUseCase
    participant CR as CustomerRepository
    participant VR as VehicleRepository
    participant E as ServiceOrderEntity
    participant OR as ServiceOrderRepository
    participant D as RDS
    participant M as ServiceOrderMetrics

    U->>G: POST /api/service-orders<br/>Bearer + { customerId, vehicleId, problemDescription }
    G->>Z: authorize
    Z-->>G: autorizado
    G->>C: HTTP_PROXY :30080

    C->>C: ValidationPipe valida o DTO<br/>(class-validator)
    C->>UC: execute(dto)

    UC->>CR: existsById(customerId)
    CR->>D: SELECT
    D-->>CR: existe?
    alt cliente não existe
        UC-->>C: NotFoundException
        C-->>U: 404
    end

    UC->>VR: findById(vehicleId)
    VR->>D: SELECT
    D-->>VR: veículo
    alt veículo não existe
        UC-->>C: NotFoundException
        C-->>U: 404
    end

    UC->>UC: vehicle.customerId === dto.customerId ?
    alt veículo é de outro cliente
        UC-->>C: BusinessRuleException
        C-->>U: 422
        Note over UC: Impede abrir ordem para um carro<br/>que não é do cliente informado
    end

    UC->>E: ServiceOrderEntity.create(...)
    E->>E: valida invariantes<br/>status = RECEIVED, total = 0
    E-->>UC: entidade

    UC->>OR: create(order)
    OR->>D: INSERT em service_orders<br/>+ itens nas tabelas de junção
    Note over OR,D: Escrita aninhada numa única transação
    D-->>OR: ordem persistida
    OR-->>UC: entidade

    UC->>M: recordTransition(NONE → RECEIVED)
    Note over M: É a soma deste contador que vira<br/>o painel de volume diário de OS

    UC->>UC: ServiceOrderMapper.toResponse(created)
    UC-->>C: ServiceOrderResponseDto
    C-->>U: 201 Created
```

### Exceção → HTTP

O `HttpExceptionFilter` global traduz as exceções de domínio:

| Exceção | Status |
|---|---|
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `BusinessRuleException` | 422 |
| `InvalidStatusTransitionException` | 422 |

O caso de uso nunca conhece HTTP — lança exceção de domínio, e a tradução acontece numa única camada.

---

## 3. Transição de status, com notificação

Mostra por que a falha de e-mail não derruba a operação.

```mermaid
sequenceDiagram
    autonumber
    actor U as Mecânico
    participant UC as ApproveOrderUseCase
    participant OR as ServiceOrderRepository
    participant VO as ServiceOrderStatusVO
    participant M as ServiceOrderMetrics
    participant CR as CustomerRepository
    participant EM as ResendEmailNotificationService
    participant R as Resend
    participant IM as IntegrationMetrics

    U->>UC: execute(orderId)
    UC->>OR: findById
    OR-->>UC: ordem

    Note over UC: Lê status e updatedAt ANTES de mutar:<br/>approve() sobrescreve os dois
    UC->>VO: transitionTo(IN_PROGRESS)
    alt transição inválida
        VO-->>UC: InvalidStatusTransitionException
        UC-->>U: 422
        Note over VO: A máquina de estados é do domínio,<br/>não do banco nem do controller
    end

    UC->>OR: update(order)
    OR-->>UC: ordem atualizada

    UC->>M: recordTransition(AWAITING_APPROVAL → IN_PROGRESS,<br/>since: updatedAt anterior)
    Note over M: O histograma de duração vira o painel<br/>de tempo médio por status

    UC->>CR: findById(customerId)
    UC->>EM: sendServiceOrderStatusUpdate(...)
    EM->>R: POST /emails

    alt Resend indisponível
        R-->>EM: erro
        EM->>IM: recordFailure('resend', ...)
        Note over EM,IM: A falha é engolida de propósito: uma queda<br/>do fornecedor não pode desfazer a transição.<br/>Mas vira métrica, então não é invisível
    else sucesso
        EM->>IM: recordSuccess('resend', duração)
    end

    UC-->>U: 200 ordem atualizada
```

A ordem importa: **persistir primeiro, notificar depois.** Se fosse o contrário, uma falha ao gravar deixaria o cliente com um e-mail sobre uma mudança que não aconteceu.

---

## Máquina de estados da ordem

Aplicada pelo `ServiceOrderStatusVO`, no domínio.

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: abertura
    RECEIVED --> IN_DIAGNOSIS
    IN_DIAGNOSIS --> AWAITING_APPROVAL: orçamento pronto
    AWAITING_APPROVAL --> IN_PROGRESS: cliente aprova
    IN_PROGRESS --> COMPLETED
    COMPLETED --> DELIVERED
    DELIVERED --> [*]

    RECEIVED --> CANCELED
    IN_DIAGNOSIS --> CANCELED
    AWAITING_APPROVAL --> CANCELED: cliente recusa
    IN_PROGRESS --> CANCELED
    COMPLETED --> CANCELED
    CANCELED --> [*]

    note right of DELIVERED
        Único estado do qual não se cancela:
        o carro já saiu da oficina.
    end note
```

Itens só podem ser adicionados em `RECEIVED`, `IN_DIAGNOSIS` e `AWAITING_APPROVAL` — depois de aprovado, o orçamento está fechado.
