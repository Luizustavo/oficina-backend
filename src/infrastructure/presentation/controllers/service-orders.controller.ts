import {
  ListServiceOrdersByCustomerUseCase,
  ListServiceOrdersByStatusUseCase,
  GetAverageExecutionTimeUseCase,
  CreateServiceOrderUseCase,
  ListServiceOrdersUseCase,
  AddServiceToOrderUseCase,
  TrackServiceOrderUseCase,
  GetServiceOrderUseCase,
  RequestApprovalUseCase,
  AddPartToOrderUseCase,
  StartDiagnosisUseCase,
  ApproveOrderUseCase,
  CompleteOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
} from '@application/use-cases/service-order/service-order.use-cases';
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
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';

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
