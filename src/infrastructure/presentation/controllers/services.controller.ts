import {
  Controller,
  Delete,
  Param,
  Query,
  Patch,
  Post,
  Body,
  Get,
} from '@nestjs/common';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
} from '@application/dtos/request/service.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateServiceUseCase } from '@application/use-cases/service/create-service.use-case';
import { UpdateServiceUseCase } from '@application/use-cases/service/update-service.use-case';
import { ToggleServiceUseCase } from '@application/use-cases/service/toggle-service.use-case';
import { DeleteServiceUseCase } from '@application/use-cases/service/delete-service.use-case';
import { ListServicesUseCase } from '@application/use-cases/service/list-services.use-case';
import { GetServiceUseCase } from '@application/use-cases/service/get-service.use-case';
import { UserRole } from '@domain/enums/user-role.enum';
import { Roles } from '@infrastructure/presentation/decorators/roles.decorator';

@ApiTags('services')
@ApiBearerAuth()
@Controller('api/services')
export class ServicesController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly toggleService: ToggleServiceUseCase,
    private readonly deleteService: DeleteServiceUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly getService: GetServiceUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Create a new service' })
  async create(@Body() dto: CreateServiceRequestDto) {
    return this.createService.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active services' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.listServices.execute({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      onlyActive: onlyActive !== 'false',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find service by ID' })
  async findOne(@Param('id') id: string) {
    return this.getService.execute(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Update service' })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceRequestDto) {
    return this.updateService.execute(id, dto);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Toggle service active/inactive' })
  async toggle(@Param('id') id: string) {
    return this.toggleService.execute(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Delete service' })
  async remove(@Param('id') id: string) {
    await this.deleteService.execute(id);
    return { message: 'Service deleted successfully' };
  }
}
