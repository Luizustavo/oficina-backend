# Manifestos Kubernetes

| Arquivo | Recurso |
|---|---|
| `namespace.yaml` | Namespace `oficina` |
| `configmap.yaml` | Variáveis de ambiente não sensíveis |
| `secret.example.yaml` | Template do Secret — copie para `secret.yaml` (gitignored) e preencha |
| `oficina-db-admin.example.yaml` | Template do Secret usado só pelo bootstrap do banco (URL da conta mestre do RDS e senhas dos dois usuários) |
| `db-bootstrap-job.yaml` | Job que cria o `os_user` e o `auth_reader` no RDS (idempotente) |
| `migration-job.yaml` | Job que roda `prisma migrate deploy` (como `os_user`) e libera as colunas de `customers` para o `auth_reader` |
| `deployment.yaml` | Deployment da aplicação (2 réplicas, probes de liveness/readiness) |
| `service.yaml` | Service `ClusterIP`, expõe a porta 80 → 3000 dentro do cluster |
| `ingress.yaml` | Rota `/api` no Traefik, que atende a porta pública 30080 (ver ADR-015) |
| `hpa.yaml` | HorizontalPodAutoscaler (2-6 réplicas, CPU e memória a 70%) |

## Pré-requisitos

- Cluster provisionado (veja `/infra`) e `kubectl` apontando para ele — depois do `terraform apply` em `/infra`:
  ```bash
  cd ../infra
  $(terraform output -raw connect_via_ssm)   # abre um shell no nó via SSM
  # dentro do nó:
  sudo cat /etc/rancher/k3s/k3s.yaml
  # copie o conteúdo para ~/.kube/config-k3s na sua máquina, trocando 127.0.0.1
  # pelo IP público (terraform output -raw k3s_instance_public_ip), depois:
  export KUBECONFIG=~/.kube/config-k3s
  ```
- `metrics-server` já vem pronto e funcional no k3s por padrão — não precisa instalar nada, confirme com `kubectl top nodes`.

## Primeira vez após cada `terraform apply`

Namespace, ConfigMap e Secret carregam configuração/segredos que não mudam a cada deploy, então são aplicados **uma vez à mão** (não fazem parte do pipeline de CD — assim a senha do banco e as chaves de API nunca precisam virar secret do GitHub):

```bash
cd k8s

kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml

cp oficina-db-admin.example.yaml oficina-db-admin.yaml
# edite oficina-db-admin.yaml: ADMIN_DATABASE_URL (terraform output -raw database_url
# no oficina-infra-database: a conta mestre), OS_DB_PASSWORD (crie uma, só letras e
# números) e AUTH_READER_PASSWORD (terraform output -raw auth_reader_password no
# oficina-lambda-auth/infra)
kubectl apply -f oficina-db-admin.yaml

cp secret.example.yaml secret.yaml
# edite secret.yaml: DATABASE_URL (o host do database_url do oficina-infra-database,
# mas com o usuário os_user e a senha OS_DB_PASSWORD; mantenha o ?sslmode=no-verify,
# obrigatório porque a RDS força SSL),
# JWT_SECRET e JWT_REFRESH_SECRET (openssl rand -hex 32), RESEND_API_KEY e
# RABBITMQ_URL (senha do usuário oficina do RabbitMQ: a mesma do secret
# RABBITMQ_PASSWORD do oficina-infra-k8s; ver o comentário no secret.example.yaml)
kubectl apply -f secret.yaml
```

## Deploy da aplicação (imagem, migração, Deployment/Service/HPA)

Isso é o que o pipeline de CD (`.github/workflows/cd-staging.yml` / `cd-production.yml`) automatiza a cada push. Pra rodar manualmente:

```bash
cd k8s
ECR_URL=$(cd ../infra && terraform output -raw ecr_repository_url)

sed "s#REPLACE_WITH_ECR_IMAGE_URI#${ECR_URL}#" migration-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/oficina-backend-migrate -n oficina --timeout=120s

sed "s#REPLACE_WITH_ECR_IMAGE_URI#${ECR_URL}#" deployment.yaml | kubectl apply -f -
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

## CI/CD (GitHub Actions)

`cd-staging.yml` e `cd-production.yml` rodam depois que o `CI` passa (push em `staging`/`main`), ou manualmente pela aba **Actions → Deploy to Staging/Production → Run workflow**. O pipeline:

1. Autentica na AWS
2. Descobre o nó k3s **por tag** (`Name=oficina-backend-k3s-node`) — não depende do state local do Terraform nem de IP fixo hardcoded, então funciona mesmo depois de um `terraform destroy` + `apply` novo
3. Builda a imagem e publica no ECR (tag = SHA do commit, + `:latest`)
4. Busca o kubeconfig do nó via SSM (mesma técnica usada manualmente, sem SSH)
5. Roda o Job de bootstrap do banco (cria ou atualiza o `os_user` e o `auth_reader`) e espera terminar
6. Roda o Job de migração (como `os_user`, mais o `GRANT` para o `auth_reader`) e espera terminar
7. Aplica Deployment (com a imagem nova), Service, Ingress e HPA

**Secrets necessários no repositório** (Settings → Secrets and variables → Actions), configurados **uma vez só** — são as mesmas credenciais do profile `oficina-fase2` local, não mudam quando a infra é recriada:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Se a infra estiver destruída (`terraform destroy`), o job falha de forma clara no passo "Find the k3s node" — não é um erro silencioso, só significa que precisa rodar `terraform apply` em `/infra` antes.

## Usuários do banco (ADR-014)

O OS não usa a conta mestre do RDS. Cada um entra com o mínimo de que precisa:

| Usuário | Quem usa | O que pode |
|---|---|---|
| `os_user` | OS Service (aplicação, migração e seed) | Conecta só no `oficina_db`; dono das tabelas que a migração cria |
| `auth_reader` | Lambda de CPF (`oficina-lambda-auth`) | Conecta só no `oficina_db`; `SELECT` em `id`, `name`, `email` e `document` de `customers`, e nada mais |
| `billing_user` | Billing Service | Conecta só no `billing_db` (criado pelo bootstrap do Billing) |
| conta mestre | Só os jobs de bootstrap | Cria os usuários e os bancos |

Nenhum dos três conecta no banco de outro: o `CONNECT` do `PUBLIC` é revogado no `oficina_db` e no `billing_db`. Para conferir no cluster:

```bash
kubectl run psql --rm -it --image=postgres:16-alpine --restart=Never -n oficina -- \
  psql "postgresql://os_user:$OS_DB_PASSWORD@<rds-endpoint>:5432/billing_db?sslmode=require" -c 'select 1'
# FATAL: permission denied for database "billing_db"
```

## Populando dados de teste (seed)

A imagem de produção não inclui `tsconfig.json` (só o `dist` compilado), e o container roda como o usuário `node`, que não grava em `/app`. Por isso o `tsconfig.json` vai para o `/tmp` do pod, com o `baseUrl` apontando para `/app`:

```bash
POD=$(kubectl get pods -n oficina -l app=oficina-backend -o jsonpath='{.items[0].metadata.name}')
node -e 'const t=require("../tsconfig.json");t.compilerOptions.baseUrl="/app";process.stdout.write(JSON.stringify(t))' \
  | kubectl exec -i -n oficina "$POD" -- sh -c 'cat > /tmp/tsconfig.json && TS_NODE_PROJECT=/tmp/tsconfig.json npm run prisma:seed'
```

## Verificando

```bash
kubectl get pods -n oficina
kubectl get hpa -n oficina -w
kubectl get ingress -n oficina                  # rota /api no Traefik
cd ../infra && terraform output -raw app_url   # http://<ip-publico>:30080 (Traefik)
```

## Demonstrando a escalabilidade automática

Gere carga contra o endpoint público e acompanhe o HPA adicionar réplicas em tempo real:

```bash
APP_URL=$(cd ../infra && terraform output -raw app_url)
kubectl run load-generator --image=busybox:1.36 --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- ${APP_URL}/api/health/live; done"

# Em outro terminal:
kubectl get hpa -n oficina -w
```

Depois de gravar, remova o gerador de carga: `kubectl delete pod load-generator`.
