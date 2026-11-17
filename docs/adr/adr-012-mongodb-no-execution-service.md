# ADR-012 — MongoDB no Execution Service

**Status:** Aceita · **Data:** 2026-11-14

## Contexto

O enunciado exige pelo menos um banco não relacional. Entre os três serviços ([ADR-009](adr-009-divisao-em-microsservicos.md)), o Execution Service é o que tem o dado com a forma mais próxima de um documento.

Um job de execução é uma OS em andamento na oficina: entra na fila, passa por diagnóstico técnico e reparo, pode ser pausado, trocar de mecânico, falhar por falta de peça e ser retomado. O que interessa guardar é **a linha do tempo**, com tamanho e conteúdo variáveis de job para job.

## Decisão

**MongoDB 8.0**, rodando no cluster k3s (namespace `execution`) como `StatefulSet` com volume persistente e cache do WiredTiger limitado a 256 MB.

O dado de cada job é **um documento**:

```json
{
  "_id": "…",
  "orderId": "uuid da OS",
  "sagaId": "uuid",
  "orderNumber": "OS-2026-000123",
  "vehiclePlate": "ABC1D23",
  "status": "REPAIRING",
  "priority": "NORMAL",
  "mechanicId": "uuid",
  "services": [{ "name": "Troca de óleo", "quantity": 1 }],
  "parts":    [{ "name": "Filtro de óleo", "quantity": 1 }],
  "diagnosisNotes": "Vazamento no cárter, junta substituída",
  "timeline": [
    { "status": "QUEUED",     "at": "…", "by": "system" },
    { "status": "DIAGNOSING", "at": "…", "by": "uuid-mecanico" },
    { "status": "REPAIRING",  "at": "…", "by": "uuid-mecanico", "note": "…" }
  ],
  "pendingEvents": [],
  "createdAt": "…",
  "updatedAt": "…"
}
```

Status do job: `QUEUED → DIAGNOSING → REPAIRING → DONE`, com `FAILED` e `CANCELED` como saídas.

Índices: `orderId` (único), `{ status, priorityRank, createdAt }` para a fila, e um índice parcial em `pendingEvents.0` para o relay do outbox. `priorityRank` é a prioridade em número (0 = `HIGH`, 1 = `NORMAL`, 2 = `LOW`), porque `priority` em texto ordenaria `HIGH`, `LOW`, `NORMAL`.

### Outbox embutido no documento

O outbox da [ADR-010](adr-010-mensageria-com-rabbitmq.md) exige gravar a mudança e a mensagem de forma atômica. No MongoDB, transação entre documentos exige **replica set**, e um replica set com autenticação exige *keyfile* compartilhado, o que é mais configuração para um único nó.

A escolha é **não precisar de transação**: o evento a publicar vai em `pendingEvents[]`, **no mesmo documento do job**. Escrita em um único documento é atômica no MongoDB, então mudar o status e enfileirar o evento é um só `updateOne` com `$set` e `$push`. O relay busca documentos com `pendingEvents` não vazio, publica e remove o evento com `$pull` pelo `messageId`.

**Idempotência sem tabela extra:**

- `execution.job.enqueue` repetido esbarra no índice único de `orderId` (erro de chave duplicada) e é confirmado sem efeito;
- `execution.job.cancel` é idempotente pela própria regra: cancelar um job já cancelado não muda nada.

## Alternativas descartadas

**PostgreSQL também no Execution.** Funcionaria, mas o enunciado exige um NoSQL, e entre os três serviços este é o que tem o dado menos relacional.

**Redis como banco do Execution.** Redis é ótimo para estado efêmero e chave-valor, mas a fila de execução precisa de consulta por status e prioridade, ordenação e persistência confiável como dado principal. O Redis tem outro papel no sistema ([ADR-013](adr-013-redis-com-dono-unico.md)).

**DynamoDB.** Gerenciado e barato, mas a decisão do projeto foi manter bancos e broker dentro do cluster. Além disso, a consulta "fila por status e prioridade" exigiria um índice secundário global pensado de antemão.

**MongoDB em replica set de um nó, com transações.** Permitiria um outbox em coleção separada, igual aos outros serviços. Descartado pelo custo de configuração (keyfile, `rs.initiate()` no init, *readiness* que espera o primário) sem ganho funcional sobre o outbox embutido.

## Consequências

**Positivas**
- A linha do tempo de um job é lida e gravada inteira, sem *join*.
- O documento evolui sem migration: um campo novo no diagnóstico não exige alterar esquema.
- Outbox atômico sem transação e sem replica set.

**Negativas**
- **Sem esquema no banco.** A validação fica no domínio e no schema do Mongoose. Um documento malformado gravado por fora da aplicação não é barrado pelo banco.
- **`timeline` cresce sem limite** por job. Na prática, são dezenas de entradas, longe do limite de 16 MB por documento.
- **Mais um componente com estado no nó único**, com 256–512 MiB de memória.
- **Sem backup automatizado.** Os dados somem com a destruição do ambiente, o que é aceitável para um ambiente descartável e precisaria de backup do volume (ou Atlas) em produção.
