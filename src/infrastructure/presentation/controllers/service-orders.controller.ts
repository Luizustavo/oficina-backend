import {
  CreateServiceOrderRequestDto,
  AddServiceRequestDto,
  AddPartRequestDto,
} from '@application/dtos/request/service-order.dto';
import {
  Controller,
  Query,
  Param,
  Patch,
  Post,
  Body,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ListServiceOrdersByCustomerUseCase } from '@application/use-cases/service-order/list-service-orders-by-customer.use-case';
import { ListServiceOrdersByStatusUseCase } from '@application/use-cases/service-order/list-service-orders-by-status.use-case';
import { GetAverageExecutionTimeUseCase } from '@application/use-cases/service-order/get-average-execution-time.use-case';
import { CreateServiceOrderUseCase } from '@application/use-cases/service-order/create-service-order.use-case';
import { ListServiceOrdersUseCase } from '@application/use-cases/service-order/list-service-orders.use-case';
import { AddServiceToOrderUseCase } from '@application/use-cases/service-order/add-service-to-order.use-case';
import { TrackServiceOrderUseCase } from '@application/use-cases/service-order/track-service-order.use-case';
import { GetServiceOrderSagaUseCase } from '@application/use-cases/saga/get-service-order-saga.use-case';
import { GetServiceOrderUseCase } from '@application/use-cases/service-order/get-service-order.use-case';
import { RequestApprovalUseCase } from '@application/use-cases/service-order/request-approval.use-case';
import { AddPartToOrderUseCase } from '@application/use-cases/service-order/add-part-to-order.use-case';
import { StartDiagnosisUseCase } from '@application/use-cases/service-order/start-diagnosis.use-case';
import { DeliverOrderUseCase } from '@application/use-cases/service-order/deliver-order.use-case';
import { CancelOrderUseCase } from '@application/use-cases/service-order/cancel-order.use-case';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { UserRole } from '@domain/enums/user-role.enum';
import { CustomerScope } from '@infrastructure/presentation/decorators/customer-scope.decorator';
import { Roles } from '@infrastructure/presentation/decorators/roles.decorator';

@ApiTags('service-orders')
@ApiBearerAuth()
@Controller('api/service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly avgExecutionTime: GetAverageExecutionTimeUseCase,
    private readonly requestApproval: RequestApprovalUseCase,
    private readonly listByCustomer: ListServiceOrdersByCustomerUseCase,
    private readonly startDiagnosis: StartDiagnosisUseCase,
    private readonly deliverOrder: DeliverOrderUseCase,
    private readonly listByStatus: ListServiceOrdersByStatusUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly createOrder: CreateServiceOrderUseCase,
    private readonly trackOrder: TrackServiceOrderUseCase,
    private readonly listOrders: ListServiceOrdersUseCase,
    private readonly addService: AddServiceToOrderUseCase,
    private readonly getOrder: GetServiceOrderUseCase,
    private readonly getOrderSaga: GetServiceOrderSagaUseCase,
    private readonly addPart: AddPartToOrderUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service order' })
  async create(@Body() dto: CreateServiceOrderRequestDto) {
    return this.createOrder.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List service orders (paginated). Without a status filter, orders are sorted by priority (IN_PROGRESS > PAID > AWAITING_PAYMENT > AWAITING_APPROVAL > IN_DIAGNOSIS > RECEIVED > CANCELED, oldest first) and COMPLETED/DELIVERED orders are excluded',
  })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ServiceOrderStatus,
  ) {
    return this.listOrders.execute({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @CustomerScope({ param: 'customerId' })
  @Get('customer/:customerId')
  @ApiOperation({ summary: 'List service orders by customer' })
  async listByCustomerHandler(@Param('customerId') customerId: string) {
    return this.listByCustomer.execute(customerId);
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'List service orders by status' })
  async listByStatusHandler(@Param('status') status: ServiceOrderStatus) {
    return this.listByStatus.execute(status);
  }

  @Get('track/:orderNumber')
  @ApiOperation({
    summary:
      'Track a service order by its number (staff only; customers follow their orders through GET /service-orders/:id)',
  })
  async track(@Param('orderNumber') orderNumber: string) {
    return this.trackOrder.execute(orderNumber);
  }

  @Get('metrics/average-execution-time')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Average execution time per service (admin only)' })
  async averageExecutionTime() {
    return this.avgExecutionTime.execute();
  }

  @CustomerScope({ order: 'id' })
  @Get(':id')
  @ApiOperation({ summary: 'Find service order by ID' })
  async findOne(@Param('id') id: string) {
    return this.getOrder.execute(id);
  }

  @CustomerScope({ order: 'id' })
  @Get(':id/saga')
  @ApiOperation({
    summary:
      'Current saga of the order: step, status, deadline, last error and the full event history',
  })
  async findSaga(@Param('id') id: string) {
    return this.getOrderSaga.execute(id);
  }

  @Patch(':id/services')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Add service to order' })
  async addServiceHandler(
    @Param('id') id: string,
    @Body() dto: AddServiceRequestDto,
  ) {
    return this.addService.execute(id, dto);
  }

  @Patch(':id/parts')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({
    summary:
      'Add part to order (checks stock; stock is reserved when the budget is approved)',
  })
  async addPartHandler(
    @Param('id') id: string,
    @Body() dto: AddPartRequestDto,
  ) {
    return this.addPart.execute(id, dto);
  }

  @Patch(':id/start-diagnosis')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: RECEIVED → IN_DIAGNOSIS' })
  async startDiagnosisHandler(@Param('id') id: string) {
    return this.startDiagnosis.execute(id);
  }

  @Patch(':id/request-approval')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({
    summary:
      'Transition: IN_DIAGNOSIS → AWAITING_APPROVAL. Starts the saga: the Billing Service generates the budget, and approval, payment and execution then advance the order through events',
  })
  async requestApprovalHandler(@Param('id') id: string) {
    return this.requestApproval.execute(id);
  }

  @Patch(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: COMPLETED → DELIVERED' })
  async deliverHandler(@Param('id') id: string) {
    return this.deliverOrder.execute(id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({
    summary:
      'Transition: any status before COMPLETED → CANCELED. With a saga running, the saga compensates the current step (cancels the budget, returns the parts, cancels the job, refunds the payment)',
  })
  async cancelHandler(@Param('id') id: string) {
    return this.cancelOrder.execute(id);
  }
}
