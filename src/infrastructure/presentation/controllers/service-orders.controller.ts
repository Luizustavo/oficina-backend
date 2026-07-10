import { ListServiceOrdersByCustomerUseCase } from '@application/use-cases/service-order/list-service-orders-by-customer.use-case';
import { ListServiceOrdersByStatusUseCase } from '@application/use-cases/service-order/list-service-orders-by-status.use-case';
import { GetAverageExecutionTimeUseCase } from '@application/use-cases/service-order/get-average-execution-time.use-case';
import { CreateServiceOrderUseCase } from '@application/use-cases/service-order/create-service-order.use-case';
import { ListServiceOrdersUseCase } from '@application/use-cases/service-order/list-service-orders.use-case';
import { AddServiceToOrderUseCase } from '@application/use-cases/service-order/add-service-to-order.use-case';
import { TrackServiceOrderUseCase } from '@application/use-cases/service-order/track-service-order.use-case';
import { GetServiceOrderUseCase } from '@application/use-cases/service-order/get-service-order.use-case';
import { RequestApprovalUseCase } from '@application/use-cases/service-order/request-approval.use-case';
import { AddPartToOrderUseCase } from '@application/use-cases/service-order/add-part-to-order.use-case';
import { StartDiagnosisUseCase } from '@application/use-cases/service-order/start-diagnosis.use-case';
import { ApproveOrderUseCase } from '@application/use-cases/service-order/approve-order.use-case';
import { CompleteOrderUseCase } from '@application/use-cases/service-order/complete-order.use-case';
import { DeliverOrderUseCase } from '@application/use-cases/service-order/deliver-order.use-case';
import { CancelOrderUseCase } from '@application/use-cases/service-order/cancel-order.use-case';
import {
  Controller,
  Query,
  Param,
  Patch,
  Post,
  Body,
  Get,
} from '@nestjs/common';
import {
  CreateServiceOrderRequestDto,
  AddServiceRequestDto,
  AddPartRequestDto,
} from '@application/dtos/request/service-order.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { UserRole } from '@domain/enums/user-role.enum';
import { Public } from '@infrastructure/presentation/decorators/public.decorator';
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
    private readonly completeOrder: CompleteOrderUseCase,
    private readonly deliverOrder: DeliverOrderUseCase,
    private readonly approveOrder: ApproveOrderUseCase,
    private readonly listByStatus: ListServiceOrdersByStatusUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly createOrder: CreateServiceOrderUseCase,
    private readonly trackOrder: TrackServiceOrderUseCase,
    private readonly listOrders: ListServiceOrdersUseCase,
    private readonly addService: AddServiceToOrderUseCase,
    private readonly getOrder: GetServiceOrderUseCase,
    private readonly addPart: AddPartToOrderUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service order' })
  async create(@Body() dto: CreateServiceOrderRequestDto) {
    return this.createOrder.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all service orders (paginated)' })
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
  @Public()
  @ApiOperation({
    summary: 'Track service order by number (public, no auth required)',
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

  @Get(':id')
  @ApiOperation({ summary: 'Find service order by ID' })
  async findOne(@Param('id') id: string) {
    return this.getOrder.execute(id);
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
  @ApiOperation({ summary: 'Add part to order (decrements stock)' })
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
  @ApiOperation({ summary: 'Transition: IN_DIAGNOSIS → AWAITING_APPROVAL' })
  async requestApprovalHandler(@Param('id') id: string) {
    return this.requestApproval.execute(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: AWAITING_APPROVAL → IN_PROGRESS' })
  async approveHandler(@Param('id') id: string) {
    return this.approveOrder.execute(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: IN_PROGRESS → COMPLETED' })
  async completeHandler(@Param('id') id: string) {
    return this.completeOrder.execute(id);
  }

  @Patch(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: COMPLETED → DELIVERED' })
  async deliverHandler(@Param('id') id: string) {
    return this.deliverOrder.execute(id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Transition: any → CANCELED' })
  async cancelHandler(@Param('id') id: string) {
    return this.cancelOrder.execute(id);
  }
}
