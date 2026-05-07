import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IVehicleRepository } from '../../../domain/vehicle/vehicle.repository.interface';
import { Vehicle } from '../../../domain/vehicle/vehicle.entity';

@Injectable()
export class VehicleRepository implements IVehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(vehicle: Vehicle): Promise<Vehicle> {
    const data = await this.prisma.vehicle.create({
      data: {
        id: vehicle.id,
        customerId: vehicle.customerId,
        licensePlate: vehicle.licensePlate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<Vehicle | null> {
    const data = await this.prisma.vehicle.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findByLicensePlate(plate: string): Promise<Vehicle | null> {
    const data = await this.prisma.vehicle.findUnique({
      where: { licensePlate: plate },
    });
    return data ? this.toDomain(data) : null;
  }

  async findByCustomerId(customerId: string): Promise<Vehicle[]> {
    const records = await this.prisma.vehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Vehicle[]; total: number }> {
    const [records, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count(),
    ]);
    return { data: records.map((r: any) => this.toDomain(r)), total };
  }

  async update(vehicle: Vehicle): Promise<Vehicle> {
    const data = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        updatedAt: vehicle.updatedAt,
      },
    });
    return this.toDomain(data);
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

  private toDomain(data: {
    id: string;
    customerId: string;
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    color: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Vehicle {
    return Vehicle.reconstitute({
      id: data.id,
      customerId: data.customerId,
      licensePlate: data.licensePlate,
      brand: data.brand,
      model: data.model,
      year: data.year,
      color: data.color ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
