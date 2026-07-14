import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { Injectable, Logger } from '@nestjs/common';
import { emailConfig } from '@infrastructure/config/email.config';
import { Resend } from 'resend';

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  [ServiceOrderStatus.RECEIVED]: 'Recebida',
  [ServiceOrderStatus.IN_DIAGNOSIS]: 'Em Diagnóstico',
  [ServiceOrderStatus.AWAITING_APPROVAL]: 'Aguardando Aprovação',
  [ServiceOrderStatus.IN_PROGRESS]: 'Em Execução',
  [ServiceOrderStatus.COMPLETED]: 'Finalizada',
  [ServiceOrderStatus.DELIVERED]: 'Entregue',
  [ServiceOrderStatus.CANCELED]: 'Cancelada',
};

@Injectable()
export class ResendEmailNotificationService implements IEmailNotificationService {
  private readonly logger = new Logger(ResendEmailNotificationService.name);
  private readonly config = emailConfig().email;
  private readonly resend = this.config.apiKey
    ? new Resend(this.config.apiKey)
    : null;

  async sendServiceOrderStatusUpdate(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    status: ServiceOrderStatus;
  }): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log(
        `Email notifications disabled — skipped status email for order ${params.orderNumber}`,
      );
      return;
    }

    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY is not configured — skipped status email for order ${params.orderNumber}`,
      );
      return;
    }

    const statusLabel = STATUS_LABELS[params.status];

    try {
      await this.resend.emails.send({
        from: this.config.from,
        to: params.to,
        subject: `Ordem de Serviço ${params.orderNumber} — ${statusLabel}`,
        html: `<p>Olá, ${params.customerName}!</p><p>A sua ordem de serviço <strong>${params.orderNumber}</strong> teve o status atualizado para <strong>${statusLabel}</strong>.</p>`,
      });
      this.logger.log(
        `Status update email sent to ${params.to} for order ${params.orderNumber} (${statusLabel})`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send status update email for order ${params.orderNumber}: ${(error as Error).message}`,
      );
    }
  }
}
