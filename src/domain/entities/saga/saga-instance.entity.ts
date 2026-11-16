import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';
import { DomainException } from '@shared/exceptions/domain.exceptions';

export interface SagaInstanceProps {
  orderId: string;
  step: SagaStep;
  status: SagaStatus;
  /** Prazo do passo atual (aprovação, pagamento); vencido, a saga compensa. */
  deadlineAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Uma tentativa de levar a OS do orçamento à entrega (ADR-011). O `id` da
 * saga vai como `sagaId` em todas as mensagens dela. Uma OS pode ter mais de
 * uma saga (nova tentativa depois de o orçamento falhar); a atual é a mais
 * recente.
 */
export class SagaInstanceEntity {
  private readonly props: SagaInstanceProps;
  private _id: string = '';

  private constructor(props: SagaInstanceProps, id?: string) {
    this.props = props;
    if (id) this._id = id;
  }

  /** Saga recém-iniciada: o comando de orçamento acabou de ser enviado. */
  static start(orderId: string, id?: string): SagaInstanceEntity {
    if (!orderId) {
      throw new DomainException('Order ID is required to start a saga');
    }
    const now = new Date();
    return new SagaInstanceEntity(
      {
        orderId,
        step: SagaStep.BUDGET_CREATION,
        status: SagaStatus.RUNNING,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(
    props: SagaInstanceProps,
    id?: string,
  ): SagaInstanceEntity {
    return new SagaInstanceEntity(props, id);
  }

  /**
   * Avança a saga. `deadlineAt: null` limpa o prazo; `undefined` mantém.
   */
  moveTo(params: {
    step: SagaStep;
    status: SagaStatus;
    deadlineAt?: Date | null;
    error?: string;
  }): void {
    this.props.step = params.step;
    this.props.status = params.status;
    if (params.deadlineAt === null) {
      this.props.deadlineAt = undefined;
    } else if (params.deadlineAt !== undefined) {
      this.props.deadlineAt = params.deadlineAt;
    }
    if (params.error !== undefined) {
      this.props.lastError = params.error;
    }
    this.props.updatedAt = new Date();
  }

  /** Ainda pode receber eventos que mudam alguma coisa. */
  get isActive(): boolean {
    return (
      this.props.status === SagaStatus.RUNNING ||
      this.props.status === SagaStatus.COMPENSATING
    );
  }

  get id(): string {
    return this._id;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get step(): SagaStep {
    return this.props.step;
  }
  get status(): SagaStatus {
    return this.props.status;
  }
  get deadlineAt(): Date | undefined {
    return this.props.deadlineAt;
  }
  get lastError(): string | undefined {
    return this.props.lastError;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
