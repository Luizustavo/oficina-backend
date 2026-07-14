# Collection completa da API

`openapi.json` é o spec OpenAPI 3 exportado direto do Swagger da aplicação (35 endpoints). Ao contrário do Swagger UI ao vivo (que só responde enquanto a infraestrutura estiver de pé), este arquivo é versionado no repositório — sempre acessível, independente do estado da infra.

## Como usar

**Postman / Insomnia**: File → Import → selecione `docs/openapi.json` (ou cole a URL raw do GitHub). Gera automaticamente uma collection completa com todos os endpoints, request bodies e respostas de exemplo.

**Swagger Editor**: cole o conteúdo em https://editor.swagger.io para visualizar interativamente.

## Como regenerar

Depois de qualquer mudança na API, com o servidor local rodando (`npm run start:dev`):

```bash
curl -s http://localhost:3000/api/docs-json | python3 -m json.tool > docs/openapi.json
```
