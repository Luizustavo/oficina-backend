# ADR-009 — Divisão em três microsserviços

**Status:** Aceita · **Data:** 2026-11-14

## Contexto

Até a Fase 3, toda a regra de negócio da oficina vivia em um único serviço NestJS (`oficina-backend`) com um único banco PostgreSQL. A Fase 4 parte de um cenário novo: a oficina opera em escala nacional, com várias filiais, e as áreas de atendimento, diagnóstico, execução e cobrança passaram a ter ritmos e volumes diferentes.

O enunciado exige:

- no mínimo **três microsserviços independentes**, cada um com **repositório, infraestrutura e banco próprios**;
- pelo menos **um banco relacional** e **um não relacional**;
- **nenhum serviço acessando o banco de outro**.

## Decisão

Três serviços, seguindo as fronteiras sugeridas no enunciado:

| Serviço | Repositório | Responsabilidade | Banco |
|---|---|---|---|
| **OS Service** | `oficina-backend` | Abertura e consulta da OS, máquina de estados, histórico, cadastro (clientes, veículos, usuários), catálogo de serviços e peças, estoque, **orquestrador da saga** ([ADR-011](adr-011-saga-orquestrada.md)) | PostgreSQL (`oficina_db`, RDS) |
| **Billing Service** | `oficina-billing-service` | Geração do orçamento, aprovação ou recusa, cobrança no Mercado Pago, confirmação e estorno de pagamento | PostgreSQL (`billing_db`, mesmo RDS, usuário próprio) + Redis ([ADR-013](adr-013-redis-com-dono-unico.md)) |
| **Execution Service** | `oficina-execution-service` | Fila de execução, diagnóstico técnico, reparo e comunicação da finalização | MongoDB ([ADR-012](adr-012-mongodb-no-execution-service.md)) |

O OS Service continua no repositório `oficina-backend`. O nome é um contrato com a infraestrutura: o `project_name` do `oficina-infra-k8s` define a tag do nó (`oficina-backend-k3s-node`) e o repositório no ECR que o CD usa. Renomear teria custo sem trazer benefício.

### Por que o banco de cada serviço

**OS Service → PostgreSQL.** O cadastro e a OS são relacionais por natureza: OS → cliente → veículo, itens com chave estrangeira para o catálogo ([ADR-008](adr-008-tabelas-de-juncao-no-lugar-de-json.md)), estoque que não pode ficar negativo. É o banco que o serviço já usa, com as migrations existentes.

**Billing Service → PostgreSQL.** Dinheiro pede transação ACID, `DECIMAL` e restrição de unicidade: um pagamento do Mercado Pago não pode ser registrado duas vezes, e o estorno precisa apontar para um pagamento existente. Fica em um **database separado no mesmo RDS** (`billing_db`), com usuário próprio e sem permissão de conexão para o usuário do OS. O isolamento é garantido pelo banco, não só pela disciplina do código. Uma segunda instância RDS dobraria o custo sem mudar esse isolamento.

**Execution Service → MongoDB.** Um job de execução é um documento com linha do tempo de tamanho variável: notas de diagnóstico, trocas de mecânico, pausas, motivo de falha. Esse formato não tem um esquema fixo que valha a pena normalizar. Ver [ADR-012](adr-012-mongodb-no-execution-service.md).

### Por que cadastro, catálogo e estoque ficam no OS Service

Ficar com o cadastro, o catálogo e o estoque faz do OS Service o maior dos três. Os outros dois cortes possíveis foram avaliados e descartados:

**Estoque em serviço próprio.** A reserva de peças é um **passo compensável da saga**: baixa quando o orçamento é aprovado e devolve quando a OS é cancelada. Com o estoque no mesmo serviço do orquestrador, reservar e devolver são operações locais, na mesma transação que muda o status da OS. Em outro serviço, cada reserva viraria um par comando/evento a mais na saga, com seu próprio caso de falha.

**Customer/Identity Service (quarto serviço).** Seria o corte mais natural: clientes, veículos, usuários e emissão de token, com a Lambda de CPF dentro da sua fronteira. Foi descartado porque:

1. **Não participa da saga.** A abertura, o orçamento, o pagamento e a execução não dependem de nenhuma operação de cadastro durante o fluxo.
2. **Cria um problema de dado distribuído sem necessidade.** A OS precisa validar cliente e veículo na abertura e mostrar nome e placa em toda consulta. Separar exigiria chamada síncrona ou cópia local alimentada por eventos, além de remover as chaves estrangeiras entre `service_orders`, `customers` e `vehicles`.
3. **Custo fixo de um serviço inteiro**: repositório, esteira, SonarCloud, cobertura de 80%, documentação e memória no nó único ([ADR-001](adr-001-k3s-em-ec2-no-lugar-do-eks.md)).

Para que o cadastro continue sendo uma fronteira interna clara, e não um emaranhado:

- **A OS grava o que precisa do cliente e do veículo.** Na abertura, `customerName`, `customerEmail` e `vehiclePlate` são copiados para a própria `ServiceOrder`, como os nomes e preços dos itens já são ([ADR-008](adr-008-tabelas-de-juncao-no-lugar-de-json.md)). As transições de status e o e-mail deixam de consultar o cadastro.
- **Nenhum caso de uso de OS importa repositório de cliente ou veículo**, exceto a criação da OS.

## Consequências

**Positivas**
- Cada área do enunciado (atendimento, cobrança, execução) pode ser publicada, escalada e falhar de forma independente.
- O Mercado Pago, a integração mais instável, fica isolado: uma indisponibilidade dele atrasa o Billing, mas não impede abrir ou consultar uma OS.
- Bancos escolhidos pela forma do dado, e não por uniformidade.

**Negativas**
- **O OS Service é o maior dos três**, com três contextos internos (cadastro, catálogo/estoque, OS). A fronteira entre eles é mantida por convenção de módulo, não por processo separado.
- **Os dados copiados para a OS podem ficar desatualizados.** Se o cliente trocar de e-mail depois de abrir a OS, as notificações daquela OS continuam indo para o e-mail antigo. Isso é aceito: o e-mail da OS é o contato registrado no atendimento.
- **Consistência eventual entre serviços.** O status da OS e o do pagamento ficam iguais em instantes, não na mesma transação. É o problema que a saga ([ADR-011](adr-011-saga-orquestrada.md)) resolve.
- **Três pipelines, três conjuntos de manifestos, três READMEs** para manter.

## Quando revisitar

Se o cadastro passar a ser consumido por outro sistema além da OS (portal do cliente, CRM), ou se a emissão de token precisar sair da Lambda. Nesse ponto, o Customer/Identity Service deixa de ser custo sem retorno.
