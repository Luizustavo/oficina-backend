import { Part } from './part.entity';

export interface IPartRepository {
  create(part: Part): Promise<Part>;
  findById(id: string): Promise<Part | null>;
  findByCode(code: string): Promise<Part | null>;
  findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: Part[]; total: number }>;
  findLowStock(): Promise<Part[]>;
  update(part: Part): Promise<Part>;
  delete(id: string): Promise<void>;
}

export const PART_REPOSITORY = Symbol('IPartRepository');
