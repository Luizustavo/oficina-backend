import { Vehicle } from './vehicle.entity';
import { DomainException } from '../../shared/exceptions/domain.exceptions';

const validProps = {
  id: '1',
  customerId: 'customer-1',
  licensePlate: 'ABC1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
  color: 'Preto',
};

describe('Vehicle', () => {
  describe('create', () => {
    it('should create a vehicle with valid props', () => {
      const vehicle = Vehicle.create(validProps);
      expect(vehicle.id).toBe('1');
      expect(vehicle.licensePlate).toBe('ABC1234');
      expect(vehicle.brand).toBe('Toyota');
      expect(vehicle.createdAt).toBeInstanceOf(Date);
    });

    it('should normalize license plate to uppercase', () => {
      const vehicle = Vehicle.create({
        ...validProps,
        licensePlate: 'abc1234',
      });
      expect(vehicle.licensePlate).toBe('ABC1234');
    });

    it('should accept Mercosul plates', () => {
      const vehicle = Vehicle.create({
        ...validProps,
        licensePlate: 'ABC1D23',
      });
      expect(vehicle.licensePlate).toBe('ABC1D23');
    });

    it('should throw DomainException for empty brand', () => {
      expect(() => Vehicle.create({ ...validProps, brand: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for empty model', () => {
      expect(() => Vehicle.create({ ...validProps, model: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for missing customerId', () => {
      expect(() => Vehicle.create({ ...validProps, customerId: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for year before 1900', () => {
      expect(() => Vehicle.create({ ...validProps, year: 1800 })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for year far in the future', () => {
      expect(() => Vehicle.create({ ...validProps, year: 9999 })).toThrow(
        DomainException,
      );
    });
  });

  describe('update', () => {
    it('should update brand, model, year, and color', () => {
      const vehicle = Vehicle.create(validProps);
      vehicle.update({
        brand: 'Honda',
        model: 'Civic',
        year: 2022,
        color: 'Branco',
      });
      expect(vehicle.brand).toBe('Honda');
      expect(vehicle.model).toBe('Civic');
      expect(vehicle.year).toBe(2022);
      expect(vehicle.color).toBe('Branco');
    });

    it('should throw DomainException when updating brand to empty string', () => {
      const vehicle = Vehicle.create(validProps);
      expect(() => vehicle.update({ brand: '' })).toThrow(DomainException);
    });

    it('should throw DomainException when updating model to empty string', () => {
      const vehicle = Vehicle.create(validProps);
      expect(() => vehicle.update({ model: '' })).toThrow(DomainException);
    });

    it('should throw DomainException when updating year to invalid value', () => {
      const vehicle = Vehicle.create(validProps);
      expect(() => vehicle.update({ year: 1800 })).toThrow(DomainException);
    });
  });
});
