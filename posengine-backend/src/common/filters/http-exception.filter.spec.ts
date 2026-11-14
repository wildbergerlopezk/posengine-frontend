import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

jest.mock('../../generated/prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {}
  class PrismaClientValidationError extends Error {}
  class PrismaClientUnknownRequestError extends Error {}

  return {
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
      PrismaClientUnknownRequestError,
    },
  };
});

import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter } from './http-exception.filter';

function createHost() {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const request = {
    method: 'POST',
    url: '/auth/reset-password?token=query-token-secret',
    body: { password: 'body-password-secret' },
    headers: { authorization: 'Bearer header-token-secret' },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  return { host: host as any, response, request };
}

function prismaError(code: string, message = `database details ${code}`) {
  const error = new Error(message);
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  Object.assign(error, { code });
  return error;
}

describe('AllExceptionsFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a stable validation response with status and field errors', () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = createHost();

    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(response.status).toHaveBeenCalledWith(400);
    const payload = response.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      success: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Revisá los datos ingresados.',
      details: ['email must be an email'],
    });
    expect(payload.requestId).toEqual(expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-ID', payload.requestId);
  });

  it.each([
    [new UnauthorizedException('Invalid credentials'), 401, 'UNAUTHORIZED', 'Autenticación requerida o credenciales inválidas.'],
    [new ForbiddenException('private authorization details'), 403, 'FORBIDDEN', 'No tenés permisos para realizar esta operación.'],
    [new NotFoundException('private resource identifier'), 404, 'NOT_FOUND', 'No se encontró el recurso solicitado.'],
    [new ConflictException('Conflicto de negocio'), 409, 'CONFLICT', 'Conflicto de negocio'],
    [new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS), 429, 'RATE_LIMITED', 'Demasiadas solicitudes. Intentá nuevamente más tarde.'],
    [new ServiceUnavailableException('raw upstream details'), 503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible temporalmente. Intentá nuevamente.'],
  ])('preserves the HTTP status and returns a safe code for %i', (exception, status, code, message) => {
    const filter = new AllExceptionsFilter();
    const { host, response } = createHost();

    filter.catch(exception as Error, host);

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json.mock.calls[0][0]).toMatchObject({ statusCode: status, code, message });
  });

  it.each([
    ['P2002', 409, 'UNIQUE_CONSTRAINT'],
    ['P2025', 404, 'NOT_FOUND'],
    ['P2028', 500, 'INTERNAL_ERROR'],
  ])('maps Prisma %s to HTTP %i without exposing database details', (prismaCode, status, code) => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host, response } = createHost();

    filter.catch(prismaError(prismaCode as string, 'private SQL and connection details'), host);

    const payload = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(status);
    expect(payload).toMatchObject({ statusCode: status, code });
    expect(JSON.stringify(payload)).not.toContain('private SQL');
    if (status === 500) {
      expect(log).toHaveBeenCalled();
      expect(payload.message).toBe('Error interno del servidor. Intentá nuevamente más tarde.');
    }
  });

  it('does not log request secrets or query strings for internal errors', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host, response } = createHost();
    const error = new Error('password=stack-password-secret token=stack-token-secret');

    filter.catch(error, host);

    const logged = JSON.stringify(log.mock.calls);
    expect(response.status).toHaveBeenCalledWith(500);
    for (const secret of [
      'body-password-secret',
      'query-token-secret',
      'header-token-secret',
      'stack-password-secret',
      'stack-token-secret',
    ]) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).not.toContain('?token=');
  });
});
