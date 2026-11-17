import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

const controllerWith = (executeRawUnsafe: jest.Mock) =>
  new HealthController({
    $executeRawUnsafe: executeRawUnsafe,
  } as unknown as PrismaService);

describe('HealthController', () => {
  it('is ready when the database answers', async () => {
    await expect(
      controllerWith(jest.fn().mockResolvedValue(1)).ready(),
    ).resolves.toEqual({ status: 'ok' });
  });

  it('answers 503 instead of 500 while the database is down', async () => {
    await expect(
      controllerWith(
        jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ).ready(),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
