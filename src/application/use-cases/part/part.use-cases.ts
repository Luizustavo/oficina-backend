import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IPartRepository } from '../../../domain/repositories/part.repository.interface';
import { PartEntity } from '../../../domain/entities/part/part.entity';
import {
  ConflictException,
  NotFoundException,
} from '../../../shared/exceptions/domain.exceptions';
import {
  CreatePartRequestDto,
  UpdatePartRequestDto,
} from '../../dtos/request/part.dto';
import { PartResponseDto } from '../../dtos/response/part.dto';
import { PaginatedResponseDto } from '../../dtos/common.dto';

function toResponse(part: PartEntity): PartResponseDto {
  return {
    id: part.id,
    name: part.name,
    code: part.code,
    description: part.description,
    price: part.price,
    stockQuantity: part.stockQuantity,
    minStockQuantity: part.minStockQuantity,
    isActive: part.isActive,
    isLowStock: part.isLowStock,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  };
}

@Injectable()
export class CreatePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(dto: CreatePartRequestDto): Promise<PartResponseDto> {
    const existing = await this.partRepository.findByCode(dto.code);
    if (existing)
      throw new ConflictException(
        `PartEntity code "${dto.code}" is already registered`,
      );
    const part = PartEntity.create({ ...dto }, randomUUID());
    const created = await this.partRepository.create(part);
    return toResponse(created);
  }
}

@Injectable()
export class GetPartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string): Promise<PartResponseDto> {
    const part = await this.partRepository.findById(id);
    if (!part) throw new NotFoundException('Part', id);
    return toResponse(part);
  }
}

@Injectable()
export class ListPartsUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(params: {
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }): Promise<PaginatedResponseDto<PartResponseDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const { data, total } = await this.partRepository.findAll({
      skip: (page - 1) * limit,
      take: limit,
      onlyActive: params.onlyActive,
    });
    return {
      data: data.map(toResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

@Injectable()
export class ListLowStockPartsUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(): Promise<PartResponseDto[]> {
    const parts = await this.partRepository.findLowStock();
    return parts.map(toResponse);
  }
}

@Injectable()
export class UpdatePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(
    id: string,
    dto: UpdatePartRequestDto,
  ): Promise<PartResponseDto> {
    const part = await this.partRepository.findById(id);
    if (!part) throw new NotFoundException('Part', id);
    part.update(dto);
    const updated = await this.partRepository.update(part);
    return toResponse(updated);
  }
}

@Injectable()
export class AddStockUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string, quantity: number): Promise<PartResponseDto> {
    const part = await this.partRepository.findById(id);
    if (!part) throw new NotFoundException('Part', id);
    part.addStock(quantity);
    const updated = await this.partRepository.update(part);
    return toResponse(updated);
  }
}

@Injectable()
export class RemoveStockUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string, quantity: number): Promise<PartResponseDto> {
    const part = await this.partRepository.findById(id);
    if (!part) throw new NotFoundException('Part', id);
    part.removeStock(quantity);
    const updated = await this.partRepository.update(part);
    return toResponse(updated);
  }
}

@Injectable()
export class DeletePartUseCase {
  constructor(private readonly partRepository: IPartRepository) {}

  async execute(id: string): Promise<void> {
    const part = await this.partRepository.findById(id);
    if (!part) throw new NotFoundException('Part', id);
    await this.partRepository.delete(id);
  }
}
