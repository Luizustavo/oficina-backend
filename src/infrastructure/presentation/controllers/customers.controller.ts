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
import { CreateCustomerUseCase } from '../../../application/use-cases/customer/create-customer.use-case';
import {
  ListCustomersUseCase,
  GetCustomerUseCase,
  GetCustomerByDocumentUseCase,
} from '../../../application/use-cases/customer/list-customers.use-case';
import {
  UpdateCustomerUseCase,
  DeleteCustomerUseCase,
} from '../../../application/use-cases/customer/update-customer.use-case';
import {
  CreateCustomerRequestDto,
  UpdateCustomerRequestDto,
} from '../../../application/dtos/request/customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('api/customers')
export class CustomersController {
  constructor(
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly listCustomers: ListCustomersUseCase,
    private readonly getCustomer: GetCustomerUseCase,
    private readonly getByDocument: GetCustomerByDocumentUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly deleteCustomer: DeleteCustomerUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  async create(@Body() dto: CreateCustomerRequestDto) {
    return this.createCustomer.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List customers (paginated)' })
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.listCustomers.execute({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('document/:doc')
  @ApiOperation({ summary: 'Find customer by CPF/CNPJ' })
  async findByDocument(@Param('doc') doc: string) {
    return this.getByDocument.execute(doc);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find customer by ID' })
  async findOne(@Param('id') id: string) {
    return this.getCustomer.execute(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerRequestDto) {
    return this.updateCustomer.execute(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer' })
  async remove(@Param('id') id: string) {
    await this.deleteCustomer.execute(id);
    return { message: 'Customer deleted successfully' };
  }
}
