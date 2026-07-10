import { Injectable, Logger } from '@nestjs/common';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import {
  AverageExecutionTimeResponseDto,
  ServiceExecutionMetrics,
} from '@application/dtos/response/service-order.dto';

@Injectable()
export class GetAverageExecutionTimeUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<AverageExecutionTimeResponseDto> {
    this.logger.log('Calculating average execution time metrics');

    const orders = await this.orderRepository.findAllCompleted();

    if (orders.length === 0) {
      this.logger.log('No completed service orders found');
      return { globalAverageMinutes: 0, completedOrders: 0, byService: [] };
    }

    const durations = orders.map(
      (o) => (o.finishedAt!.getTime() - o.startedAt!.getTime()) / 60000,
    );
    const globalAverageMinutes = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length,
    );

    const serviceMap = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const order of orders) {
      const durationMin =
        (order.finishedAt!.getTime() - order.startedAt!.getTime()) / 60000;
      for (const s of order.services as Array<{
        serviceId: string;
        serviceName: string;
      }>) {
        const entry = serviceMap.get(s.serviceId) ?? {
          name: s.serviceName,
          total: 0,
          count: 0,
        };
        entry.total += durationMin;
        entry.count += 1;
        serviceMap.set(s.serviceId, entry);
      }
    }

    const byService: ServiceExecutionMetrics[] = Array.from(
      serviceMap.entries(),
    ).map(([serviceId, { name, total, count }]) => ({
      serviceId,
      serviceName: name,
      averageMinutes: Math.round(total / count),
      completedCount: count,
    }));

    this.logger.log(
      `Average execution time calculated from ${orders.length} completed orders`,
    );

    return {
      globalAverageMinutes,
      completedOrders: orders.length,
      byService,
    };
  }
}
