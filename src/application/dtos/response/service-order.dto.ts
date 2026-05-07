export interface ServiceOrderResponseDto {
  id: string;
  orderNumber: string;
  customerId: string;
  vehicleId: string;
  problemDescription: string;
  status: string;
  services: object[];
  parts: object[];
  totalAmount: number;
  notes?: string;
  approvedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackServiceOrderResponseDto {
  orderNumber: string;
  status: string;
  problemDescription: string;
  services: object[];
  totalAmount: number;
  createdAt: Date;
  approvedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
}

export interface ServiceExecutionMetrics {
  serviceId: string;
  serviceName: string;
  averageMinutes: number;
  completedCount: number;
}

export interface AverageExecutionTimeResponseDto {
  globalAverageMinutes: number;
  completedOrders: number;
  byService: ServiceExecutionMetrics[];
}
