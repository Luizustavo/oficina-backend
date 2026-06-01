import { registerDecorator, ValidationOptions } from 'class-validator';
import { LicensePlate } from './value-objects/license-plate.value-object';

export function IsLicensePlate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLicensePlate',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options: {
        message:
          'licensePlate must be a valid Brazilian plate (ABC1234 or ABC1D23)',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return LicensePlate.isValid(value);
        },
      },
    });
  };
}
