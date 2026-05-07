import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateVehicleUseCase,
  GetVehicleUseCase,
  ListVehiclesUseCase,
  ListVehiclesByCustomerUseCase,
  UpdateVehicleUseCase,
  DeleteVehicleUseCase,
} from '../../../application/use-cases/vehicle/vehicle.use-cases';
import {
  CreateVehicleRequestDto,
  UpdateVehicleRequestDto,
} from '../../../application/dtos/request/vehicle.dto';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly createVehicle: CreateVehicleUseCase,
    private readonly getVehicle: GetVehicleUseCase,
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly listByCustomer: ListVehiclesByCustomerUseCase,
    private readonly updateVehicle: UpdateVehicleUseCase,
    private readonly deleteVehicle: DeleteVehicleUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vehicle' })
  async create(@Body() dto: CreateVehicleRequestDto) {
    return this.createVehicle.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List vehicles (paginated)' })
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.listVehicles.execute({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'List vehicles by customer' })
  async listByCustomerHandler(@Param('customerId') customerId: string) {
    return this.listByCustomer.execute(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find vehicle by ID' })
  async findOne(@Param('id') id: string) {
    return this.getVehicle.execute(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle' })
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleRequestDto) {
    return this.updateVehicle.execute(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vehicle' })
  async remove(@Param('id') id: string) {
    await this.deleteVehicle.execute(id);
    return { message: 'Vehicle deleted successfully' };
  }
}
