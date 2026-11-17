import { SagaStatus } from '@domain/enums/saga.enum';
import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

const FINAL_STATUSES: SagaStatus[] = [
  SagaStatus.COMPLETED,
  SagaStatus.COMPENSATED,
  SagaStatus.FAILED,
];

/**
 * Saúde da saga (ADR-011): quantas começam, quantas compensam e por quê, como
 * terminam e quanto tempo levam. O `trigger` é o tipo do evento que levou à
 * compensação (`billing.budget.rejected`, `saga.payment.timeout`,
 * `execution.job.failed`...): poucos valores, sem ids.
 */
@Injectable()
export class SagaMetrics {
  private readonly meter = metrics.getMeter('oficina-backend.saga');

  private readonly started = this.meter.createCounter('saga.started', {
    description: 'Sagas iniciadas (pedido de aprovação)',
    unit: '{saga}',
  });

  private readonly compensations = this.meter.createCounter(
    'saga.compensations',
    {
      description:
        'Sagas que entraram em compensação, pelo evento que a disparou',
      unit: '{saga}',
    },
  );

  private readonly finished = this.meter.createCounter('saga.finished', {
    description: 'Sagas encerradas, por status final',
    unit: '{saga}',
  });

  private readonly duration = this.meter.createHistogram('saga.duration', {
    description: 'Do pedido de aprovação ao fim da saga',
    unit: 's',
  });

  recordStarted(): void {
    this.started.add(1);
  }

  recordTransition(params: {
    from: SagaStatus;
    to: SagaStatus;
    trigger: string;
    startedAt: Date;
  }): void {
    const { from, to, trigger, startedAt } = params;

    if (
      from === SagaStatus.RUNNING &&
      to !== SagaStatus.RUNNING &&
      to !== SagaStatus.COMPLETED
    ) {
      this.compensations.add(1, { trigger });
    }

    if (from !== to && FINAL_STATUSES.includes(to)) {
      this.finished.add(1, { status: to });
      this.duration.record((Date.now() - startedAt.getTime()) / 1000, {
        status: to,
      });
    }
  }
}
