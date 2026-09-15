import {
  ATTR_SERVICE_VERSION,
  ATTR_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import {
  resourceFromAttributes,
  defaultResource,
} from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  AggregationTemporalityPreference,
  OTLPMetricExporter,
} from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { otelConfig } from '@infrastructure/config/otel.config';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Inicialização do OpenTelemetry.
 *
 * ESTE MÓDULO PRECISA SER CARREGADO ANTES DE QUALQUER OUTRO. As
 * instrumentações automáticas funcionam substituindo métodos dos módulos que
 * instrumentam (http, express, pg, nestjs). Elas só conseguem fazer isso se
 * rodarem antes desses módulos serem carregados — ver o topo de `main.ts`.
 */
let sdk: NodeSDK | undefined;

export function startTracing(): void {
  const config = otelConfig();

  if (!config.enabled) {
    return;
  }

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      'deployment.environment.name': config.environment,
    }),
  );

  const { headers, endpoint } = config;

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers,
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${endpoint}/v1/metrics`,
          headers,
          // DELTA, e não o padrão CUMULATIVE. Com temporalidade cumulativa o
          // New Relic precisa derivar o delta entre pontos consecutivos, e o
          // primeiro ponto de cada série não tem antecessor — o valor dele se
          // perde. Na prática os contadores de negócio chegavam pela metade:
          // seis ordens criadas apareciam como três, e três entregas como
          // nenhuma. Com um Deployment de várias réplicas o erro se multiplica,
          // porque cada pod inicia a própria série.
          temporalityPreference: AggregationTemporalityPreference.DELTA,
        }),
        // 30s mantém o volume de ingestão baixo e ainda dá granularidade
        // suficiente para os dashboards.
        exportIntervalMillis: 30_000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers }),
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Latência de rota HTTP e tempo de query no Postgres saem daqui,
        // sem uma linha de código nos casos de uso.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-pino': {
          // Injeta trace_id e span_id em toda linha de log — é isto que liga
          // um log ao trace da requisição que o gerou.
          enabled: true,
        },
        '@opentelemetry/instrumentation-http': {
          // O Kubernetes bate nos healthchecks a cada 10s em cada pod. Sem
          // ignorar, eles dominariam o volume de traces sem informação alguma.
          ignoreIncomingRequestHook: (request) =>
            (request.url ?? '').startsWith('/api/health'),
        },
      }),
    ],
  });

  sdk.start();

  // Descarrega o buffer antes do processo morrer. Sem isto, o último lote de
  // spans e métricas se perde exatamente quando o pod cai — que é justamente
  // quando esses dados mais importam.
  const shutdown = (): void => {
    void sdk
      ?.shutdown()
      .catch((error: unknown) =>
        console.error('Erro ao encerrar o OpenTelemetry', error),
      )
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
