import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * Descreve a rota de autenticação por CPF no documento OpenAPI.
 *
 * Ela não é servida por esta aplicação — quem responde é a função serverless
 * do repositório `oficina-lambda-auth`, acionada pelo API Gateway. Mas ela
 * faz parte da **API pública** do sistema, e é por onde o cliente obtém o
 * token que as rotas protegidas exigem. Deixá-la de fora do Swagger faria a
 * documentação descrever um contrato incompleto: quem abrisse a página não
 * teria como descobrir como se autenticar.
 *
 * Como o Swagger é servido através do próprio gateway, o "Try it out" desta
 * rota funciona normalmente — a requisição sai para a mesma origem e o
 * gateway a encaminha para a Lambda.
 */
export function addLambdaAuthPath(document: OpenAPIObject): OpenAPIObject {
  document.paths['/auth/cpf'] = {
    post: {
      tags: ['auth'],
      summary: 'Autenticação do cliente por CPF (função serverless)',
      description:
        'Atendida por uma AWS Lambda, não por esta aplicação. Valida os ' +
        'dígitos verificadores do CPF, confirma que o cliente existe na base ' +
        'e devolve um JWT com `role: CUSTOMER`. Use o token em **Authorize** ' +
        'para consumir as rotas protegidas como cliente.\n\n' +
        'Responde **401** tanto para cliente inexistente quanto para inativo: ' +
        'diferenciar os dois casos transformaria o endpoint num oráculo para ' +
        'descobrir quais CPFs estão cadastrados.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['cpf'],
              properties: {
                cpf: {
                  type: 'string',
                  example: '529.982.247-25',
                  description: 'Com ou sem pontuação.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Token emitido',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  expiresIn: { type: 'string', example: '15m' },
                  customer: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      email: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description:
            'CPF ausente, malformado ou com dígito verificador inválido',
        },
        '401': { description: 'Cliente não encontrado ou inativo' },
        '503': { description: 'Banco de dados indisponível' },
      },
    },
  };
  return document;
}
