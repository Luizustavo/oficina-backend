import { LicensePlate } from './license-plate.value-object';
import { InvalidLicensePlateException } from '../../shared/exceptions/domain.exceptions';

describe('LicensePlate', () => {
  describe('isValid', () => {
    it('should return true for a valid old-format plate (ABC1234)', () => {
      expect(LicensePlate.isValid('ABC1234')).toBe(true);
    });

    it('should return true for a valid old-format plate with hyphen (ABC-1234)', () => {
      expect(LicensePlate.isValid('ABC-1234')).toBe(true);
    });

    it('should return true for a valid Mercosul plate (ABC1D23)', () => {
      expect(LicensePlate.isValid('ABC1D23')).toBe(true);
    });

    it('should return true for lowercase plates (normalized)', () => {
      expect(LicensePlate.isValid('abc1234')).toBe(true);
      expect(LicensePlate.isValid('abc1d23')).toBe(true);
    });

    it('should return false for plates with wrong format', () => {
      expect(LicensePlate.isValid('ABC123')).toBe(false);
      expect(LicensePlate.isValid('1234ABC')).toBe(false);
      expect(LicensePlate.isValid('AB12345')).toBe(false);
      expect(LicensePlate.isValid('')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should create a plate from a valid old-format string', () => {
      const plate = new LicensePlate('ABC1234');
      expect(plate.getValue()).toBe('ABC1234');
    });

    it('should normalize lowercase to uppercase', () => {
      const plate = new LicensePlate('abc1234');
      expect(plate.getValue()).toBe('ABC1234');
    });

    it('should strip hyphens', () => {
      const plate = new LicensePlate('ABC-1234');
      expect(plate.getValue()).toBe('ABC1234');
    });

    it('should create a Mercosul plate', () => {
      const plate = new LicensePlate('ABC1D23');
      expect(plate.getValue()).toBe('ABC1D23');
    });

    it('should throw InvalidLicensePlateException for an invalid plate', () => {
      expect(() => new LicensePlate('INVALID')).toThrow(
        InvalidLicensePlateException,
      );
      expect(() => new LicensePlate('123ABC')).toThrow(
        InvalidLicensePlateException,
      );
    });
  });

  describe('isMercosul', () => {
    it('should return true for a Mercosul plate', () => {
      const plate = new LicensePlate('ABC1D23');
      expect(plate.isMercosul()).toBe(true);
    });

    it('should return false for an old-format plate', () => {
      const plate = new LicensePlate('ABC1234');
      expect(plate.isMercosul()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal plates', () => {
      const a = new LicensePlate('ABC1234');
      const b = new LicensePlate('abc-1234');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different plates', () => {
      const a = new LicensePlate('ABC1234');
      const b = new LicensePlate('XYZ9876');
      expect(a.equals(b)).toBe(false);
    });
  });
});
