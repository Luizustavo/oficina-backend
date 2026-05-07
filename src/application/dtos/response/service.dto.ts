export interface ServiceResponseDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
