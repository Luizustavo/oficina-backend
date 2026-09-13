/**
 * Configuração de telemetria, lida num único lugar — mesmo padrão de
 * `jwtConfig()` e `emailConfig()`.
 *
 * O destino padrão é o endpoint OTLP do New Relic. Como OpenTelemetry é um
 * padrão aberto, trocar de fornecedor é mudar `OTEL_EXPORTER_OTLP_ENDPOINT` e
 * o header de autenticação — nenhuma linha de instrumentação muda.
 */
export interface OtelConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  endpoint: string;
  headers: Record<string, string>;
}

export const otelConfig = (): OtelConfig => {
  const licenseKey = process.env.NEW_RELIC_LICENSE_KEY ?? '';

  return {
    // Desligado em teste por padrão: sem isso cada suíte tentaria abrir
    // conexão com um coletor que não existe. Sem chave também não liga.
    enabled:
      process.env.OTEL_ENABLED === 'true' ||
      (process.env.NODE_ENV !== 'test' && licenseKey !== ''),
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'oficina-backend',
    serviceVersion: process.env.APP_VERSION ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    endpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://otlp.nr-data.net',
    headers: licenseKey ? { 'api-key': licenseKey } : {},
  };
};
