# Subir e derrubar o ambiente

O ambiente da Fase 4 é recriado do zero a cada sessão de trabalho, para não consumir crédito. Este é o roteiro completo, atravessando os seis repositórios.

## Subir

Seis repositórios, nesta ordem. Os workflows de infra aceitam `workflow_dispatch` com `action` = `plan`, `apply` ou `destroy` (*Actions → Run workflow*); **um merge na `main` de um repositório de infra também aplica sozinho**, então só faça merge de infra numa sessão em que for subir o ambiente.

| # | Onde | O que fazer | Espera |
|---|---|---|---|
| 1 | `oficina-infra-k8s` | `apply` | ~5 min. Ao terminar, o workflow **Platform** roda sozinho: namespaces, Secret e StatefulSet do RabbitMQ |
| 2 | `oficina-infra-database` | `apply` | ~8 min (RDS) |
| 3 | `oficina-lambda-auth` | `apply` | ~3 min. Guarde `jwt_secret`, `auth_reader_password` e `api_gateway_url` (`terraform -chdir=infra output -raw …`) |
| 4 | máquina local | kubeconfig pelo SSM ([`oficina-infra-k8s`, Passo 3](https://github.com/Luizustavo/oficina-infra-k8s#passo-3--pegar-o-kubeconfig)) | — |
| 5 | `oficina-backend` | aplicar `namespace.yaml`, `configmap.yaml`, `oficina-db-admin.yaml` (conta mestre do RDS, senha do `os_user`, senha do `auth_reader`) e `secret.yaml` (`DATABASE_URL` com `os_user`, `JWT_SECRET` do passo 3, senha do RabbitMQ) | — |
| 6 | `oficina-billing-service` | aplicar `billing-db-admin.yaml` e `secret.yaml` (inclui `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`) | — |
| 7 | `oficina-execution-service` | aplicar `mongodb-credentials.yaml` e `secret.yaml` | — |
| 8 | os três serviços | rodar o **Deploy to Production** (ou reexecutar o que falhou por falta de infra). O do OS pede aprovação no Environment `production`. O do Billing descobre a URL do API Gateway e grava a `PUBLIC_BASE_URL` do webhook | ~5 min cada, em paralelo |
| 9 | `oficina-backend` | seed: ver [`k8s/README.md`](../../k8s/README.md#populando-dados-de-teste-seed) (o `tsconfig.json` vai para o `/tmp` do pod) | — |
| 10 | Mercado Pago | se usar notificações configuradas no painel, atualizar a URL do webhook para a nova `api_gateway_url` | — |

**Pegadinhas:**
- O login por CPF só funciona **depois** do deploy do OS: é o job de bootstrap dele que cria o usuário `auth_reader` que a Lambda usa.
- A senha do RabbitMQ é sempre a mesma (secret `RABBITMQ_PASSWORD` do Environment `production`); leia do cluster com `kubectl get secret rabbitmq-credentials -n messaging -o jsonpath='{.data.password}' | base64 -d`.
- O `JWT_SECRET` muda a cada `apply` da Lambda (a não ser que `jwt_secret` esteja no `terraform.tfvars`): os três Secrets dos serviços precisam do valor novo.
- Os cenários da saga rodam com `scripts/demo-saga.sh s1` … `s7`.

## Derrubar o ambiente

A rede daqui é pré-requisito do RDS, e a Lambda cria uma regra no security group do RDS. **Destrua sempre nesta ordem, esperando cada um terminar antes de disparar o próximo:**

```
1. oficina-lambda-auth      (destroy)
2. oficina-infra-database   (destroy)
3. oficina-infra-k8s        (destroy)  
```

Invertendo, o destroy do banco ou da rede falha por dependência órfã. O destroy da Lambda pode levar 20 minutos ou mais: a AWS demora a liberar as interfaces de rede que a função usava na VPC, e o Terraform espera.

Ao final de cada sessão de trabalho, confirme que nada ficou ligado:

```bash
aws ec2 describe-instances --profile oficina-fase2 \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId"   # deve voltar vazio
```

O `budget.tf` manda e-mail se o gasto passar dos limites, mas não confie só nisso: o `destroy` é o que realmente para o custo.
