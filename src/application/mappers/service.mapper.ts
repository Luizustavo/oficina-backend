import { CreateServiceRequestDto } from '@application/dtos/request/service.dto';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { ServiceEntity } from '@domain/entities/service/service.entity';
import { randomUUID } from 'crypto';

export class ServiceMapper {
  private constructor() {
    throw new Error(
      'ServiceMapper is a static class and cannot be instantiated',
    );
  }

  public static toEntity(dto: CreateServiceRequestDto): ServiceEntity {
    return ServiceEntity.create({ ...dto }, randomUUID());
  }

  public static toResponse(service: ServiceEntity): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
