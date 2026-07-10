import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class DeleteVehicleUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`Deleting vehicle with ID: ${id}`);

    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) {
      this.logger.warn(`Vehicle not found for deletion with ID: ${id}`);
      throw new NotFoundException('Vehicle', id);
    }

    const hasOrders = await this.vehicleRepository.hasServiceOrders(id);
    if (hasOrders) {
      this.logger.warn(
        `Attempt to delete vehicle with associated service orders: ${id}`,
      );
      throw new NotFoundException(
        'Cannot delete vehicle with associated service orders',
        id,
      );
    }

    await this.vehicleRepository.delete(id);
    this.logger.log(`Vehicle deleted successfully with ID: ${id}`);
  }
}
