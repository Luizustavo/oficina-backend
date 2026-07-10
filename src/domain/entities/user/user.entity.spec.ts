import { DomainException } from '@shared/exceptions/domain.exceptions';
import { UserEntity } from './user.entity';
import { UserRole } from '@domain/enums/user-role.enum';

const validProps = {
  name: 'Administrator',
  email: 'admin@oficina.com',
  password: 'hashed-password',
  role: UserRole.ADMIN,
};

describe('User', () => {
  describe('create', () => {
    it('should create an active user with valid props', () => {
      const user = UserEntity.create(validProps, 'user-1');
      expect(user.id).toBe('user-1');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should throw DomainException for empty name', () => {
      expect(() => UserEntity.create({ ...validProps, name: '' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException for invalid email', () => {
      expect(() =>
        UserEntity.create({ ...validProps, email: 'not-an-email' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for empty password', () => {
      expect(() => UserEntity.create({ ...validProps, password: '' })).toThrow(
        DomainException,
      );
    });

    it('should accept all valid roles', () => {
      for (const role of Object.values(UserRole)) {
        const user = UserEntity.create({ ...validProps, role });
        expect(user.role).toBe(role);
      }
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', () => {
      const user = UserEntity.create(validProps);
      user.deactivate();
      expect(user.isActive).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persisted props without validation', () => {
      const now = new Date();
      const user = UserEntity.reconstitute(
        {
          ...validProps,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        'user-1',
      );
      expect(user.email).toBe('admin@oficina.com');
      expect(user.role).toBe(UserRole.ADMIN);
    });
  });
});
