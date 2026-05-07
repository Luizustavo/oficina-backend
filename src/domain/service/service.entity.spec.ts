import { Service } from './service.entity';
import { DomainException } from '../../shared/exceptions/domain.exceptions';

const validProps = {
  id: '1',
  name: 'Troca de Óleo',
  price: 80.0,
  estimatedDurationMinutes: 30,
};

describe('Service', () => {
  describe('create', () => {
    it('should create a service with valid props', () => {
      const service = Service.create(validProps);
      expect(service.id).toBe('1');
      expect(service.name).toBe('Troca de Óleo');
      expect(service.isActive).toBe(true);
      expect(service.createdAt).toBeInstanceOf(Date);
    });

    it('should throw DomainException for empty name', () => {
      expect(() => Service.create({ ...validProps, name: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for non-positive price', () => {
      expect(() => Service.create({ ...validProps, price: 0 })).toThrow(
        DomainException,
      );
      expect(() => Service.create({ ...validProps, price: -10 })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for non-positive estimated duration', () => {
      expect(() =>
        Service.create({ ...validProps, estimatedDurationMinutes: 0 }),
      ).toThrow(DomainException);
      expect(() =>
        Service.create({ ...validProps, estimatedDurationMinutes: -5 }),
      ).toThrow(DomainException);
    });
  });

  describe('update', () => {
    it('should update name, price, and duration', () => {
      const service = Service.create(validProps);
      service.update({
        name: 'Alinhamento',
        price: 120.0,
        estimatedDurationMinutes: 60,
      });
      expect(service.name).toBe('Alinhamento');
      expect(service.price).toBe(120.0);
      expect(service.estimatedDurationMinutes).toBe(60);
    });

    it('should throw DomainException when updating name to empty string', () => {
      const service = Service.create(validProps);
      expect(() => service.update({ name: '' })).toThrow(DomainException);
    });

    it('should throw DomainException when updating price to zero', () => {
      const service = Service.create(validProps);
      expect(() => service.update({ price: 0 })).toThrow(DomainException);
    });

    it('should throw DomainException when updating duration to zero', () => {
      const service = Service.create(validProps);
      expect(() => service.update({ estimatedDurationMinutes: 0 })).toThrow(
        DomainException,
      );
    });
  });

  describe('toggleActive', () => {
    it('should deactivate an active service', () => {
      const service = Service.create(validProps);
      expect(service.isActive).toBe(true);
      service.toggleActive();
      expect(service.isActive).toBe(false);
    });

    it('should re-activate an inactive service', () => {
      const service = Service.create(validProps);
      service.toggleActive();
      service.toggleActive();
      expect(service.isActive).toBe(true);
    });
  });
});
