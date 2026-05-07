import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  DomainException,
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  InvalidStatusTransitionException,
  InsufficientStockException,
} from '../../../shared/exceptions/domain.exceptions';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message: string }).message ??
            exception.message);
    } else if (exception instanceof NotFoundException) {
      statusCode = HttpStatus.NOT_FOUND;
      message = exception.message;
    } else if (exception instanceof ConflictException) {
      statusCode = HttpStatus.CONFLICT;
      message = exception.message;
    } else if (
      exception instanceof InvalidStatusTransitionException ||
      exception instanceof BusinessRuleException ||
      exception instanceof InsufficientStockException
    ) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      message = exception.message;
    } else if (exception instanceof DomainException) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
