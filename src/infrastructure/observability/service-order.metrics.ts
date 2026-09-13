import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

/**
 * Métricas de negócio das ordens de serviço.
 *
 * Os três painéis exigidos pela Fase 3 saem todos daqui:
 *
 *   volume diário de OS        -> soma de `service_order.status_changed`
 *                                 filtrando status = RECEIVED
 *   tempo médio por status     -> média de `service_order.status_duration`
 *                                 agrupada pelo atributo `from_status`
 *   erros nas integrações      -> soma de `integration.call` com
 *                                 outcome = failure (ver IntegrationMetrics)
 *
 * Medir na transição, e não com uma query no banco na hora de montar o
 * gráfico, é o que permite ver a oficina em tempo real: o dado chega no
 * painel no próximo ciclo de exportação, sem varrer a tabela de ordens.
 */
@Injectable()
export class ServiceOrderMetrics {
  private readonly meter = metrics.getMeter('oficina-backend.service-order');

  private readonly statusChanged = this.meter.createCounter(
    'service_order.status_changed',
    {
      description: 'Transições de status de ordem de serviço',
      unit: '{transition}',
    },
  );

  private readonly statusDuration = this.meter.createHistogram(
    'service_order.status_duration',
    {
      description: 'Tempo que a ordem passou no status anterior',
      unit: 's',
    },
  );

  /**
   * @param since quando a ordem entrou no status anterior. Ausente na
   *   criação da ordem, que não tem status anterior.
   */
  recordTransition(params: {
    fromStatus: string;
    toStatus: string;
    since?: Date | null;
  }): void {
    const { fromStatus, toStatus, since } = params;

    // O id da ordem não vira atributo de propósito: é alta cardinalidade e
    // explodiria o número de séries temporais, junto com o custo de
    // ingestão. Para rastrear uma ordem específica existem traces e logs.
    this.statusChanged.add(1, {
      from_status: fromStatus,
      to_status: toStatus,
    });

    if (since) {
      const seconds = (Date.now() - since.getTime()) / 1000;
      if (seconds >= 0) {
        this.statusDuration.record(seconds, { from_status: fromStatus });
      }
    }
  }
}
