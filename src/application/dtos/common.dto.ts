import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedRequestDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[] = [];

  @ApiProperty({ example: 100 })
  total: number = 0;
  @ApiProperty({ example: 1 })
  page: number = 0;

  @ApiProperty({ example: 20 })
  limit: number = 0;
  @ApiProperty({ example: 5 })
  totalPages: number = 0;
}
