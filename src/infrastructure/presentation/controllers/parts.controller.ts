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
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../../domain/user/user-role.enum';
import {
  CreatePartUseCase,
  GetPartUseCase,
  ListPartsUseCase,
  ListLowStockPartsUseCase,
  UpdatePartUseCase,
  AddStockUseCase,
  RemoveStockUseCase,
  DeletePartUseCase,
} from '../../../application/use-cases/part/part.use-cases';
import {
  CreatePartRequestDto,
  UpdatePartRequestDto,
  StockOperationDto,
} from '../../../application/dtos/request/part.dto';

@ApiTags('parts')
@ApiBearerAuth()
@Controller('api/parts')
export class PartsController {
  constructor(
    private readonly createPart: CreatePartUseCase,
    private readonly getPart: GetPartUseCase,
    private readonly listParts: ListPartsUseCase,
    private readonly listLowStock: ListLowStockPartsUseCase,
    private readonly updatePart: UpdatePartUseCase,
    private readonly addStock: AddStockUseCase,
    private readonly removeStock: RemoveStockUseCase,
    private readonly deletePart: DeletePartUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Create a new part' })
  async create(@Body() dto: CreatePartRequestDto) {
    return this.createPart.execute(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'List parts' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.listParts.execute({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      onlyActive: onlyActive !== 'false',
    });
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'List parts with low stock' })
  async getLowStock() {
    return this.listLowStock.execute();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Find part by ID' })
  async findOne(@Param('id') id: string) {
    return this.getPart.execute(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Update part' })
  async update(@Param('id') id: string, @Body() dto: UpdatePartRequestDto) {
    return this.updatePart.execute(id, dto);
  }

  @Patch(':id/stock/add')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Add stock to part' })
  async add(@Param('id') id: string, @Body() dto: StockOperationDto) {
    return this.addStock.execute(id, dto.quantity);
  }

  @Patch(':id/stock/remove')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Manually remove stock from part' })
  async remove(@Param('id') id: string, @Body() dto: StockOperationDto) {
    return this.removeStock.execute(id, dto.quantity);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Delete part' })
  async deletePartHandler(@Param('id') id: string) {
    await this.deletePart.execute(id);
    return { message: 'Part deleted successfully' };
  }
}
