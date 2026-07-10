import { PrismaVehicleMapper } from '@infrastructure/database/prisma/mappers/prisma-vehicle.mapper';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VehicleRepository implements IVehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(vehicle: VehicleEntity): Promise<VehicleEntity> {
    const data = PrismaVehicleMapper.toPrisma(vehicle);
    const created = await this.prisma.vehicle.create({ data });
    return PrismaVehicleMapper.toEntity(created);
  }

  async findById(id: string): Promise<VehicleEntity | null> {
    const data = await this.prisma.vehicle.findUnique({ where: { id } });
    return data ? PrismaVehicleMapper.toEntity(data) : null;
  }

  async findByLicensePlate(plate: string): Promise<VehicleEntity | null> {
    const data = await this.prisma.vehicle.findUnique({
      where: { licensePlate: plate },
    });
    return data ? PrismaVehicleMapper.toEntity(data) : null;
  }

  async findByCustomerId(customerId: string): Promise<VehicleEntity[]> {
    const records = await this.prisma.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((item) => PrismaVehicleMapper.toEntity(item));
  }

  async findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: VehicleEntity[]; total: number }> {
    const [records, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count(),
    ]);
    return {
      data: records.map((item) => PrismaVehicleMapper.toEntity(item)),
      total,
    };
  }

  async update(vehicle: VehicleEntity): Promise<VehicleEntity> {
    const data = PrismaVehicleMapper.toPrisma(vehicle);
    const updated = await this.prisma.vehicle.update({
      where: { id: data.id },
      data,
    });
    return PrismaVehicleMapper.toEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async hasServiceOrders(id: string): Promise<boolean> {
    const count = await this.prisma.serviceOrder.count({
      where: { vehicleId: id },
    });
    return count > 0;
  }
}
