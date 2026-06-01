import { ServiceEntity } from '../entities/service/service.entity';

export interface IServiceRepository {
  create(service: ServiceEntity): Promise<ServiceEntity>;
  findById(id: string): Promise<ServiceEntity | null>;
  findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: ServiceEntity[]; total: number }>;
  update(service: ServiceEntity): Promise<ServiceEntity>;
  delete(id: string): Promise<void>;
}

export const SERVICE_REPOSITORY = Symbol('IServiceRepository');
