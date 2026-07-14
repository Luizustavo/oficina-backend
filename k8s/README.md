# Manifestos Kubernetes

| Arquivo | Recurso |
|---|---|
| `namespace.yaml` | Namespace `oficina` |
| `configmap.yaml` | Variáveis de ambiente não sensíveis |
| `secret.example.yaml` | Template do Secret — copie para `secret.yaml` (gitignored) e preencha |
| `migration-job.yaml` | Job que roda `prisma migrate deploy` antes do deploy da aplicação |
| `deployment.yaml` | Deployment da aplicação (2 réplicas, probes de liveness/readiness) |
| `service.yaml` | Service `NodePort` (30080), expõe a porta 80 → 3000 |
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

cp secret.example.yaml secret.yaml
# edite secret.yaml: DATABASE_URL (terraform output -raw database_url em /infra,
# já vem com ?sslmode=no-verify — obrigatório, a RDS força SSL),
# JWT_SECRET e JWT_REFRESH_SECRET (openssl rand -hex 32), RESEND_API_KEY
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
kubectl apply -f hpa.yaml
```

## CI/CD (GitHub Actions)

`cd-staging.yml` e `cd-production.yml` rodam depois que o `CI` passa (push em `staging`/`main`), ou manualmente pela aba **Actions → Deploy to Staging/Production → Run workflow**. O pipeline:

1. Autentica na AWS
2. Descobre o nó k3s **por tag** (`Name=oficina-backend-k3s-node`) — não depende do state local do Terraform nem de IP fixo hardcoded, então funciona mesmo depois de um `terraform destroy` + `apply` novo
3. Builda a imagem e publica no ECR (tag = SHA do commit, + `:latest`)
4. Busca o kubeconfig do nó via SSM (mesma técnica usada manualmente, sem SSH)
5. Roda o Job de migração e espera terminar
6. Aplica Deployment (com a imagem nova), Service e HPA

**Secrets necessários no repositório** (Settings → Secrets and variables → Actions), configurados **uma vez só** — são as mesmas credenciais do profile `oficina-fase2` local, não mudam quando a infra é recriada:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Se a infra estiver destruída (`terraform destroy`), o job falha de forma clara no passo "Find the k3s node" — não é um erro silencioso, só significa que precisa rodar `terraform apply` em `/infra` antes.

## Populando dados de teste (seed)

A imagem de produção não inclui `tsconfig.json` (só o `dist` compilado), então rodar o seed exige copiá-lo pro pod primeiro:

```bash
POD=$(kubectl get pods -n oficina -l app=oficina-backend -o jsonpath='{.items[0].metadata.name}')
kubectl cp ../tsconfig.json "oficina/$POD:/app/tsconfig.json"
kubectl exec -n oficina "$POD" -- npm run prisma:seed
```

## Verificando

```bash
kubectl get pods -n oficina
kubectl get hpa -n oficina -w
cd ../infra && terraform output -raw app_url   # http://<ip-publico>:30080
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
