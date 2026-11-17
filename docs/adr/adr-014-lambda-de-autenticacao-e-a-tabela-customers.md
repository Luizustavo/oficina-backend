# ADR-014 — A Lambda de autenticação e a tabela `customers`

**Status:** Aceita · **Data:** 2026-11-14

## Contexto

A Lambda de autenticação por CPF (`oficina-lambda-auth`) consulta o PostgreSQL diretamente, com `pg` e sem passar pela API:

```sql
SELECT id, name, email, document FROM customers WHERE document = $1
```

A tabela `customers` pertence ao banco do **OS Service** (`oficina_db`). A Fase 4 traz uma regra explícita: **nenhum serviço pode acessar diretamente o banco de outro serviço.** Se a Lambda for vista como um serviço à parte, ela viola essa regra.

## Opções

**A) A Lambda faz parte da fronteira do OS Service.** O dono do dado de cliente é o OS Service, e a Lambda é um componente desse mesmo serviço, que roda fora do cluster por um motivo técnico (é chamada pelo API Gateway antes de qualquer token existir). Ela fica em repositório próprio porque o ciclo de deploy dela é Terraform, e não `kubectl`.

**B) A Lambda chama um endpoint interno do OS Service.** Ela deixa de conhecer o banco e passa a chamar, por exemplo, `GET /internal/customers/by-document/:cpf`. Isso exige:
- expor esse endpoint sem passar pelo authorizer, mas sem deixá-lo público (rede ou segredo compartilhado);
- fazer a Lambda alcançar o nó do k3s: hoje ela está na VPC, nas subnets privadas, e o nó só aceita a NodePort vinda do API Gateway;
- tratar a indisponibilidade do OS Service no login: hoje a Lambda depende só do RDS.

**C) Mover clientes para um Customer/Identity Service.** Descartado na [ADR-009](adr-009-divisao-em-microsservicos.md).

## Decisão

**Opção A.** A Lambda de autenticação é parte do OS Service, e isso fica declarado na arquitetura:

- no diagrama de componentes, a Lambda aparece **dentro** da caixa do OS Service, com a anotação "implantado como função serverless";
- os READMEs do `oficina-lambda-auth` e do `oficina-backend` declaram que os dois repositórios formam um único serviço lógico, e que a tabela `customers` e o formato do campo `document` são contrato entre eles (como já registrado no `CLAUDE.md` da raiz);
- o Billing e o Execution **não** acessam `oficina_db`, e o banco garante isso: cada um tem usuário próprio, sem permissão de conexão nesse database ([ADR-009](adr-009-divisao-em-microsservicos.md)).

### Usuários do banco com o mínimo de privilégio

*(Registrado como evolução na primeira versão desta ADR e feito na etapa 8.)*

A Lambda só precisa ler quatro colunas de uma tabela, e o OS Service só precisa do próprio banco. Nenhum dos dois usa mais a conta mestre do RDS:

- **`auth_reader`** (Lambda de CPF): `CONNECT` só no `oficina_db` e `SELECT (id, name, email, document) ON customers`, nada mais. A senha é gerada pelo Terraform do `oficina-lambda-auth` (output `auth_reader_password`), que monta a `DATABASE_URL` da Lambda com ela;
- **`os_user`** (OS Service): `CONNECT` só no `oficina_db` e dono das tabelas que a migração cria.

Os dois usuários são criados de dentro da VPC por um job do `oficina-backend` (`k8s/db-bootstrap-job.yaml`, idempotente, antes de cada migração), com a conta mestre. O `GRANT` das colunas roda no job de migração, logo depois do `migrate deploy`, porque a tabela só existe depois dele. Com o `CONNECT` do `PUBLIC` revogado no `oficina_db` e no `billing_db`, o banco garante a fronteira: nenhum usuário de serviço conecta no banco de outro.

## Justificativa

A regra do enunciado protege contra um problema concreto: **dois serviços com donos diferentes acoplados pelo esquema do banco**, de modo que um não pode mudar uma tabela sem quebrar o outro. Na opção A, a Lambda e o OS Service têm o mesmo dono, mudam juntos e esse acoplamento já está documentado como contrato. A Lambda é um *adapter* de entrada do OS Service que roda em outro runtime.

A opção B compraria pureza arquitetural com três problemas novos: rede entre a Lambda e o cluster, um endpoint interno para proteger e o login passando a depender do OS Service estar de pé. Tudo isso para trocar uma consulta de uma linha por uma chamada HTTP.

## Consequências

**Positivas**
- Login por CPF continua com uma única dependência (o RDS) e latência de uma consulta.
- Nenhuma mudança de rede ou de segurança na VPC.

**Negativas**
- **A fronteira do OS Service atravessa dois repositórios e dois runtimes.** Quem muda `customers` precisa lembrar da Lambda. Mitigado pelo contrato documentado no `CLAUDE.md` da raiz e pela duplicação consciente da validação de CPF ([ADR-006](adr-006-duplicacao-da-validacao-de-cpf.md)).
- **É uma interpretação da regra, e precisa ser defendida.** Um avaliador pode ver a Lambda como "outro serviço lendo o banco". Esta ADR e o diagrama existem para que essa leitura não aconteça.
- Mais um segredo para manter em sincronia: a senha do `auth_reader` sai do Terraform da Lambda e precisa ir para o Secret `oficina-db-admin` do OS, como já acontece com o `JWT_SECRET`. Se divergirem, o login por CPF falha até o próximo deploy do OS.

## Quando revisitar

Se o Customer/Identity Service vier a existir, a Lambda passa a fazer parte da fronteira dele. Também é hora de revisitar se a Lambda precisar de qualquer dado além de `customers`.
