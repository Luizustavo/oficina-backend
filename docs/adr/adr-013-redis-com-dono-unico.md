# ADR-013 — Redis com dono único: o Billing Service

**Status:** Aceita · **Data:** 2026-11-14

## Contexto

O Billing Service recebe notificações do Mercado Pago por webhook. O Mercado Pago **reenvia a mesma notificação** quando não recebe resposta a tempo, e às vezes envia notificações repetidas mesmo quando recebeu. Sem proteção, o mesmo pagamento confirmado poderia gerar dois eventos `billing.payment.confirmed`.

Além disso, eventos sobre a mesma OS podem chegar quase juntos, como a aprovação do orçamento e o cancelamento manual. Processá-los em paralelo abre espaço para condição de corrida.

O Redis resolve os dois problemas com operações atômicas simples. A dúvida é **quem é dono dele**. A regra do enunciado é que nenhum serviço acessa o banco de outro, e um Redis compartilhado pelos três seria exatamente isso.

## Decisão

**Um Redis 7, com um único dono: o Billing Service.** Ele roda no namespace `billing`, com senha, e nenhum outro serviço recebe as credenciais.

| Uso | Comando | TTL |
|---|---|---|
| Idempotência do webhook | `SET mp:webhook:<paymentId>:<status> 1 NX EX 86400` | 24 h |
| Lock por OS durante o processamento de um comando | `SET lock:order:<orderId> <token> NX PX 30000`, liberado com script Lua que compara o token | 30 s |

Configuração: `appendonly yes`, `maxmemory 64mb`, `maxmemory-policy noeviction`. Chave de idempotência não pode ser despejada para abrir espaço: se a memória acabar, o Redis deve recusar a escrita e não esquecer em silêncio o que já foi processado.

**O Redis não é a única defesa.** A tabela `processed_messages` e a restrição única em `payments.mp_payment_id` no PostgreSQL do Billing continuam valendo. O Redis responde rápido ao caso comum (o reenvio em segundos) sem tocar no banco. O PostgreSQL garante a correção se o Redis tiver sido reiniciado e perdido chaves.

## Alternativas descartadas

**Redis compartilhado pelos três serviços** (com prefixo de chave ou database lógico por serviço). Viola a regra de isolamento, ainda que só por convenção: qualquer serviço com a senha lê e apaga as chaves dos outros.

**Um Redis por serviço.** Atende à regra, mas o OS e o Execution não têm uso real para ele: a idempotência deles fica no próprio banco, na mesma transação do efeito. Seriam dois componentes com estado sem necessidade.

**Só PostgreSQL, sem Redis.** Funcionaria para a idempotência. O lock por OS ficaria em `SELECT … FOR UPDATE` ou *advisory lock*. Descartado porque o Redis faz parte do desenho escolhido para o projeto, e o webhook é o caso em que ele tem uso legítimo: absorver reenvios sem abrir transação no banco.

## Consequências

**Positivas**
- Reenvio do Mercado Pago é descartado em uma operação, antes de qualquer consulta à API deles ou ao banco.
- O isolamento é verificável: só o namespace `billing` tem o Secret com a senha.

**Negativas**
- **Mais um componente com estado no nó** (~32–96 MiB).
- **Lock com TTL não é exclusão mútua perfeita.** Se o processamento passar de 30 s, outro consumidor pode entrar. Por isso o lock é otimização, e a correção vem da idempotência no PostgreSQL.
- Se o Redis estiver fora, o Billing segue funcionando, só que mais lento: cai para a verificação no banco.
