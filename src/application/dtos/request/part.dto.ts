import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePartRequestDto {
  @ApiProperty({ example: 'Filtro de óleo' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'FO-001' })
  @IsString()
  code!: string;

  @ApiProperty({
    example: 'Filtro de óleo para motores 1.0 e 1.4',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 35.9 })
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  price!: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stockQuantity!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minStockQuantity!: number;
}

export class UpdatePartRequestDto {
  @ApiProperty({ example: 'Filtro de óleo premium', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Filtro premium para motores 1.0, 1.4 e 1.6',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 45.9, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  price?: number;

  @ApiProperty({ example: 15, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minStockQuantity?: number;
}

export class StockOperationDto {
  @ApiProperty({ example: 20 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity!: number;
}
