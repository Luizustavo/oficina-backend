import { ServiceEntity } from '@domain/entities/service/service.entity';

export abstract class IServiceRepository {
  abstract findById(id: string): Promise<ServiceEntity | null>;
  abstract create(service: ServiceEntity): Promise<ServiceEntity>;
  abstract delete(id: string): Promise<void>;
  abstract update(service: ServiceEntity): Promise<ServiceEntity>;
  abstract findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: ServiceEntity[]; total: number }>;
}
