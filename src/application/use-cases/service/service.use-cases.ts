import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IServiceRepository } from '../../../domain/repositories/service.repository.interface';
import { ServiceEntity } from '../../../domain/entities/service/service.entity';
import { NotFoundException } from '../../../shared/exceptions/domain.exceptions';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
} from '../../dtos/request/service.dto';
import { ServiceResponseDto } from '../../dtos/response/service.dto';
import { PaginatedResponseDto } from '../../dtos/common.dto';

function toResponse(service: ServiceEntity): ServiceResponseDto {
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

@Injectable()
export class CreateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(dto: CreateServiceRequestDto): Promise<ServiceResponseDto> {
    const service = ServiceEntity.create({ ...dto }, randomUUID());
    const created = await this.serviceRepository.create(service);
    return toResponse(created);
  }
}

@Injectable()
export class GetServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(id: string): Promise<ServiceResponseDto> {
    const service = await this.serviceRepository.findById(id);
    if (!service) throw new NotFoundException('Service', id);
    return toResponse(service);
  }
}

@Injectable()
export class ListServicesUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(params: {
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }): Promise<PaginatedResponseDto<ServiceResponseDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const { data, total } = await this.serviceRepository.findAll({
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
export class UpdateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(
    id: string,
    dto: UpdateServiceRequestDto,
  ): Promise<ServiceResponseDto> {
    const service = await this.serviceRepository.findById(id);
    if (!service) throw new NotFoundException('Service', id);
    service.update(dto);
    const updated = await this.serviceRepository.update(service);
    return toResponse(updated);
  }
}

@Injectable()
export class ToggleServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(id: string): Promise<ServiceResponseDto> {
    const service = await this.serviceRepository.findById(id);
    if (!service) throw new NotFoundException('Service', id);
    service.toggleActive();
    const updated = await this.serviceRepository.update(service);
    return toResponse(updated);
  }
}

@Injectable()
export class DeleteServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(id: string): Promise<void> {
    const service = await this.serviceRepository.findById(id);
    if (!service) throw new NotFoundException('Service', id);
    await this.serviceRepository.delete(id);
  }
}
