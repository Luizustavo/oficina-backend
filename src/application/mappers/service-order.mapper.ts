import {
  ServiceOrderResponseDto,
  TrackServiceOrderResponseDto,
} from '@application/dtos/response/service-order.dto';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';

export class ServiceOrderMapper {
  private constructor() {
    throw new Error(
      'ServiceOrderMapper is a static class and cannot be instantiated',
    );
  }

  public static toResponse(order: ServiceOrderEntity): ServiceOrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      problemDescription: order.problemDescription,
      status: order.status,
      services: order.services,
      parts: order.parts,
      totalAmount: order.totalAmount,
      notes: order.notes,
      approvedAt: order.approvedAt,
      startedAt: order.startedAt,
      finishedAt: order.finishedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  public static toTrackResponse(
    order: ServiceOrderEntity,
  ): TrackServiceOrderResponseDto {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      problemDescription: order.problemDescription,
      services: order.services,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      startedAt: order.startedAt,
      finishedAt: order.finishedAt,
      deliveredAt: order.deliveredAt,
    };
  }
}
