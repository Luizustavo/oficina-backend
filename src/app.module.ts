import { ServiceOrdersModule } from './infrastructure/presentation/modules/service-orders.module';
import { CustomersModule } from './infrastructure/presentation/modules/customers.module';
import { VehiclesModule } from './infrastructure/presentation/modules/vehicles.module';
import { ServicesModule } from './infrastructure/presentation/modules/services.module';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { JwtAuthGuard } from './infrastructure/presentation/guards/jwt-auth.guard';
import { PartsModule } from './infrastructure/presentation/modules/parts.module';
import { AuthModule } from './infrastructure/presentation/modules/auth.module';
import { RolesGuard } from './infrastructure/presentation/guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    ServiceOrdersModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    PrismaModule,
    PartsModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
