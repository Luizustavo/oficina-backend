# ADR-005 — Terraform state remoto compartilhado entre repositórios

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

A Fase 3 exige quatro repositórios separados, três deles com Terraform, cada um com CI/CD e deploy automático. Isso cria dois problemas.

**Primeiro: state local não funciona em CI.** O state estava no disco do desenvolvedor. Um pipeline não tem acesso a ele, e dois pipelines simultâneos corromperiam qualquer arquivo compartilhado sem trava.

**Segundo: os recursos são interdependentes, mas os repositórios não.** O RDS precisa da VPC, das subnets privadas e do security group do nó — todos criados no repositório de Kubernetes. A Lambda precisa da rede *e* da connection string do banco.

## Decisão

**Um bucket S3 com uma chave por repositório**, e leitura cruzada via `terraform_remote_state`.

```
s3://oficina-backend-tfstate-<account-id>/
  ├── k8s/terraform.tfstate
  ├── database/terraform.tfstate
  └── lambda/terraform.tfstate
```

Trava nativa do S3 (`use_lockfile = true`, disponível desde o Terraform 1.11) — **sem tabela DynamoDB**. Versionamento ligado, criptografia AES256, acesso público bloqueado.

O bucket é criado uma única vez por `scripts/bootstrap-backend.sh`, fora do Terraform. É o problema do ovo e da galinha: o Terraform precisa do bucket para guardar o state, e criar o bucket com Terraform geraria um state sem onde morar.

### O contrato entre repositórios

`oficina-infra-k8s` expõe três outputs tratados como **API pública** — renomear qualquer um quebra o apply dos outros dois:

```
vpc_id · private_subnet_ids · k3s_node_security_group_id
```

`oficina-infra-database` acrescenta `rds_security_group_id` e `database_url`.

### Onde mora a regra que abre a porta do banco

A Lambda precisa alcançar a 5432 do RDS, mas o security group do RDS pertence ao repositório do banco.

A regra de ingress foi colocada no **repositório da Lambda**, como `aws_vpc_security_group_ingress_rule` apontando para o SG remoto. O motivo: é ali que nasce o security group de origem. Colocá-la no repositório do banco exigiria que ele conhecesse a Lambda, invertendo a dependência entre os states e criando um ciclo.

## Consequências

**Positivas**
- `terraform apply` funciona em CI, com trava impedindo execução concorrente.
- Versionamento do bucket permite voltar um state corrompido.
- Sem DynamoDB: um recurso a menos para provisionar, monitorar e pagar.
- Nenhuma duplicação de recurso de rede — uma única fonte de verdade para a VPC.

**Negativas**
- **Ordem obrigatória de apply:** `k8s` → `database` → `lambda`. E de destroy, exatamente a inversa.
- **Acoplamento por output.** Um rename inocente em `outputs.tf` quebra outro repositório, e a quebra só aparece no pipeline dele. Mitigado por comentário explícito marcando os outputs como contrato público.
- **O state contém segredos** — a senha do RDS em texto plano. Daí a criptografia e o bloqueio de acesso público serem obrigatórios, não opcionais.
- O bootstrap é um passo manual fora do Terraform.

## Mitigação da ordem obrigatória

Cada pipeline dependente confere a existência do state de que precisa (`scripts/check-infra-deps.sh`) antes de rodar Terraform. Se faltar, o `plan` **pula** com aviso explícito no resumo do job, e o `apply` **falha** com mensagem dizendo qual repositório aplicar primeiro.

A assimetria é proposital: infraestrutura ausente é o estado normal entre sessões de trabalho, porque ela é destruída para não gerar custo. Falhar nesse caso deixaria um sinal vermelho permanente num repositório correto — e um sinal sempre vermelho é um sinal que todos aprendem a ignorar. Já um apply que vira no-op silencioso é pior que um apply que falha.

## Alternativas

**Terraform workspaces** — um state por workspace no mesmo config. Não resolve: os repositórios têm configs diferentes, não ambientes diferentes do mesmo config.

**Um repositório único de infraestrutura** — eliminaria o acoplamento, mas a Fase 3 exige a separação.

**Data sources em vez de remote state** (`aws_vpc` por tag) — desacoplaria os states, ao custo de depender de convenção de tag em vez de contrato explícito, e de falhar em tempo de execução em vez de em tempo de plan.
