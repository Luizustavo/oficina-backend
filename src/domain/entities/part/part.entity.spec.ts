import { DomainException } from '@shared/exceptions/domain.exceptions';
import { PartEntity } from './part.entity';

const validProps = {
  id: '1',
  name: 'Filtro de Óleo',
  code: 'FO-001',
  price: 25.9,
  stockQuantity: 10,
  minStockQuantity: 3,
};

describe('Part', () => {
  describe('create', () => {
    it('should create a part with valid props', () => {
      const part = PartEntity.create(validProps);
      expect(part.id).toBe('1');
      expect(part.name).toBe('Filtro de Óleo');
      expect(part.isActive).toBe(true);
      expect(part.createdAt).toBeInstanceOf(Date);
    });

    it('should throw DomainException for empty name', () => {
      expect(() => PartEntity.create({ ...validProps, name: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for empty code', () => {
      expect(() => PartEntity.create({ ...validProps, code: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for non-positive price', () => {
      expect(() => PartEntity.create({ ...validProps, price: 0 })).toThrow(
        DomainException,
      );
      expect(() => PartEntity.create({ ...validProps, price: -5 })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for negative stock', () => {
      expect(() =>
        PartEntity.create({ ...validProps, stockQuantity: -1 }),
      ).toThrow(DomainException);
    });
  });

  describe('isLowStock', () => {
    it('should return true when stock is at or below minimum', () => {
      const part = PartEntity.create({
        ...validProps,
        stockQuantity: 3,
        minStockQuantity: 3,
      });
      expect(part.isLowStock).toBe(true);
    });

    it('should return true when stock is below minimum', () => {
      const part = PartEntity.create({
        ...validProps,
        stockQuantity: 1,
        minStockQuantity: 3,
      });
      expect(part.isLowStock).toBe(true);
    });

    it('should return false when stock is above minimum', () => {
      const part = PartEntity.create({
        ...validProps,
        stockQuantity: 10,
        minStockQuantity: 3,
      });
      expect(part.isLowStock).toBe(false);
    });
  });

  describe('hasEnoughStock', () => {
    it('should return true when stock >= requested quantity', () => {
      const part = PartEntity.create(validProps);
      expect(part.hasEnoughStock(10)).toBe(true);
      expect(part.hasEnoughStock(5)).toBe(true);
    });

    it('should return false when stock < requested quantity', () => {
      const part = PartEntity.create(validProps);
      expect(part.hasEnoughStock(11)).toBe(false);
    });
  });

  describe('addStock', () => {
    it('should increment the stock quantity', () => {
      const part = PartEntity.create(validProps);
      part.addStock(5);
      expect(part.stockQuantity).toBe(15);
    });

    it('should throw DomainException when adding zero or negative quantity', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.addStock(0)).toThrow(DomainException);
      expect(() => part.addStock(-1)).toThrow(DomainException);
    });
  });

  describe('removeStock', () => {
    it('should decrement the stock quantity', () => {
      const part = PartEntity.create(validProps);
      part.removeStock(3);
      expect(part.stockQuantity).toBe(7);
    });

    it('should throw DomainException when removing more than available', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.removeStock(11)).toThrow(DomainException);
    });

    it('should throw DomainException when removing zero or negative quantity', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.removeStock(0)).toThrow(DomainException);
      expect(() => part.removeStock(-1)).toThrow(DomainException);
    });
  });

  describe('decrementStock', () => {
    it('should decrement the stock quantity', () => {
      const part = PartEntity.create(validProps);
      part.decrementStock(4);
      expect(part.stockQuantity).toBe(6);
    });

    it('should throw DomainException when decrementing below zero', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.decrementStock(11)).toThrow(DomainException);
    });

    it('should throw DomainException for zero or negative quantity', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.decrementStock(0)).toThrow(DomainException);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a part with all props', () => {
      const now = new Date();
      const part = PartEntity.reconstitute({
        name: 'Filtro',
        code: 'F-001',
        description: 'Filtro de ar',
        price: 30,
        stockQuantity: 5,
        minStockQuantity: 2,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      expect(part.id).toBe('p-1');
      expect(part.description).toBe('Filtro de ar');
      expect(part.isActive).toBe(false);
    });
  });

  describe('update', () => {
    it('should update name, price, description, and minStockQuantity', () => {
      const part = PartEntity.create(validProps);
      part.update({
        name: 'Filtro Novo',
        price: 40,
        description: 'Desc',
        minStockQuantity: 5,
      });
      expect(part.name).toBe('Filtro Novo');
      expect(part.price).toBe(40);
    });

    it('should throw DomainException for empty name', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.update({ name: '' })).toThrow(DomainException);
    });

    it('should throw DomainException for non-positive price', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.update({ price: -1 })).toThrow(DomainException);
    });

    it('should throw DomainException for negative minStockQuantity', () => {
      const part = PartEntity.create(validProps);
      expect(() => part.update({ minStockQuantity: -1 })).toThrow(
        DomainException,
      );
    });
  });

  describe('toggleActive', () => {
    it('should toggle isActive state', () => {
      const part = PartEntity.create(validProps);
      expect(part.isActive).toBe(true);
      part.toggleActive();
      expect(part.isActive).toBe(false);
      part.toggleActive();
      expect(part.isActive).toBe(true);
    });
  });

  describe('validate', () => {
    it('should throw for negative minStockQuantity on create', () => {
      expect(() =>
        PartEntity.create({ ...validProps, minStockQuantity: -1 }),
      ).toThrow(DomainException);
    });
  });
});
