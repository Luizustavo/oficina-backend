import { ServiceOrderMetrics } from './service-order.metrics';
import { IntegrationMetrics } from './integration.metrics';
import { metrics } from '@opentelemetry/api';

const add = jest.fn();
const record = jest.fn();

const fakeMeter = {
  createCounter: jest.fn(() => ({ add })),
  createHistogram: jest.fn(() => ({ record })),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(metrics, 'getMeter')
    .mockReturnValue(
      fakeMeter as unknown as ReturnType<typeof metrics.getMeter>,
    );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ServiceOrderMetrics', () => {
  it('conta a transição com os status de origem e destino', () => {
    new ServiceOrderMetrics().recordTransition({
      fromStatus: 'RECEIVED',
      toStatus: 'IN_DIAGNOSIS',
    });

    expect(add).toHaveBeenCalledWith(1, {
      from_status: 'RECEIVED',
      to_status: 'IN_DIAGNOSIS',
    });
  });

  it('não usa o id da ordem como atributo', () => {
    // Alta cardinalidade explodiria o número de séries temporais e o custo
    // de ingestão. Para rastrear uma ordem específica existem traces e logs.
    new ServiceOrderMetrics().recordTransition({
      fromStatus: 'RECEIVED',
      toStatus: 'IN_DIAGNOSIS',
    });

    const attributes = add.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(attributes)).toEqual(['from_status', 'to_status']);
  });

  it('mede quanto tempo a ordem passou no status anterior', () => {
    const doisMinutosAtras = new Date(Date.now() - 120_000);

    new ServiceOrderMetrics().recordTransition({
      fromStatus: 'IN_DIAGNOSIS',
      toStatus: 'AWAITING_APPROVAL',
      since: doisMinutosAtras,
    });

    expect(record).toHaveBeenCalledTimes(1);
    const [seconds, attributes] = record.mock.calls[0] as [
      number,
      Record<string, unknown>,
    ];
    expect(seconds).toBeGreaterThanOrEqual(119);
    expect(seconds).toBeLessThan(125);
    expect(attributes).toEqual({ from_status: 'IN_DIAGNOSIS' });
  });

  it('não mede duração quando não há status anterior', () => {
    // É o caso da criação da ordem: ela nasce, não veio de lugar nenhum.
    new ServiceOrderMetrics().recordTransition({
      fromStatus: 'NONE',
      toStatus: 'RECEIVED',
    });

    expect(add).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it('descarta duração negativa em vez de poluir o histograma', () => {
    // Relógio do pod adiantado em relação ao do banco produz isso.
    new ServiceOrderMetrics().recordTransition({
      fromStatus: 'RECEIVED',
      toStatus: 'IN_DIAGNOSIS',
      since: new Date(Date.now() + 60_000),
    });

    expect(record).not.toHaveBeenCalled();
  });
});

describe('IntegrationMetrics', () => {
  it('registra sucesso com duração', () => {
    new IntegrationMetrics().recordSuccess('resend', 0.42);

    expect(add).toHaveBeenCalledWith(1, {
      integration: 'resend',
      outcome: 'success',
    });
    expect(record).toHaveBeenCalledWith(0.42, {
      integration: 'resend',
      outcome: 'success',
    });
  });

  it('registra falha com a classe do erro como motivo', () => {
    new IntegrationMetrics().recordFailure('resend', 'TypeError', 1.5);

    expect(add).toHaveBeenCalledWith(1, {
      integration: 'resend',
      outcome: 'failure',
      reason: 'TypeError',
    });
  });

  it('aceita chamada sem duração', () => {
    new IntegrationMetrics().recordSuccess('resend');

    expect(add).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });
});
