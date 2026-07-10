import { PartEntity } from '../entities/part/part.entity';

export abstract class IPartRepository {
  abstract findLowStock(): Promise<PartEntity[]>;
  abstract findByCode(code: string): Promise<PartEntity | null>;
  abstract findById(id: string): Promise<PartEntity | null>;
  abstract create(part: PartEntity): Promise<PartEntity>;
  abstract update(part: PartEntity): Promise<PartEntity>;
  abstract delete(id: string): Promise<void>;
  abstract findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: PartEntity[]; total: number }>;
}
