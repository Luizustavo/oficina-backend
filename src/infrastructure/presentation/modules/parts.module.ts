import { ListLowStockPartsUseCase } from '@application/use-cases/part/list-low-stock-parts.use-case';
import { RemoveStockUseCase } from '@application/use-cases/part/remove-stock.use-case';
import { DeletePartUseCase } from '@application/use-cases/part/delete-part.use-case';
import { CreatePartUseCase } from '@application/use-cases/part/create-part.use-case';
import { UpdatePartUseCase } from '@application/use-cases/part/update-part.use-case';
import { ListPartsUseCase } from '@application/use-cases/part/list-parts.use-case';
import { AddStockUseCase } from '@application/use-cases/part/add-stock.use-case';
import { PartsController } from '@infrastructure/presentation/controllers/parts.controller';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { GetPartUseCase } from '@application/use-cases/part/get-part.use-case';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';
import { Logger, Module } from '@nestjs/common';

@Module({
  controllers: [PartsController],
  providers: [
    Logger,
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
