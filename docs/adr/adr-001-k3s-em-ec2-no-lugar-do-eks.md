# ADR-001 — k3s numa EC2 no lugar do EKS

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

A Fase 3 exige um cluster Kubernetes com escalabilidade. O orçamento é de US$ 120 em créditos, sem cartão de reserva.

O control plane do EKS custa **US$ 0,10/hora, sempre**, sem free tier — cerca de US$ 72/mês só por existir, mesmo ocioso. Somado ao NAT Gateway que um desenho com nós privados exigiria (mais ~US$ 35/mês), o custo fixo consumiria o orçamento inteiro em menos de um mês.

## Decisão

Rodar **k3s numa única EC2 `t3.small`**, em subnet pública com IP elástico, sem NAT Gateway. A aplicação é exposta via `Service` do tipo `NodePort` na porta 30080.

k3s é uma distribuição Kubernetes certificada pela CNCF: mesma API, mesmos manifestos, mesmo `kubectl`. Deployment, Service e HPA funcionam sem adaptação.

## Consequências

**Positivas**
- Custo cai de ~US$ 0,37/hora para ~US$ 0,04–0,05/hora.
- Sobe em 2–3 minutos, contra 15–20 do EKS — o ciclo criar/destruir entre sessões de trabalho fica viável.
- Os manifestos são Kubernetes padrão e migram para EKS sem alteração.

**Negativas**
- **Nó único: não há alta disponibilidade.** Perder a instância derruba o sistema. A Fase 3 cita alta disponibilidade como objetivo, e este desenho não a entrega — é o trade-off consciente mais significativo do projeto.
- **`Service type=LoadBalancer` não funciona.** k3s puro não tem a integração AWS que provisiona ELB, daí o `NodePort`.
- **A porta 30080 fica exposta na internet**, contornando o API Gateway. Mitigável restringindo o security group aos ranges do gateway; não feito por ser um ambiente acadêmico.
- O HPA escala pods dentro de um nó só: ao esgotar CPU e memória da `t3.small`, não há para onde crescer.

## Alternativas

**EKS** — resolveria HA e LoadBalancer, mas custa 8× mais em custo fixo. Inviável com o orçamento.

**`t3.micro` em vez de `t3.small`** — seria coberta pelo free tier, mas 1 GB de RAM não sustenta a aplicação mais o agente de observabilidade, e não deixaria margem para demonstrar o HPA escalando.

## Quando revisitar

Se o projeto sair do escopo acadêmico. A migração para EKS é um `terraform apply` num módulo diferente, com os mesmos manifestos.
