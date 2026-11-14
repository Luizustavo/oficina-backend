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

### Melhoria recomendada: usuário só de leitura para a Lambda

Hoje a Lambda conecta com o usuário administrador do RDS, o mesmo de `database_url`. Ela só precisa ler quatro colunas de uma tabela. O ideal é um usuário `auth_reader` com `SELECT (id, name, email, document) ON customers` e nada mais.

Isso depende de criar o usuário de dentro da VPC (o RDS é privado) e de passar a senha para a Lambda via Terraform. Fica registrado como evolução, e **não** como requisito desta fase.

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
- Enquanto a melhoria do usuário só de leitura não for feita, a Lambda tem mais privilégio do que precisa.

## Quando revisitar

Se o Customer/Identity Service vier a existir, a Lambda passa a fazer parte da fronteira dele. Também é hora de revisitar se a Lambda precisar de qualquer dado além de `customers`.
