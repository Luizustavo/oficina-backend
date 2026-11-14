# ADR-015 — Traefik como ponto de entrada no cluster

**Status:** Aceita · **Data:** 2026-11-14

## Contexto

Até a Fase 3, o API Gateway encaminhava todo o tráfego para um único destino: `http://<ip-do-nó>:30080`, a NodePort do `Service` do `oficina-backend`. Com três serviços ([ADR-009](adr-009-divisao-em-microsservicos.md)), o tráfego precisa ser separado por caminho:

| Prefixo | Destino |
|---|---|
| `/api/billing/*` | Billing Service |
| `/api/execution/*` | Execution Service |
| `/api/*` (o resto) | OS Service |

A porta 30080 é um contrato entre três repositórios: o `Service` do `oficina-backend`, a variável `k3s_node_port` do `oficina-infra-k8s` (regra do security group) e o `local` `k3s_node_port` em `oficina-lambda-auth/infra/data.tf` (destino da integração do API Gateway).

## Decisão

**O Traefik que já vem instalado no k3s passa a ser o dono da NodePort 30080** e roteia por caminho para `Service`s do tipo `ClusterIP` nos namespaces de cada serviço.

- Um `HelmChartConfig` muda o service do Traefik para `NodePort`, com `ports.web.nodePort: 30080`. Ele é escrito pelo user-data do nó (`oficina-infra-k8s/k3s-user-data.sh.tpl`) na pasta `/var/lib/rancher/k3s/server/manifests/`, que o k3s aplica sozinho ao subir. A porta vem da mesma variável `k3s_node_port` que libera o security group, então o valor fica definido num lugar só.
- Cada serviço publica um `Ingress` no próprio namespace, com o seu prefixo. O Traefik dá prioridade à regra mais longa, então `/api/billing` vence `/api`.
- O `Service` do `oficina-backend` deixa de ser `NodePort` e vira `ClusterIP`.

**Os três contratos da porta 30080 não mudam**: o security group e o API Gateway continuam apontando para a mesma porta. O que muda é quem atende nela.

### Ordem da migração

A porta não pode ter dois donos ao mesmo tempo. Por isso:

1. o `Service` do `oficina-backend` como `ClusterIP`, junto com o `Ingress` `/api`, precisa estar na `main` **antes** do próximo `apply` do `oficina-infra-k8s`;
2. o nó novo nasce com o Traefik já na 30080, e o deploy seguinte do OS Service encontra a porta livre para o Traefik.

Como a infraestrutura é recriada a cada sessão de trabalho, não há migração com o cluster no ar. Se houvesse, a API ficaria fora do ar por alguns segundos entre trocar o `Service` e reconfigurar o Traefik.

## Alternativas descartadas

**Uma NodePort por serviço (30080, 30081, 30082)** e uma integração do API Gateway para cada. Seriam três regras no security group, três integrações e rotas por prefixo no Terraform da Lambda, além de três contratos de porta em vez de um. Toda vez que um serviço novo surgisse, três repositórios mudariam.

**Ingress NGINX.** Funcionaria, mas seria instalar um segundo controlador de ingress num cluster que já tem um, gastando memória no nó único.

**API Gateway roteando direto para cada serviço**, sem ingress. É a mesma coisa que uma NodePort por serviço, só com outro nome.

## Consequências

**Positivas**
- Um serviço novo só precisa de um `Ingress`. API Gateway, security group e Terraform não mudam.
- Nenhum contrato entre repositórios é alterado.
- Os serviços deixam de ser expostos na rede do nó: só o Traefik é.

**Negativas**
- **Um salto a mais** em toda requisição: API Gateway → Traefik → pod. A latência acrescentada é de poucos milissegundos.
- **O Traefik vira ponto único de entrada.** Se ele cair, os três serviços ficam inalcançáveis. Isso já era verdade para o nó único ([ADR-001](adr-001-k3s-em-ec2-no-lugar-do-eks.md)).
- **Configuração do k3s passa a fazer parte da infraestrutura versionada.** Uma reinstalação do k3s sem o `HelmChartConfig` devolveria o Traefik ao modo `LoadBalancer` e tiraria a API do ar. Por isso o manifesto fica no user-data do nó, versionado no `oficina-infra-k8s`, e o workflow de plataforma de lá confere a porta depois de cada `apply`.
