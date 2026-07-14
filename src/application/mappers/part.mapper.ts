import { CreatePartRequestDto } from '@application/dtos/request/part.dto';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartEntity } from '@domain/entities/part/part.entity';
import { randomUUID } from 'crypto';

export class PartMapper {
  private constructor() {
    throw new Error('PartMapper is a static class and cannot be instantiated');
  }

  public static toEntity(dto: CreatePartRequestDto): PartEntity {
    return PartEntity.create({ ...dto }, randomUUID());
  }

  public static toResponse(part: PartEntity): PartResponseDto {
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
}
