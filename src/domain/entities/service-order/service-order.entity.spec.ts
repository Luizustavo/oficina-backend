import { InvalidStatusTransitionException } from '@shared/exceptions/domain.exceptions';
import { ServiceOrderEntity } from './service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { DomainException } from '@shared/exceptions/domain.exceptions';

const validProps = {
  id: 'so-1',
  orderNumber: 'OS-001',
  customerId: 'customer-1',
  vehicleId: 'vehicle-1',
  problemDescription: 'Motor fazendo barulho',
};

describe('ServiceOrder', () => {
  describe('create', () => {
    it('should create a service order with RECEIVED status', () => {
      const so = ServiceOrderEntity.create(validProps);
      expect(so.id).toBe('so-1');
      expect(so.status).toBe(ServiceOrderStatus.RECEIVED);
      expect(so.services).toHaveLength(0);
      expect(so.parts).toHaveLength(0);
      expect(so.totalAmount).toBe(0);
    });

    it('should throw DomainException for empty problem description', () => {
      expect(() =>
        ServiceOrderEntity.create({ ...validProps, problemDescription: '' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for missing customerId', () => {
      expect(() =>
        ServiceOrderEntity.create({ ...validProps, customerId: '' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for missing vehicleId', () => {
      expect(() =>
        ServiceOrderEntity.create({ ...validProps, vehicleId: '' }),
      ).toThrow(DomainException);
    });
  });

  describe('status transitions', () => {
    it('should transition RECEIVED → IN_DIAGNOSIS', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      expect(so.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
    });

    it('should transition IN_DIAGNOSIS → AWAITING_APPROVAL', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      expect(so.status).toBe(ServiceOrderStatus.AWAITING_APPROVAL);
    });

    it('should transition AWAITING_APPROVAL → IN_PROGRESS and record timestamps', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      expect(so.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(so.approvedAt).toBeInstanceOf(Date);
      expect(so.startedAt).toBeInstanceOf(Date);
    });

    it('should transition IN_PROGRESS → COMPLETED and record finishedAt', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      so.complete();
      expect(so.status).toBe(ServiceOrderStatus.COMPLETED);
      expect(so.finishedAt).toBeInstanceOf(Date);
    });

    it('should transition COMPLETED → DELIVERED and record deliveredAt', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      so.complete();
      so.deliver();
      expect(so.status).toBe(ServiceOrderStatus.DELIVERED);
      expect(so.deliveredAt).toBeInstanceOf(Date);
    });

    it('should allow canceling from RECEIVED', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.cancel();
      expect(so.status).toBe(ServiceOrderStatus.CANCELED);
    });

    it('should throw when attempting an invalid transition', () => {
      const so = ServiceOrderEntity.create(validProps);
      expect(() => so.complete()).toThrow(InvalidStatusTransitionException);
    });

    it('should throw when trying to transition from DELIVERED', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      so.complete();
      so.deliver();
      expect(() => so.cancel()).toThrow(InvalidStatusTransitionException);
    });
  });

  describe('addService', () => {
    it('should add a service and recalculate total', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.addService({
        serviceId: 's-1',
        serviceName: 'Troca de Óleo',
        price: 80,
        quantity: 1,
      });
      expect(so.services).toHaveLength(1);
      expect(so.totalAmount).toBe(80);
    });

    it('should throw DomainException when adding service to a non-modifiable order', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      expect(() =>
        so.addService({
          serviceId: 's-1',
          serviceName: 'Troca de Óleo',
          price: 80,
          quantity: 1,
        }),
      ).toThrow(DomainException);
    });
  });

  describe('addPart', () => {
    it('should add a part and recalculate total', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.addPart({
        partId: 'p-1',
        partName: 'Filtro',
        partCode: 'F-001',
        unitPrice: 25,
        quantity: 2,
        totalPrice: 50,
      });
      expect(so.parts).toHaveLength(1);
      expect(so.totalAmount).toBe(50);
    });

    it('should throw DomainException when adding part to a non-modifiable order', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      expect(() =>
        so.addPart({
          partId: 'p-1',
          partName: 'Filtro',
          partCode: 'F-001',
          unitPrice: 25,
          quantity: 2,
          totalPrice: 50,
        }),
      ).toThrow(DomainException);
    });
  });

  describe('canModifyItems', () => {
    it('should return true for RECEIVED, IN_DIAGNOSIS, and AWAITING_APPROVAL', () => {
      const received = ServiceOrderEntity.create(validProps);
      expect(received.canModifyItems()).toBe(true);

      const inDiagnosis = ServiceOrderEntity.create({
        ...validProps,
        orderNumber: 'OS-002',
      });
      inDiagnosis.startDiagnosis();
      expect(inDiagnosis.canModifyItems()).toBe(true);
    });

    it('should return false for IN_PROGRESS', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approve();
      expect(so.canModifyItems()).toBe(false);
    });
  });
});
