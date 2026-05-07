import { Cnpj } from './cnpj.value-object';
import { InvalidCnpjException } from '../../shared/exceptions/domain.exceptions';

describe('Cnpj', () => {
  describe('isValid', () => {
    it('should return true for a valid CNPJ (unformatted)', () => {
      expect(Cnpj.isValid('11222333000181')).toBe(true);
    });

    it('should return true for a valid CNPJ (formatted)', () => {
      expect(Cnpj.isValid('11.222.333/0001-81')).toBe(true);
    });

    it('should return false for a CNPJ with all identical digits', () => {
      expect(Cnpj.isValid('00000000000000')).toBe(false);
      expect(Cnpj.isValid('11111111111111')).toBe(false);
    });

    it('should return false for a CNPJ with wrong length', () => {
      expect(Cnpj.isValid('1122233300018')).toBe(false);
      expect(Cnpj.isValid('112223330001810')).toBe(false);
    });

    it('should return false for a CNPJ with invalid check digits', () => {
      expect(Cnpj.isValid('11222333000182')).toBe(false);
      expect(Cnpj.isValid('12345678000190')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should create a CNPJ from a valid unformatted string', () => {
      const cnpj = new Cnpj('11222333000181');
      expect(cnpj.getValue()).toBe('11222333000181');
    });

    it('should strip formatting when creating a CNPJ', () => {
      const cnpj = new Cnpj('11.222.333/0001-81');
      expect(cnpj.getValue()).toBe('11222333000181');
    });

    it('should throw InvalidCnpjException for an invalid CNPJ', () => {
      expect(() => new Cnpj('00000000000000')).toThrow(InvalidCnpjException);
      expect(() => new Cnpj('12345678000190')).toThrow(InvalidCnpjException);
    });
  });

  describe('equals', () => {
    it('should return true for equal CNPJs', () => {
      const a = new Cnpj('11222333000181');
      const b = new Cnpj('11.222.333/0001-81');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different CNPJs', () => {
      const a = new Cnpj('11222333000181');
      const b = new Cnpj('45990590000185');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the cleaned CNPJ value', () => {
      const cnpj = new Cnpj('11.222.333/0001-81');
      expect(cnpj.toString()).toBe('11222333000181');
    });
  });
});
