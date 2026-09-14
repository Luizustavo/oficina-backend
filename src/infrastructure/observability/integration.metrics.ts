import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

/**
 * Falhas em integrações externas.
 *
 * Alimenta o painel "erros e falhas nas integrações" exigido pela Fase 3, e
 * é a base do alerta de indisponibilidade de fornecedor.
 *
 * Fica separada de `ServiceOrderMetrics` porque mede outra coisa: aquela
 * mede o negócio, esta mede a saúde das dependências externas. Integrações
 * novas (gateway de pagamento, SMS) instrumentam aqui sem tocar naquela.
 */
@Injectable()
export class IntegrationMetrics {
  private readonly meter = metrics.getMeter('oficina-backend.integration');

  private readonly calls = this.meter.createCounter('integration.call', {
    description: 'Chamadas a integrações externas, com resultado',
    unit: '{call}',
  });

  private readonly duration = this.meter.createHistogram(
    'integration.duration',
    {
      description: 'Duração das chamadas a integrações externas',
      unit: 's',
    },
  );

  recordSuccess(integration: string, seconds?: number): void {
    this.calls.add(1, { integration, outcome: 'success' });
    if (seconds !== undefined) {
      this.duration.record(seconds, { integration, outcome: 'success' });
    }
  }

  /**
   * @param reason classe do erro, não a mensagem: mensagem costuma carregar
   *   id e timestamp, o que viraria cardinalidade infinita de séries.
   */
  recordFailure(integration: string, reason: string, seconds?: number): void {
    this.calls.add(1, { integration, outcome: 'failure', reason });
    if (seconds !== undefined) {
      this.duration.record(seconds, { integration, outcome: 'failure' });
    }
  }
}
