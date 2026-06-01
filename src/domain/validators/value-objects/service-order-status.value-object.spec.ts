import {
  ServiceOrderStatus,
  ServiceOrderStatusVO,
} from './service-order-status.value-object';
import { InvalidStatusTransitionException } from '../../shared/exceptions/domain.exceptions';

describe('ServiceOrderStatusVO', () => {
  describe('canTransitionTo', () => {
    it('should allow RECEIVED → IN_DIAGNOSIS', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      expect(status.canTransitionTo(ServiceOrderStatus.IN_DIAGNOSIS)).toBe(
        true,
      );
    });

    it('should allow RECEIVED → CANCELED', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      expect(status.canTransitionTo(ServiceOrderStatus.CANCELED)).toBe(true);
    });

    it('should allow IN_DIAGNOSIS → AWAITING_APPROVAL', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.IN_DIAGNOSIS);
      expect(status.canTransitionTo(ServiceOrderStatus.AWAITING_APPROVAL)).toBe(
        true,
      );
    });

    it('should allow AWAITING_APPROVAL → IN_PROGRESS', () => {
      const status = new ServiceOrderStatusVO(
        ServiceOrderStatus.AWAITING_APPROVAL,
      );
      expect(status.canTransitionTo(ServiceOrderStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow IN_PROGRESS → COMPLETED', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.IN_PROGRESS);
      expect(status.canTransitionTo(ServiceOrderStatus.COMPLETED)).toBe(true);
    });

    it('should allow COMPLETED → DELIVERED', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.COMPLETED);
      expect(status.canTransitionTo(ServiceOrderStatus.DELIVERED)).toBe(true);
    });

    it('should not allow RECEIVED → COMPLETED', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      expect(status.canTransitionTo(ServiceOrderStatus.COMPLETED)).toBe(false);
    });

    it('should not allow DELIVERED → any status', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.DELIVERED);
      expect(status.canTransitionTo(ServiceOrderStatus.CANCELED)).toBe(false);
      expect(status.canTransitionTo(ServiceOrderStatus.IN_PROGRESS)).toBe(
        false,
      );
    });

    it('should not allow CANCELED → any status', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.CANCELED);
      expect(status.canTransitionTo(ServiceOrderStatus.RECEIVED)).toBe(false);
      expect(status.canTransitionTo(ServiceOrderStatus.IN_DIAGNOSIS)).toBe(
        false,
      );
    });
  });

  describe('transitionTo', () => {
    it('should return a new ServiceOrderStatusVO with the new status', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      const newStatus = status.transitionTo(ServiceOrderStatus.IN_DIAGNOSIS);
      expect(newStatus.getValue()).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
    });

    it('should not mutate the original status', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      status.transitionTo(ServiceOrderStatus.IN_DIAGNOSIS);
      expect(status.getValue()).toBe(ServiceOrderStatus.RECEIVED);
    });

    it('should throw InvalidStatusTransitionException for invalid transitions', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      expect(() => status.transitionTo(ServiceOrderStatus.COMPLETED)).toThrow(
        InvalidStatusTransitionException,
      );
    });

    it('should throw for transition from terminal DELIVERED status', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.DELIVERED);
      expect(() => status.transitionTo(ServiceOrderStatus.CANCELED)).toThrow(
        InvalidStatusTransitionException,
      );
    });
  });

  describe('getValue', () => {
    it('should return the underlying enum value', () => {
      const status = new ServiceOrderStatusVO(ServiceOrderStatus.IN_PROGRESS);
      expect(status.getValue()).toBe('IN_PROGRESS');
    });
  });

  describe('equals', () => {
    it('should return true for equal statuses', () => {
      const a = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      const b = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different statuses', () => {
      const a = new ServiceOrderStatusVO(ServiceOrderStatus.RECEIVED);
      const b = new ServiceOrderStatusVO(ServiceOrderStatus.CANCELED);
      expect(a.equals(b)).toBe(false);
    });
  });
});
