import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IServiceOrderRepository,
  SERVICE_ORDER_REPOSITORY,
} from '../../../domain/repositories/service-order.repository.interface';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository.interface';
import {
  IVehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/repositories/vehicle.repository.interface';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../../domain/repositories/service.repository.interface';
import {
  IPartRepository,
  PART_REPOSITORY,
} from '../../../domain/repositories/part.repository.interface';
import { ServiceOrderEntity } from '../../../domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '../../../domain/validators/value-objects/service-order-status.value-object';
import {
  NotFoundException,
  InsufficientStockException,
  BusinessRuleException,
} from '../../../shared/exceptions/domain.exceptions';
import {
  CreateServiceOrderRequestDto,
  AddServiceRequestDto,
  AddPartRequestDto,
} from '../../dtos/request/service-order.dto';
import {
  ServiceOrderResponseDto,
  TrackServiceOrderResponseDto,
  AverageExecutionTimeResponseDto,
  ServiceExecutionMetrics,
} from '../../dtos/response/service-order.dto';
import { PaginatedResponseDto } from '../../dtos/common.dto';

function toResponse(order: ServiceOrderEntity): ServiceOrderResponseDto {
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

function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `OS${year}${random}`;
}

@Injectable()
export class CreateServiceOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(
    dto: CreateServiceOrderRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    const customerExists = await this.customerRepository.existsById(
      dto.customerId,
    );
    if (!customerExists)
      throw new NotFoundException('Customer', dto.customerId);

    const vehicle = await this.vehicleRepository.findById(dto.vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle', dto.vehicleId);
    if (vehicle.customerId !== dto.customerId) {
      throw new BusinessRuleException(
        'Vehicle does not belong to the specified customer',
      );
    }

    const order = ServiceOrderEntity.create({
      orderNumber: generateOrderNumber(),
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      problemDescription: dto.problemDescription,
      notes: dto.notes,
    }, randomUUID());

    const created = await this.orderRepository.create(order);
    return toResponse(created);
  }
}

@Injectable()
export class GetServiceOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    return toResponse(order);
  }
}

@Injectable()
export class ListServiceOrdersUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
    status?: ServiceOrderStatus;
  }): Promise<PaginatedResponseDto<ServiceOrderResponseDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const { data, total } = await this.orderRepository.findAll({
      skip: (page - 1) * limit,
      take: limit,
      status: params.status,
    });
    return {
      data: data.map(toResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

@Injectable()
export class ListServiceOrdersByCustomerUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(customerId: string): Promise<ServiceOrderResponseDto[]> {
    const orders = await this.orderRepository.findByCustomerId(customerId);
    return orders.map(toResponse);
  }
}

@Injectable()
export class ListServiceOrdersByStatusUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderResponseDto[]> {
    const orders = await this.orderRepository.findByStatus(status);
    return orders.map(toResponse);
  }
}

@Injectable()
export class AddServiceToOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: IServiceRepository,
  ) {}

  async execute(
    orderId: string,
    dto: AddServiceRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException('ServiceOrder', orderId);

    const service = await this.serviceRepository.findById(dto.serviceId);
    if (!service) throw new NotFoundException('Service', dto.serviceId);
    if (!service.isActive)
      throw new BusinessRuleException(
        `Service "${service.name}" is not active`,
      );

    order.addService({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      quantity: dto.quantity ?? 1,
      notes: dto.notes,
    });

    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class AddPartToOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
    @Inject(PART_REPOSITORY) private readonly partRepository: IPartRepository,
  ) {}

  async execute(
    orderId: string,
    dto: AddPartRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException('ServiceOrder', orderId);

    const part = await this.partRepository.findById(dto.partId);
    if (!part) throw new NotFoundException('Part', dto.partId);
    if (!part.isActive)
      throw new BusinessRuleException(`Part "${part.name}" is not active`);
    if (!part.hasEnoughStock(dto.quantity)) {
      throw new InsufficientStockException(
        part.name,
        dto.quantity,
        part.stockQuantity,
      );
    }

    order.addPart({
      partId: part.id,
      partName: part.name,
      partCode: part.code,
      unitPrice: part.price,
      quantity: dto.quantity,
      totalPrice: Math.round(part.price * dto.quantity * 100) / 100,
    });

    part.decrementStock(dto.quantity);

    await this.partRepository.update(part);
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class StartDiagnosisUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.startDiagnosis();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.requestApproval();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class ApproveOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.approve();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class CompleteOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.complete();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class DeliverOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.deliver();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('ServiceOrder', id);
    order.cancel();
    const updated = await this.orderRepository.update(order);
    return toResponse(updated);
  }
}

@Injectable()
export class TrackServiceOrderUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(orderNumber: string): Promise<TrackServiceOrderResponseDto> {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) throw new NotFoundException('ServiceOrder', orderNumber);
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

@Injectable()
export class GetAverageExecutionTimeUseCase {
  constructor(
    @Inject(SERVICE_ORDER_REPOSITORY)
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async execute(): Promise<AverageExecutionTimeResponseDto> {
    const orders = await this.orderRepository.findAllCompleted();

    if (orders.length === 0) {
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

    return {
      globalAverageMinutes,
      completedOrders: orders.length,
      byService,
    };
  }
}
