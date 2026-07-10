import { PaginatedResponseDto } from '@application/dtos/common.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ResolvedPagination {
  page: number;
  limit: number;
  skip: number;
}

export class PaginationMapper {
  private constructor() {
    throw new Error(
      'PaginationMapper is a static class and cannot be instantiated',
    );
  }

  public static resolveParams(params: PaginationParams): ResolvedPagination {
    const page = params.page ?? DEFAULT_PAGE;
    const limit = params.limit ?? DEFAULT_LIMIT;
    return { page, limit, skip: (page - 1) * limit };
  }

  public static toResponse<TEntity, TResponse>(
    data: TEntity[],
    total: number,
    page: number,
    limit: number,
    toResponse: (entity: TEntity) => TResponse,
  ): PaginatedResponseDto<TResponse> {
    return {
      data: data.map(toResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
