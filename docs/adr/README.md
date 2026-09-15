# Architecture Decision Records

Decisões arquiteturais **permanentes** — aquelas cuja reversão custaria caro. Cada uma registra o contexto, a decisão, as alternativas descartadas e, principalmente, as consequências negativas assumidas.

| # | Decisão | Status |
|---|---|---|
| [001](adr-001-k3s-em-ec2-no-lugar-do-eks.md) | k3s numa EC2 no lugar do EKS | Aceita |
| [002](adr-002-hpa-para-escalabilidade.md) | HPA para escalabilidade horizontal | Aceita |
| [003](adr-003-comunicacao-sincrona-rest.md) | Comunicação síncrona por REST | Aceita |
| [004](adr-004-segredos-em-variavel-de-ambiente-na-lambda.md) | Segredos da Lambda em variável de ambiente | Aceita, com ressalva |
| [005](adr-005-terraform-state-compartilhado.md) | Terraform state remoto compartilhado | Aceita |
| [006](adr-006-duplicacao-da-validacao-de-cpf.md) | Duplicar a validação de CPF entre repositórios | Aceita |
| [007](adr-007-opentelemetry-no-lugar-de-agente-proprietario.md) | OpenTelemetry no lugar do agente do fornecedor | Aceita |
| [008](adr-008-tabelas-de-juncao-no-lugar-de-json.md) | Tabelas de junção no lugar de campos Json | Aceita |

## ADR ou RFC?

**RFC** discute um problema em aberto e compara caminhos: escolha da nuvem, do banco, da estratégia de autenticação. **ADR** registra uma decisão já tomada e suas consequências.

Na prática, as RFCs deste projeto originaram ADRs: a [RFC-001](../rfc/rfc-001-escolha-da-nuvem.md) escolheu a AWS, e a ADR-001 registrou como contornar o custo do EKS dentro dela.

## As ressalvas honestas

Nem toda decisão aqui é a que se tomaria em produção. As três que mais destoam:

- **ADR-001** — nó único não entrega a alta disponibilidade que a Fase 3 cita como objetivo. Trade-off de custo, assumido conscientemente.
- **ADR-004** — segredos em variável de ambiente é aceitável num ambiente descartável, e se inverte em produção.
- **RFC-003** — o papel `CUSTOMER` ainda não é escopado: o cliente enxerga mais do que deveria. É a evolução mais urgente.
