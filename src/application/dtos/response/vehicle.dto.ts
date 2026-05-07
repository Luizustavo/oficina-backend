export interface VehicleResponseDto {
  id: string;
  customerId: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}
