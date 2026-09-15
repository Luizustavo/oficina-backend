# ADR-008 — Tabelas de junção no lugar de campos Json

**Status:** Aceita · **Data:** 2026-09-14

## Contexto

Até a Fase 2, os itens de uma ordem de serviço eram dois campos `Json`:

```prisma
model ServiceOrder {
  services Json
  parts    Json
}
```

Funcionava para gravar e ler a ordem inteira. Falhava em todo o resto:

1. **Sem integridade referencial.** Nada impedia gravar um `serviceId` inexistente, nem apagar do catálogo um serviço referenciado por dezenas de ordens. O banco aceitava calado.
2. **Sem consulta analítica.** "Qual o serviço mais vendido no trimestre?" exigiria varrer todas as ordens e desserializar Json na aplicação.
3. **Sem tipo.** `price` dentro do Json era número JavaScript — ponto flutuante binário, o oposto do que se usa para dinheiro. Fora do Json, a mesma grandeza é `DECIMAL(10,2)`.
4. **Sem restrição.** Nada garantia `quantity` positivo, nem que o formato do objeto não mudasse entre gravações.

## Decisão

Duas tabelas de junção com chave estrangeira:

```
service_orders ──< service_order_services >── services
               ──< service_order_parts    >── parts
```

`ON DELETE CASCADE` no lado da ordem; `ON DELETE RESTRICT` no lado do catálogo.

**O domínio não mudou.** A entidade continua trabalhando com `ServiceItem[]` e `PartItem[]` em memória; só o mapper e o repositório sabem que virou relação. Foi possível porque a camada de domínio já estava isolada da persistência.

### Três sub-decisões

**Nome e preço continuam duplicados na junção.** Parece redundância e não é: é um instantâneo deliberado do catálogo no momento do orçamento. Reajustar a troca de óleo de R$ 150 para R$ 180 não pode mudar o valor de uma ordem já aprovada. A FK garante rastreabilidade; a cópia garante imutabilidade do que foi acordado.

**`totalPrice` saiu, `totalAmount` ficou.** Duas redundâncias aparentemente iguais, tratadas de forma oposta:

| Campo | Destino | Motivo |
|---|---|---|
| `ServiceOrderPart.totalPrice` | removido | Era `unitPrice × quantity`, duas colunas **da mesma linha**. Guardar o produto ao lado dos fatores só permite que os três se contradigam |
| `ServiceOrder.totalAmount` | mantido | É soma de **duas tabelas filhas**. Recalcular exigiria join com agregação em toda listagem, e é o valor que o cliente aprovou |

A regra: derivação dentro da mesma linha é redundância pura; agregação entre tabelas é valor com significado próprio.

**Coluna `position`.** Preserva a ordem de inclusão. Sem ela, a ordem de leitura é indefinida e a resposta da API mudaria entre requisições.

## Consequências

**Positivas**
- O banco passa a impedir ordem apontando para serviço inexistente, e a proteger o histórico contra exclusão no catálogo.
- Consulta analítica em SQL direto.
- `DECIMAL(10,2)` em todo valor monetário.
- Índices nas FKs viabilizam as consultas que antes exigiriam varredura completa.

**Negativas**
- **Toda leitura precisa de `include`.** Esquecer de incluir os itens devolve uma ordem sem eles, com total inconsistente. Centralizado na constante `WITH_ITEMS` do repositório para reduzir o risco.
- **`update` substitui os filhos por inteiro** (`deleteMany` + `create`). É correto e transacional, mas recria as linhas a cada alteração, trocando os ids dos itens. Aceitável porque eles não têm identidade externa.
- **Mais uma consulta por leitura**, mitigada pelos índices em `serviceOrderId`.
- A migração é irreversível na prática: voltar exigiria remontar o Json.

## Migração

Escrita à mão, porque **preserva os dados**. Uma migração gerada automaticamente teria apagado as colunas `Json` e, junto, os itens de todas as ordens já cadastradas.

Usa `jsonb_array_elements ... WITH ORDINALITY`, cujo índice de cada elemento vira a coluna `position`. Sequência: criar tabelas → copiar dados → remover colunas `Json` → criar índices e FKs.

`totalAmount` não é recalculado durante a migração: é registro financeiro histórico.

Validada contra um Postgres real, populado no schema antigo com ordens de múltiplos itens, notas nulas e arrays vazios.

## Verificação

`test/integration/service-order.repository.integration-spec.ts`, contra Postgres real. Escrita de relação aninhada, ordem dos itens, integridade referencial e cascade são coisas que só o banco decide — e foi ele que reprovou o erro de passar o escalar `serviceId` junto com `service: { connect }`, que typecheck e testes unitários não pegaram.
