import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL_ERROR'
    let message: any = 'Error interno del servidor'
    let details: any = undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const payload: any = exception.getResponse()
      if (typeof payload === 'string') {
        message = payload
      } else {
        message = payload.message || exception.message
        details = payload.details ?? payload.error
      }
      code = this.httpStatusToCode(status)
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST
      switch (exception.code) {
        case 'P2002':
          message = 'Ya existe un registro con este valor único'
          code = 'UNIQUE_CONSTRAINT'
          details = exception.meta?.target
          break
        case 'P2025':
          message = 'Registro no encontrado'
          code = 'NOT_FOUND'
          break
        case 'P2003':
          message = 'Violación de clave foránea (referencia a registro inexistente)'
          code = 'FOREIGN_KEY'
          break
        case 'P2014':
          message = 'No se puede eliminar: el registro está relacionado con otros datos'
          code = 'RELATION_INTEGRITY'
          details = exception.meta?.relation_name
          break
        default:
          message = 'Error en la base de datos'
          code = `PRISMA_${exception.code}`
      }
    }

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      status = HttpStatus.BAD_REQUEST
      message = 'Consulta a la base de datos inválida'
      code = 'PRISMA_VALIDATION'
    }

    if (Array.isArray(message) && status === HttpStatus.BAD_REQUEST) {
      details = message
      message = 'Validación fallida'
      code = 'VALIDATION_ERROR'
    }

    console.error(
      `[${new Date().toISOString()}] ERROR ${code}:`,
      message,
      details ?? (exception?.stack ? exception.stack : String(exception)),
    )

    res.status(status).json({
      success: false,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    })
  }

  private httpStatusToCode(s: number): string {
    const entry = Object.entries(HttpStatus).find(([, v]) => v === s)
    return entry ? entry[0] : 'UNKNOWN'
  }
}
