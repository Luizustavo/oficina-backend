import {
  CreateServiceUseCase,
  UpdateServiceUseCase,
  ToggleServiceUseCase,
  DeleteServiceUseCase,
  ListServicesUseCase,
  GetServiceUseCase,
} from '@application/use-cases/service/service.use-cases';
import { ServicesController } from '../controllers/services.controller';
import { SERVICE_REPOSITORY } from '@domain/repositories/service.repository.interface';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ServicesController],
  providers: [
    CreateServiceUseCase,
    UpdateServiceUseCase,
    ToggleServiceUseCase,
    DeleteServiceUseCase,
    ListServicesUseCase,
    GetServiceUseCase,
    { provide: SERVICE_REPOSITORY, useClass: ServiceRepository },
  ],
  exports: [{ provide: SERVICE_REPOSITORY, useClass: ServiceRepository }],
})
export class ServicesModule {}
