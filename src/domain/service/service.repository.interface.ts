import { Service } from './service.entity';

export interface IServiceRepository {
  create(service: Service): Promise<Service>;
  findById(id: string): Promise<Service | null>;
  findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: Service[]; total: number }>;
  update(service: Service): Promise<Service>;
  delete(id: string): Promise<void>;
}

export const SERVICE_REPOSITORY = Symbol('IServiceRepository');
