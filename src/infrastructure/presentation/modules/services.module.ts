import { CreateServiceUseCase } from '@application/use-cases/service/create-service.use-case';
import { UpdateServiceUseCase } from '@application/use-cases/service/update-service.use-case';
import { ToggleServiceUseCase } from '@application/use-cases/service/toggle-service.use-case';
import { DeleteServiceUseCase } from '@application/use-cases/service/delete-service.use-case';
import { ListServicesUseCase } from '@application/use-cases/service/list-services.use-case';
import { ServicesController } from '@infrastructure/presentation/controllers/services.controller';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { GetServiceUseCase } from '@application/use-cases/service/get-service.use-case';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { Logger, Module } from '@nestjs/common';

@Module({
  controllers: [ServicesController],
  providers: [
    Logger,
    CreateServiceUseCase,
    UpdateServiceUseCase,
    ToggleServiceUseCase,
    DeleteServiceUseCase,
    ListServicesUseCase,
    GetServiceUseCase,
    { provide: IServiceRepository, useClass: ServiceRepository },
  ],
  exports: [{ provide: IServiceRepository, useClass: ServiceRepository }],
})
export class ServicesModule {}
