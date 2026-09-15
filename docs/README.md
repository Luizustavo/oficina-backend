# Documentação

## Arquitetura

| Documento | Conteúdo |
|---|---|
| [Diagrama de componentes](arquitetura/diagrama-de-componentes.md) | Visão de nuvem: entrada, computação, dados, observabilidade e entrega |
| [Diagramas de sequência](arquitetura/diagramas-de-sequencia.md) | Autenticação por CPF, abertura de ordem, transição de status e máquina de estados |
| [Modelagem de dados](modelagem-de-dados.md) | Diagrama ER, relacionamentos, justificativa do banco e índices |
| [Observabilidade](observabilidade.md) | Instrumentação, consultas NRQL dos dashboards e alertas |

## Decisões

| | |
|---|---|
| [RFCs](rfc/) | Discussão de nuvem, banco e autenticação |
| [ADRs](adr/) | Oito decisões arquiteturais permanentes |

## API

| | |
|---|---|
| [openapi.json](openapi.json) | Especificação OpenAPI, importável no Postman ou Insomnia |
| [openapi.md](openapi.md) | Instruções de importação |

Swagger ao vivo em `{api_gateway_url}/api/docs`, enquanto a infraestrutura estiver provisionada.

## Repositórios

| Repositório | Conteúdo |
|---|---|
| [oficina-backend](https://github.com/Luizustavo/oficina-backend) | Aplicação NestJS (este) |
| [oficina-infra-k8s](https://github.com/Luizustavo/oficina-infra-k8s) | VPC, EC2 com k3s, ECR, orçamento |
| [oficina-infra-database](https://github.com/Luizustavo/oficina-infra-database) | RDS PostgreSQL |
| [oficina-lambda-auth](https://github.com/Luizustavo/oficina-lambda-auth) | Lambda de autenticação e API Gateway |
