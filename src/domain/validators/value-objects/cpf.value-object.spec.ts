import { Cpf } from './cpf.value-object';
import { InvalidCpfException } from '../../shared/exceptions/domain.exceptions';

describe('Cpf', () => {
  describe('isValid', () => {
    it('should return true for a valid CPF (unformatted)', () => {
      expect(Cpf.isValid('52998224725')).toBe(true);
    });

    it('should return true for a valid CPF (formatted)', () => {
      expect(Cpf.isValid('529.982.247-25')).toBe(true);
    });

    it('should return false for a CPF with all identical digits', () => {
      expect(Cpf.isValid('11111111111')).toBe(false);
      expect(Cpf.isValid('00000000000')).toBe(false);
    });

    it('should return false for a CPF with wrong length', () => {
      expect(Cpf.isValid('1234567890')).toBe(false);
      expect(Cpf.isValid('123456789012')).toBe(false);
    });

    it('should return false for a CPF with invalid check digits', () => {
      expect(Cpf.isValid('52998224724')).toBe(false);
      expect(Cpf.isValid('12345678901')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should create a CPF from a valid unformatted string', () => {
      const cpf = new Cpf('52998224725');
      expect(cpf.getValue()).toBe('52998224725');
    });

    it('should strip formatting when creating a CPF', () => {
      const cpf = new Cpf('529.982.247-25');
      expect(cpf.getValue()).toBe('52998224725');
    });

    it('should throw InvalidCpfException for an invalid CPF', () => {
      expect(() => new Cpf('00000000000')).toThrow(InvalidCpfException);
      expect(() => new Cpf('12345678901')).toThrow(InvalidCpfException);
    });
  });

  describe('equals', () => {
    it('should return true for equal CPFs', () => {
      const a = new Cpf('52998224725');
      const b = new Cpf('529.982.247-25');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different CPFs', () => {
      const a = new Cpf('52998224725');
      const b = new Cpf('11144477735');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the cleaned CPF value', () => {
      const cpf = new Cpf('529.982.247-25');
      expect(cpf.toString()).toBe('52998224725');
    });
  });
});
