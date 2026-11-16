import { InvalidStatusTransitionException } from '@shared/exceptions/domain.exceptions';
import { ServiceOrderEntity } from './service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { DomainException } from '@shared/exceptions/domain.exceptions';

const validProps = {
  orderNumber: 'OS-001',
  customerId: 'customer-1',
  vehicleId: 'vehicle-1',
  customerName: 'Maria Silva',
  customerEmail: 'maria@exemplo.com',
  vehiclePlate: 'ABC1D23',
  problemDescription: 'Motor fazendo barulho',
};

describe('ServiceOrder', () => {
  describe('create', () => {
    it('should create a service order with RECEIVED status', () => {
      const so = ServiceOrderEntity.create(validProps);
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

    it('should keep the customer and vehicle data given at creation', () => {
      const so = ServiceOrderEntity.create(validProps);
      expect(so.customerName).toBe('Maria Silva');
      expect(so.customerEmail).toBe('maria@exemplo.com');
      expect(so.vehiclePlate).toBe('ABC1D23');
    });

    it.each([
      ['customerName', ' '],
      ['customerEmail', ''],
      ['vehiclePlate', ''],
    ])('should throw DomainException for empty %s', (field, value) => {
      expect(() =>
        ServiceOrderEntity.create({ ...validProps, [field]: value }),
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

    it('should go through payment to IN_PROGRESS and record timestamps', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
      expect(so.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(so.approvedAt).toBeInstanceOf(Date);
      expect(so.startedAt).toBeInstanceOf(Date);
    });

    it('should transition IN_PROGRESS → COMPLETED and record finishedAt', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
      so.complete();
      expect(so.status).toBe(ServiceOrderStatus.COMPLETED);
      expect(so.finishedAt).toBeInstanceOf(Date);
    });

    it('should transition COMPLETED → DELIVERED and record deliveredAt', () => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
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
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
      so.complete();
      so.deliver();
      expect(() => so.cancel()).toThrow(InvalidStatusTransitionException);
    });
  });

  it('should no longer approve directly from AWAITING_APPROVAL to IN_PROGRESS', () => {
    const so = ServiceOrderEntity.create(validProps);
    so.startDiagnosis();
    so.requestApproval();
    expect(() => so.startExecution()).toThrow(InvalidStatusTransitionException);
  });

  describe('saga transitions (Fase 4)', () => {
    const awaitingApproval = (): ServiceOrderEntity => {
      const so = ServiceOrderEntity.create(validProps);
      so.startDiagnosis();
      so.requestApproval();
      return so;
    };

    it('should go AWAITING_APPROVAL → AWAITING_PAYMENT → PAID → IN_PROGRESS', () => {
      const so = awaitingApproval();

      so.approveBudget();
      expect(so.status).toBe(ServiceOrderStatus.AWAITING_PAYMENT);
      expect(so.approvedAt).toBeInstanceOf(Date);
      expect(so.startedAt).toBeUndefined();

      so.confirmPayment();
      expect(so.status).toBe(ServiceOrderStatus.PAID);

      so.startExecution();
      expect(so.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(so.startedAt).toBeInstanceOf(Date);

      so.complete();
      expect(so.status).toBe(ServiceOrderStatus.COMPLETED);
    });

    it('should revert AWAITING_APPROVAL → IN_DIAGNOSIS as compensation', () => {
      const so = awaitingApproval();
      so.revertToDiagnosis();
      expect(so.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
    });

    it('should not start execution before the payment', () => {
      const so = awaitingApproval();
      so.approveBudget();
      expect(() => so.startExecution()).toThrow(
        InvalidStatusTransitionException,
      );
    });

    it('should not confirm payment of a budget that was not approved', () => {
      const so = awaitingApproval();
      expect(() => so.confirmPayment()).toThrow(
        InvalidStatusTransitionException,
      );
    });

    it('should not revert to diagnosis after the budget was approved', () => {
      const so = awaitingApproval();
      so.approveBudget();
      expect(() => so.revertToDiagnosis()).toThrow(
        InvalidStatusTransitionException,
      );
    });

    it('should allow canceling while awaiting payment and after payment', () => {
      const unpaid = awaitingApproval();
      unpaid.approveBudget();
      unpaid.cancel();
      expect(unpaid.status).toBe(ServiceOrderStatus.CANCELED);

      const paid = awaitingApproval();
      paid.approveBudget();
      paid.confirmPayment();
      paid.cancel();
      expect(paid.status).toBe(ServiceOrderStatus.CANCELED);
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
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
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
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
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
      so.approveBudget();
      so.confirmPayment();
      so.startExecution();
      expect(so.canModifyItems()).toBe(false);
    });
  });
});
