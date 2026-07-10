import {
  ListLowStockPartsUseCase,
  RemoveStockUseCase,
  DeletePartUseCase,
  CreatePartUseCase,
  UpdatePartUseCase,
  ListPartsUseCase,
  AddStockUseCase,
  GetPartUseCase,
} from '@application/use-cases/part/part.use-cases';
import { PartsController } from '../controllers/parts.controller';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';
import { Module } from '@nestjs/common';

@Module({
  controllers: [PartsController],
  providers: [
    ListLowStockPartsUseCase,
    RemoveStockUseCase,
    CreatePartUseCase,
    UpdatePartUseCase,
    DeletePartUseCase,
    ListPartsUseCase,
    AddStockUseCase,
    GetPartUseCase,
    { provide: IPartRepository, useClass: PartRepository },
  ],
  exports: [{ provide: IPartRepository, useClass: PartRepository }],
})
export class PartsModule {}
