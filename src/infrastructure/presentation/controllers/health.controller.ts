import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { Public } from '@infrastructure/presentation/decorators/public.decorator';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe — process is up' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe — database connection is healthy' })
  async ready() {
    await this.prisma.$executeRawUnsafe('SELECT 1');
    return { status: 'ok' };
  }
}
