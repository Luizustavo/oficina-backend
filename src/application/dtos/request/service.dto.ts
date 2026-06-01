import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateServiceRequestDto {
  @ApiProperty({ example: 'Troca de óleo' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'Troca de óleo do motor com filtro',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  price!: number;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  estimatedDurationMinutes!: number;
}

export class UpdateServiceRequestDto {
  @ApiProperty({ example: 'Troca de óleo completa', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Troca de óleo com filtro de ar e vela',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 180.0, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0.01)
  price?: number;

  @ApiProperty({ example: 90, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  estimatedDurationMinutes?: number;
}
