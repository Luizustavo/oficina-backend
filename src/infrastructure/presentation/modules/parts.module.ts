import { Module } from '@nestjs/common';
import { PartsController } from '../controllers/parts.controller';
import {
  CreatePartUseCase,
  GetPartUseCase,
  ListPartsUseCase,
  ListLowStockPartsUseCase,
  UpdatePartUseCase,
  AddStockUseCase,
  RemoveStockUseCase,
  DeletePartUseCase,
} from '../../../application/use-cases/part/part.use-cases';
import { PartRepository } from '../../database/repositories/part.repository';
import { PART_REPOSITORY } from '../../../domain/part/part.repository.interface';

@Module({
  controllers: [PartsController],
  providers: [
    CreatePartUseCase,
    GetPartUseCase,
    ListPartsUseCase,
    ListLowStockPartsUseCase,
    UpdatePartUseCase,
    AddStockUseCase,
    RemoveStockUseCase,
    DeletePartUseCase,
    { provide: PART_REPOSITORY, useClass: PartRepository },
  ],
  exports: [{ provide: PART_REPOSITORY, useClass: PartRepository }],
})
export class PartsModule {}
