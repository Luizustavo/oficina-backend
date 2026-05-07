export interface PartResponseDto {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  stockQuantity: number;
  minStockQuantity: number;
  isActive: boolean;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}
