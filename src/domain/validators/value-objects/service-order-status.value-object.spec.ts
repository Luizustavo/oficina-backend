import {
  ServiceOrderStatus,
  ServiceOrderStatusVO,
} from './service-order-status.value-object';
import { InvalidStatusTransitionException } from '../../../shared/exceptions/domain.exceptions';

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

    // A aprovação direta da Fase 3 saiu: agora passa pelo pagamento (saga).
    it('should not allow AWAITING_APPROVAL → IN_PROGRESS', () => {
      const status = new ServiceOrderStatusVO(
        ServiceOrderStatus.AWAITING_APPROVAL,
      );
      expect(status.canTransitionTo(ServiceOrderStatus.IN_PROGRESS)).toBe(
        false,
      );
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

  // Fluxo da saga (ADR-011): aprovado → aguardando pagamento → pago → execução.
  describe('saga flow (Fase 4)', () => {
    it.each([
      [
        ServiceOrderStatus.AWAITING_APPROVAL,
        ServiceOrderStatus.AWAITING_PAYMENT,
      ],
      [ServiceOrderStatus.AWAITING_PAYMENT, ServiceOrderStatus.PAID],
      [ServiceOrderStatus.PAID, ServiceOrderStatus.IN_PROGRESS],
      // Compensação: o Billing não conseguiu gerar o orçamento.
      [ServiceOrderStatus.AWAITING_APPROVAL, ServiceOrderStatus.IN_DIAGNOSIS],
      [ServiceOrderStatus.AWAITING_PAYMENT, ServiceOrderStatus.CANCELED],
      [ServiceOrderStatus.PAID, ServiceOrderStatus.CANCELED],
    ])('should allow %s → %s', (from, to) => {
      expect(new ServiceOrderStatusVO(from).canTransitionTo(to)).toBe(true);
    });

    it.each([
      // Não dá para pular o pagamento nem voltar de pago para aguardando.
      [ServiceOrderStatus.AWAITING_PAYMENT, ServiceOrderStatus.IN_PROGRESS],
      [ServiceOrderStatus.PAID, ServiceOrderStatus.AWAITING_PAYMENT],
      [ServiceOrderStatus.IN_DIAGNOSIS, ServiceOrderStatus.AWAITING_PAYMENT],
      [ServiceOrderStatus.AWAITING_PAYMENT, ServiceOrderStatus.IN_DIAGNOSIS],
      [ServiceOrderStatus.PAID, ServiceOrderStatus.COMPLETED],
    ])('should not allow %s → %s', (from, to) => {
      expect(new ServiceOrderStatusVO(from).canTransitionTo(to)).toBe(false);
    });

    // Serviço já executado (COMPLETED) não se cancela: se entrega.
    it('should allow CANCELED from every status before COMPLETED', () => {
      const terminal = [
        ServiceOrderStatus.COMPLETED,
        ServiceOrderStatus.DELIVERED,
        ServiceOrderStatus.CANCELED,
      ];
      for (const status of Object.values(ServiceOrderStatus)) {
        const expected = !terminal.includes(status);
        expect(
          new ServiceOrderStatusVO(status).canTransitionTo(
            ServiceOrderStatus.CANCELED,
          ),
        ).toBe(expected);
      }
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
