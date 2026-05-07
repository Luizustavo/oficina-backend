import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomerType } from '../../../domain/customer/customer-type.enum';
import { IsValidDocument } from '../validators/is-valid-document.validator';

export class CreateCustomerRequestDto {
  @ApiProperty({ example: 'Carlos Pereira' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '123.456.789-09' })
  @IsValidDocument()
  document!: string;

  @ApiProperty({ example: 'INDIVIDUAL', enum: CustomerType })
  @IsEnum(CustomerType)
  type!: CustomerType;

  @ApiProperty({ example: 'carlos@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '(11) 99999-0000' })
  @IsString()
  phone!: string;

  @ApiProperty({
    example: 'Rua das Flores, 123 - São Paulo/SP',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdateCustomerRequestDto {
  @ApiProperty({ example: 'Carlos A. Pereira', required: false })
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 'carlos.novo@email.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '(11) 98765-4321', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'Av. Paulista, 1000 - São Paulo/SP',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}
