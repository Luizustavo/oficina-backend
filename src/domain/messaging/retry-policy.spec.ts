import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';
import {
  deadLetterQueueName,
  decideOnFailure,
  retryQueueName,
  RETRY_DELAYS_MS,
} from './retry-policy';

describe('retry policy', () => {
  const queue = 'os.saga-events';

  it('should wait 5 s, 30 s and 2 min between attempts', () => {
    expect(RETRY_DELAYS_MS).toEqual([5_000, 30_000, 120_000]);
  });

  it('should name retry and dead letter queues after the main queue', () => {
    expect(retryQueueName(queue, 2)).toBe('os.saga-events.retry.2');
    expect(deadLetterQueueName(queue)).toBe('os.saga-events.dlq');
  });

  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
  ])(
    'should retry a transient failure (x-retry-count %i → attempt %i)',
    (retryCount, attempt) => {
      expect(decideOnFailure(queue, retryCount, new Error('db busy'))).toEqual({
        action: 'retry',
        attempt,
        retryQueue: `os.saga-events.retry.${attempt}`,
      });
    },
  );

  it('should dead-letter after the third retry', () => {
    expect(decideOnFailure(queue, 3, new Error('still failing'))).toEqual({
      action: 'dead-letter',
    });
  });

  it('should reject an invalid message without retrying', () => {
    expect(
      decideOnFailure(queue, 0, new InvalidMessageException('bad JSON')),
    ).toEqual({ action: 'reject' });
  });

  it('should treat a broken retry counter as the first delivery', () => {
    expect(decideOnFailure(queue, -4, new Error('x'))).toMatchObject({
      action: 'retry',
      attempt: 1,
    });
  });
});
