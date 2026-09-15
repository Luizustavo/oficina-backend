# RFC-002 — Escolha do banco de dados

| | |
|---|---|
| **Status** | Aceita |
| **Data** | 2026-09-13 |
| **Decisão** | PostgreSQL 16 gerenciado (Amazon RDS, `db.t4g.micro`) |

---

## Contexto

O sistema gerencia clientes, veículos, catálogo de serviços e peças, e ordens de serviço que atravessam uma máquina de estados. A Fase 3 exige banco gerenciado e pede justificativa formal da escolha.

Três características do domínio orientam a decisão:

**O dado é relacional por natureza.** Cliente tem veículos; veículo tem ordens; ordem tem itens vindos de um catálogo. Essas ligações *são* o dado, não um detalhe de implementação.

**Há operações que exigem atomicidade.** Aprovar um orçamento, numa única operação indivisível: muda o status da ordem, congela o valor total e baixa o estoque das peças. Se metade acontecer, a oficina fica com estoque errado ou com uma ordem aprovada sem valor.

**O volume é modesto.** Uma rede de oficinas gera milhares de ordens por mês, não bilhões de eventos por dia. Não existe pressão de escala que justifique abrir mão de integridade.

## Opções consideradas

### A. PostgreSQL gerenciado (RDS)

- `DECIMAL(10,2)` exato para valores monetários. Ponto flutuante é inaceitável para dinheiro, e este modelo tem preço em cinco colunas diferentes.
- Enums nativos: `ServiceOrderStatus` e `UserRole` viram tipo do banco, não string solta sujeita a erro de digitação.
- Transações ACID resolvem a aprovação de orçamento sem código de compensação.
- `db.t4g.micro` coberto pelo free tier (750h/mês nos primeiros 12 meses).
- Cobertura completa do Prisma, incluindo `DECIMAL`, enums e migrations.

### B. MySQL gerenciado (RDS)

- Atende tudo que o Postgres atende neste caso, com free tier equivalente.
- **Contra:** enums são menos rigorosos e historicamente mais problemáticos em migração. O ecossistema de tipos do Prisma é mais completo no Postgres. Sem vantagem que compense a troca.

### C. DynamoDB

- Serverless de verdade, sem instância para dimensionar, e free tier generoso.
- **Contra decisivo:** não tem junção. Listar ordens com dados de cliente e veículo exigiria desnormalizar tudo ou fazer várias consultas na aplicação — exatamente o problema de integridade que estamos corrigindo nesta fase.
- **Contra:** transação entre itens existe, mas é limitada e cara de modelar para o fluxo de aprovação.
- Escolher DynamoDB seria otimizar para uma escala que este domínio não tem, pagando com consistência que ele exige.

### D. MongoDB (DocumentDB / Atlas)

- O modelo de documento se encaixaria bem na ordem de serviço com seus itens embutidos.
- **Contra decisivo:** foi exatamente esse encaixe que criou o problema desta fase. Os itens da ordem eram um campo `Json`, o que impedia integridade referencial com o catálogo e qualquer consulta analítica. Adotar um banco de documentos institucionalizaria a limitação em vez de corrigi-la.

## Decisão

**PostgreSQL 16 no Amazon RDS, `db.t4g.micro`, single-AZ, em subnet privada.**

O critério decisivo é a combinação de **integridade referencial** com **transação**. O domínio tem regras que atravessam várias tabelas e precisam valer ou falhar juntas; um banco relacional entrega isso como garantia, não como disciplina de código.

Entre os relacionais, PostgreSQL ganha do MySQL por margem estreita — tipos mais rigorosos e melhor suporte do Prisma — e o custo é idêntico.

## Consequências

**Positivas**
- Chave estrangeira impede ordem apontando para serviço inexistente, e impede apagar do catálogo um item referenciado por ordens históricas.
- `DECIMAL(10,2)` elimina erro de arredondamento em valores monetários.
- Backup automático, patching e métricas sem trabalho operacional.
- Consulta analítica direta em SQL, sem desserializar nada na aplicação.

**Negativas**
- **Single-AZ**: a instância é ponto único de falha. Multi-AZ dobra o custo e sai do free tier; aceito conscientemente para um projeto acadêmico, e é a primeira coisa a mudar num desenho de produção.
- `skip_final_snapshot = true` e `deletion_protection = false` estão ligados para o ciclo criar/destruir ser rápido e não deixar snapshot cobrando. **Os dois devem ser invertidos em produção.**
- A instância `db.t4g.micro` tem poucas conexões disponíveis, o que exigiu limitar o pool da Lambda a uma conexão.

## Ajustes no modelo relacional

Esta RFC motivou a mudança de modelagem da fase: os campos `Json` de `ServiceOrder` viraram tabelas de junção com chave estrangeira — ver [ADR-008](../adr/adr-008-tabelas-de-juncao-no-lugar-de-json.md).

Diagrama ER, explicação de cada relacionamento e detalhe dos índices em [modelagem-de-dados.md](../modelagem-de-dados.md).
