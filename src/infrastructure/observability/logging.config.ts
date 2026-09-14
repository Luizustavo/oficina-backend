import { randomUUID } from 'crypto';

import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Log estruturado em JSON com correlação entre requisições.
 *
 * Três coisas acontecem aqui:
 *
 * 1. Toda linha vira JSON, não texto — parseável pelo New Relic sem regex.
 * 2. Cada requisição ganha um `requestId`, tirado do header `x-request-id`
 *    quando o cliente (ou o API Gateway) manda um, e gerado quando não manda.
 *    É ele que amarra várias linhas de log à mesma requisição.
 * 3. `trace_id` e `span_id` entram automaticamente, injetados pela
 *    instrumentação Pino do OpenTelemetry — é o que liga o log ao trace
 *    distribuído e permite pular de um para o outro no New Relic.
 *
 * Os casos de uso continuam injetando `Logger` de `@nestjs/common`, como
 * manda a convenção do projeto: `app.useLogger()` troca o destino por baixo,
 * sem que nenhum caso de uso precise mudar.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.cpf',
  'req.body.document',
  'res.headers["set-cookie"]',
];

export const loggingConfig = (): Params => ({
  pinoHttp: {
    level:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

    // Em produção o log sai em JSON de uma linha, que é o que o coletor
    // entende. Em desenvolvimento, colorido e legível por gente.
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'HH:MM:ss' },
          },

    // Sem isto, senha, token e CPF vão parar no log — e log vai para fora.
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },

    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const existing = req.headers['x-request-id'];
      const id =
        (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
      // Devolve ao cliente para que ele consiga citar o id ao reportar um erro.
      res.setHeader('x-request-id', id);
      return id;
    },

    customProps: () => ({
      service: process.env.OTEL_SERVICE_NAME ?? 'oficina-backend',
      env: process.env.NODE_ENV ?? 'development',
    }),

    // Healthcheck a cada 10s por pod: ruído puro, e ainda esconde o que
    // importa quando alguém for ler o log.
    autoLogging: {
      ignore: (req: IncomingMessage) =>
        (req.url ?? '').startsWith('/api/health'),
    },

    customLogLevel: (_req, res: ServerResponse, err?: Error) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  },
});
