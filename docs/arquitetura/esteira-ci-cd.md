# Esteira de CI/CD dos microsserviços

Esteira padrão dos três serviços (OS Service, Billing Service, Execution Service). Cada repositório tem a sua cópia, independente das outras: um serviço é testado, analisado e publicado sem depender do pipeline dos demais. O `oficina-backend` (OS Service) é o modelo. Os outros copiam os dois arquivos de workflow e mudam só as variáveis do topo.

## Visão geral

```mermaid
flowchart LR
    PR[Pull Request para main] --> CI
    subgraph CI [ci.yml]
        L[Lint]
        U[Unit Tests<br/>cobertura ≥ 80%]
        Q[Quality<br/>SonarCloud]
        I[Integration Tests]
        E[E2E Tests]
        B[Build<br/>imagem Docker]
        U --> Q
        L & Q & I & E --> B
    end
    CI -->|todos verdes| M[Merge na main]
    M --> CI2[ci.yml roda de novo na main]
    CI2 -->|sucesso| CD
    subgraph CD [cd-production.yml]
        A[Aprovação no Environment production] --> P[Build + push da imagem no ECR]
        P --> MG[Migração do banco<br/>se houver]
        MG --> D[kubectl apply + rollout]
    end
```

## CI (`.github/workflows/ci.yml`)

Roda em todo Pull Request e em todo push para `main`.

| Job | O que faz | Reprova quando |
|---|---|---|
| `Lint` | ESLint | Qualquer erro de lint |
| `Unit Tests (coverage)` | `npm test -- --coverage` e guarda o `coverage/lcov.info` como artefato | Um teste falha ou a cobertura de `domain/` + `application/` fica abaixo de 80% (`coverageThreshold`) |
| `Quality (SonarCloud)` | Envia o código e o lcov ao SonarCloud e **espera o Quality Gate** (`sonar.qualitygate.wait=true`) | O Quality Gate reprova: cobertura do código novo < 80%, bugs, vulnerabilidades, *security hotspots* não revisados ou duplicação acima do limite |
| `Integration Tests` | Testes contra um Postgres de verdade (container de serviço do Actions) | Um teste falha |
| `E2E Tests` | Sobe a API e faz requisições HTTP | Um teste falha |
| `Build` | `npm run build` e `docker build` (sem push) | O código não compila ou a imagem não builda |

O `Build` só roda se todos os outros passarem.

### Cobertura: o que entra na conta

O Jest mede e cobra 80% das camadas de **domínio e aplicação** (`collectCoverageFrom` no `package.json`), onde ficam as regras de negócio. O `sonar-project.properties` usa o mesmo recorte em `sonar.coverage.exclusions`. Controllers, repositórios, módulos do Nest e bootstrap são exercitados pelos testes de integração e E2E. Assim o número que o SonarCloud mostra é o mesmo que o CI cobra.

### SonarCloud

- A análise automática do SonarCloud fica **desligada**: a análise vem do CI, que é quem tem o relatório de cobertura.
- A organização e a chave do projeto ficam nas variáveis `SONAR_ORGANIZATION` e `SONAR_PROJECT_KEY` do job `quality`. O token fica no secret `SONAR_TOKEN` do repositório.
- O SonarCloud comenta o resultado do Quality Gate no próprio PR.

## CD (`.github/workflows/cd-production.yml`)

Dispara quando o CI termina com sucesso na `main`, ou à mão (**Actions → Deploy to Production → Run workflow**).

1. **Aprovação.** O job roda no Environment `production`, que exige aprovação do dono do repositório antes de seguir.
2. **Acha o nó k3s** pela tag `Name=oficina-backend-k3s-node`. O IP muda a cada recriação da infra, então nada fica fixo no workflow.
3. **Pega o kubeconfig via SSM**, sem abrir a porta do SSH.
4. **Builda e publica a imagem** no ECR com a tag do commit (e `latest`).
5. **Migração** (só se existir `k8s/migration-job.yaml`): roda o Job e espera terminar antes do deploy.
6. **Deploy:** aplica `deployment.yaml` com a imagem nova e, se existirem, `service.yaml`, `ingress.yaml` e `hpa.yaml`. Depois espera o rollout.

Namespace, ConfigMap e Secret do serviço **não** são aplicados pelo CD: o Secret carrega senhas que não ficam no repositório. Eles são aplicados à mão logo depois de a infra subir (ver `k8s/README.md`).

### Para usar em outro serviço

Copie `ci.yml`, `cd-production.yml` e `sonar-project.properties` e ajuste:

| Onde | Variável | Exemplo (Billing Service) |
|---|---|---|
| `cd-production.yml` | `ECR_REPOSITORY` | `oficina-billing-service` |
| `cd-production.yml` | `K8S_NAMESPACE` | `billing` |
| `cd-production.yml` | `DEPLOYMENT_NAME` | `oficina-billing-service` |
| `ci.yml` (job `quality`) | `SONAR_PROJECT_KEY` | `Luizustavo_oficina-billing-service` |
| `sonar-project.properties` | `sonar.projectKey`, `sonar.projectName`, recorte de cobertura | conforme as pastas do serviço |

Os jobs de integração/E2E mudam conforme o banco do serviço (Postgres para Billing, MongoDB para Execution), mas os nomes dos jobs continuam os mesmos, para a proteção de branch ser igual nos três repositórios.

## Proteção da `main`

Em todos os repositórios de serviço:

- Push direto na `main` é recusado: toda mudança entra por Pull Request.
- O PR só pode ser mergeado com os checks obrigatórios verdes: `Lint`, `Unit Tests (coverage)`, `Quality (SonarCloud)`, `Integration Tests`, `E2E Tests` e `Build`.
- A regra vale também para o administrador (`enforce_admins`).

Para conferir:

```bash
gh api repos/Luizustavo/<repositório>/branches/main/protection \
  --jq '{pr: (.required_pull_request_reviews != null), checks: .required_status_checks.contexts, admins: .enforce_admins.enabled}'
```
