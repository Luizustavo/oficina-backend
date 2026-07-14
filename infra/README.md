# Infraestrutura (Terraform)

Provisiona, na AWS (região `sa-east-1` por padrão), tudo que a aplicação precisa para rodar em produção. Usa **k3s** (Kubernetes leve, mas 100% real) numa única instância EC2, em vez do EKS gerenciado — isso elimina os dois maiores custos fixos (control plane do EKS + NAT Gateway) e mantém a conta próxima de grátis dentro do free tier de conta nova.

| Recurso | Arquivo | Descrição |
|---|---|---|
| VPC + subnets | `vpc.tf` | 1 VPC, 2 subnets públicas (onde fica o nó k3s) e 2 privadas (onde fica o RDS), sem NAT Gateway |
| Nó Kubernetes (k3s) | `ec2.tf` | 1 instância EC2 rodando k3s (instalado via user-data) com Elastic IP fixo, IAM role com permissão de leitura no ECR e acesso via SSM (sem SSH) |
| Repositório de imagens | `ecr.tf` | ECR para a imagem Docker da aplicação, com policy de lifecycle mantendo só as últimas 10 imagens |
| Banco de dados | `rds.tf` | RDS PostgreSQL, subnet privada, security group liberando porta 5432 apenas para o nó k3s, senha gerada aleatoriamente |
| Alerta de orçamento | `budget.tf` | AWS Budgets — envia e-mail quando o gasto do mês passa de 50% e 100% de `budget_alert_threshold_usd` (padrão: US$12) |

## Por que k3s numa EC2, e não EKS

O control plane do EKS custa US$0,10/hora **sempre**, sem free tier. Já uma EC2 `t3.small`/`t3.micro` e o RDS `db.t4g.micro` são cobertos pelo free tier de conta nova (750h/mês grátis, primeiros 12 meses). Trocando EKS por k3s numa EC2 só, e removendo o NAT Gateway (o nó fica numa subnet pública, com IP público direto), o custo cai de ~US$0,37/hora para perto de zero.

O trade-off: k3s não tem a integração automática da AWS pra criar Load Balancers (`Service type=LoadBalancer` não funciona sozinho como no EKS), então a aplicação é exposta via `NodePort` — acessível direto em `http://<ip-publico-do-node>:30080`.

## Pré-requisitos

- Terraform >= 1.5
- AWS CLI configurado com um profile (`aws configure --profile oficina-fase2`)
- Um usuário IAM com permissões para criar VPC, EC2, RDS, ECR, IAM roles e Budgets

## Como aplicar

```bash
cd infra
terraform init
terraform plan    # revise o que será criado antes de aplicar
terraform apply
```

Leva ~2-3 minutos (bem mais rápido que EKS). Ao final, os outputs mostram:
- `k3s_instance_public_ip` — IP público do nó
- `connect_via_ssm` — comando para abrir um shell no nó sem precisar de chave SSH
- `app_url` — onde a aplicação vai responder depois do deploy no k8s
- `ecr_repository_url` — para onde fazer `docker push`
- `database_url` (sensível — use `terraform output -raw database_url`) — para popular o Secret do Kubernetes. Já inclui `?sslmode=no-verify`: a instância RDS exige conexão criptografada, e o driver usado em runtime (`@prisma/adapter-pg`) não negocia SSL sozinho a partir de uma URL simples

## Depois de aplicar

```bash
# Conectar no nó (sem SSH — via AWS Systems Manager)
$(terraform output -raw connect_via_ssm)

# Dentro do nó, pegar o kubeconfig:
sudo cat /etc/rancher/k3s/k3s.yaml
```

Copie esse conteúdo para sua máquina em `~/.kube/config-k3s`, troque `127.0.0.1` pelo IP público do nó (`terraform output -raw k3s_instance_public_ip`), e use:

```bash
export KUBECONFIG=~/.kube/config-k3s
kubectl get nodes   # deve mostrar o nó "Ready"
```

Depois, siga `/k8s/README.md` para aplicar os manifestos da aplicação.

## Custo aproximado (região `sa-east-1`)

| Recurso | US$/hora | Coberto por free tier (conta nova, 12 meses)? |
|---|---|---|
| EC2 t3.small (nó k3s) | ~0,04 | Não (t3.micro seria grátis, mas é pouca RAM pra demonstrar o HPA escalando bem) |
| RDS db.t4g.micro | ~0,03 | Sim — 750h/mês grátis |
| EBS (20GB) + tráfego | ~0,003 | Parcialmente (30GB/mês grátis) |
| **Total** | **~US$0,04-0,07/hora** | |

Saldo real da conta: **US$120**. Mesmo esquecido ligado o mês inteiro, esse desenho custaria no máximo ~US$50/mês — bem diferente dos ~US$266/mês do desenho anterior com EKS. Ainda assim, siga o checklist abaixo.

## ⚠️ Checklist ao final de cada sessão de trabalho

```bash
cd infra
terraform destroy
```

Confirme rodando:

```bash
terraform show                                    # deve mostrar "No state."
aws ec2 describe-instances --profile oficina-fase2 \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId"  # deve voltar vazio
```

Como rede de segurança adicional, `budget.tf` já cria um alerta por e-mail (AWS Budgets) caso o gasto do mês passe de US$6 (50%) ou US$12 (100%) — mas não confie só nisso, o `destroy` é o que realmente para o custo.

## Variáveis principais

Veja `variables.tf` para a lista completa. Para sobrescrever, copie `terraform.tfvars.example` para `terraform.tfvars` (ignorado pelo git).
