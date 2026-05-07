import { Module } from '@nestjs/common';
import { ServicesController } from '../controllers/services.controller';
import {
  CreateServiceUseCase,
  GetServiceUseCase,
  ListServicesUseCase,
  UpdateServiceUseCase,
  ToggleServiceUseCase,
  DeleteServiceUseCase,
} from '../../../application/use-cases/service/service.use-cases';
import { ServiceRepository } from '../../database/repositories/service.repository';
import { SERVICE_REPOSITORY } from '../../../domain/service/service.repository.interface';

@Module({
  controllers: [ServicesController],
  providers: [
    CreateServiceUseCase,
    GetServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
    ToggleServiceUseCase,
    DeleteServiceUseCase,
    { provide: SERVICE_REPOSITORY, useClass: ServiceRepository },
  ],
  exports: [{ provide: SERVICE_REPOSITORY, useClass: ServiceRepository }],
})
export class ServicesModule {}
