import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor. Intentá nuevamente más tarde.';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = INTERNAL_ERROR_MESSAGE;
    let details: string[] | undefined;
    let internalCode = 'UNEXPECTED_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      internalCode = `HTTP_${status}`;
      const payload = exception.getResponse();
      const payloadMessage = typeof payload === 'string'
        ? payload
        : 'message' in payload
          ? payload.message
          : undefined;

      if (status === HttpStatus.BAD_REQUEST && Array.isArray(payloadMessage)) {
        code = 'VALIDATION_ERROR';
        message = 'Revisá los datos ingresados.';
        details = payloadMessage.filter((item): item is string => typeof item === 'string');
      } else if (status === HttpStatus.UNAUTHORIZED) {
        code = 'UNAUTHORIZED';
        message = 'Autenticación requerida o credenciales inválidas.';
      } else if (status === HttpStatus.FORBIDDEN) {
        code = 'FORBIDDEN';
        message = 'No tenés permisos para realizar esta operación.';
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 'NOT_FOUND';
        message = 'No se encontró el recurso solicitado.';
      } else if (status === HttpStatus.CONFLICT) {
        code = 'CONFLICT';
        message = typeof payloadMessage === 'string' ? payloadMessage : 'La operación entra en conflicto con datos existentes.';
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = 'RATE_LIMITED';
        message = 'Demasiadas solicitudes. Intentá nuevamente más tarde.';
      } else if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        code = 'SERVICE_UNAVAILABLE';
        message = 'El servicio no está disponible temporalmente. Intentá nuevamente.';
      } else if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        code = 'INTERNAL_ERROR';
        message = INTERNAL_ERROR_MESSAGE;
      } else {
        code = this.httpStatusToCode(status);
        message = typeof payloadMessage === 'string' ? payloadMessage : exception.message;
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      internalCode = `PRISMA_${exception.code}`;
      details = undefined;

      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          code = 'UNIQUE_CONSTRAINT';
          message = 'Ya existe un registro con este valor.';
          break;
        case 'P2003':
        case 'P2014':
          status = HttpStatus.CONFLICT;
          code = 'DATA_CONFLICT';
          message = 'La operación entra en conflicto con datos existentes.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'No se encontró el recurso solicitado.';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'INTERNAL_ERROR';
          message = INTERNAL_ERROR_MESSAGE;
      }
    }

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      internalCode = 'PRISMA_CLIENT_ERROR';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = INTERNAL_ERROR_MESSAGE;
      details = undefined;
    }

    response.setHeader('X-Request-ID', requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const exceptionName = exception instanceof Error ? exception.name : 'UnknownError';
      const stack = exception instanceof Error ? redactSensitiveText(exception.stack ?? '') : '';
      console.error('API internal error', {
        requestId,
        status,
        method: request.method,
        path: request.path || request.url?.split('?')[0],
        code: internalCode,
        exception: exceptionName,
        stack,
      });
    }

    return response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private httpStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return `HTTP_${status}`;
    }
  }
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [FILTRADO]')
    .replace(/((?:password|token|secret|authorization|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1[FILTRADO]');
}
