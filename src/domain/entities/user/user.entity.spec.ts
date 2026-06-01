import { User } from './user.entity';
import { UserRole } from '../../enums/user-role.enum';
import { DomainException } from '../../../shared/exceptions/domain.exceptions';

const validProps = {
  id: 'user-1',
  name: 'Administrator',
  email: 'admin@oficina.com',
  password: 'hashed-password',
  role: UserRole.ADMIN,
};

describe('User', () => {
  describe('create', () => {
    it('should create an active user with valid props', () => {
      const user = User.create(validProps);
      expect(user.id).toBe('user-1');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should throw DomainException for empty name', () => {
      expect(() => User.create({ ...validProps, name: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for invalid email', () => {
      expect(() =>
        User.create({ ...validProps, email: 'not-an-email' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for empty password', () => {
      expect(() => User.create({ ...validProps, password: '' })).toThrow(
        DomainException,
      );
    });

    it('should accept all valid roles', () => {
      for (const role of Object.values(UserRole)) {
        const user = User.create({ ...validProps, role });
        expect(user.role).toBe(role);
      }
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', () => {
      const user = User.create(validProps);
      user.deactivate();
      expect(user.isActive).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persisted props without validation', () => {
      const now = new Date();
      const user = User.reconstitute({
        ...validProps,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      expect(user.email).toBe('admin@oficina.com');
      expect(user.role).toBe(UserRole.ADMIN);
    });
  });
});
