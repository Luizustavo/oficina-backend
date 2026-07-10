import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateServiceOrderRequestDto {
  @ApiProperty({ example: 'uuid-do-cliente' })
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'uuid-do-veiculo' })
  @IsString()
  vehicleId!: string;

  @ApiProperty({
    example: 'Carro fazendo barulho ao frear e perda de potência',
  })
  @IsString()
  problemDescription!: string;

  @ApiProperty({
    example: 'Cliente relatou início dos sintomas há 1 semana',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddServiceRequestDto {
  @ApiProperty({ example: 'uuid-do-servico' })
  @IsString()
  serviceId!: string;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  quantity?: number;

  @ApiProperty({
    example: 'Incluir troca de filtro de ar junto',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddPartRequestDto {
  @ApiProperty({ example: 'uuid-da-peca' })
  @IsString()
  partId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity!: number;
}
