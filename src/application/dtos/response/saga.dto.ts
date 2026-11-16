export interface SagaStepLogResponseDto {
  step: string;
  eventType: string;
  messageId?: string;
  outcome: string;
  detail?: string;
  createdAt?: Date;
}

export interface ServiceOrderSagaResponseDto {
  sagaId: string;
  orderId: string;
  status: string;
  step: string;
  deadlineAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  history: SagaStepLogResponseDto[];
}
