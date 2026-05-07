import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsLicensePlate } from '../validators/is-license-plate.validator';

export class CreateVehicleRequestDto {
  @ApiProperty({ example: 'uuid-do-cliente' })
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'ABC-1234' })
  @IsLicensePlate()
  licensePlate!: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  brand!: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  model!: string;

  @ApiProperty({ example: 2022 })
  @IsNumber()
  @Type(() => Number)
  @Min(1900)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 'Prata', required: false })
  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateVehicleRequestDto {
  @ApiProperty({ example: 'Volkswagen', required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ example: 'Gol', required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ example: 2023, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiProperty({ example: 'Branco', required: false })
  @IsString()
  @IsOptional()
  color?: string;
}
