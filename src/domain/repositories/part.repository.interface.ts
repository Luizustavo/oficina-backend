import { PartEntity } from '../entities/part/part.entity';

export interface IPartRepository {
  create(part: PartEntity): Promise<PartEntity>;
  findById(id: string): Promise<PartEntity | null>;
  findByCode(code: string): Promise<PartEntity | null>;
  findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: PartEntity[]; total: number }>;
  findLowStock(): Promise<PartEntity[]>;
  update(part: PartEntity): Promise<PartEntity>;
  delete(id: string): Promise<void>;
}

export const PART_REPOSITORY = Symbol('IPartRepository');
