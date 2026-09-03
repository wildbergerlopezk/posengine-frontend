import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { Response } from 'express'
import { MailService } from '../mail/mail.service'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly mailService?: MailService) {}

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

    // Enviar alerta de correo si es un error 500 y MailService está disponible
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && this.mailService) {
      try {
        const request = ctx.getRequest<any>()
        const url = request.url
        const method = request.method
        const body = request.body ? JSON.stringify(sanitizeObject(request.body), null, 2) : 'No body'
        const headers = request.headers ? JSON.stringify(sanitizeObject(request.headers), null, 2) : 'No headers'
        const tenantId = request.user?.tenantId || 'No tenant'
        const userEmail = request.user?.email || 'Invitado'
        const stack = exception?.stack ? exception.stack : String(exception)

        const html = `
          <h3>🚨 Error 500 Interno en el Servidor</h3>
          <p><strong>Ruta:</strong> ${method} ${url}</p>
          <p><strong>Usuario:</strong> ${userEmail} (Tenant: ${tenantId})</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <h4>Mensaje del error:</h4>
          <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; font-family: monospace;">${message}</pre>
          <h4>Stack Trace:</h4>
          <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow: auto; max-height: 400px; font-family: monospace;">${stack}</pre>
          <h4>Request Headers:</h4>
          <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; font-family: monospace;">${headers}</pre>
          <h4>Request Body:</h4>
          <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd; font-family: monospace;">${body}</pre>
        `

        this.mailService.sendErrorAlert(`Error 500 en ${method} ${url}`, html)
          .catch(err => console.error('Error al enviar alerta por correo:', err))
      } catch (err) {
        console.error('Error en el filtro al procesar alerta por correo:', err)
      }
    }

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

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }

  const sanitized: any = {}
  const sensitiveKeys = ['password', 'authorization', 'cookie', 'token', 'refreshtoken', 'accesstoken', 'jwt', 'secret']

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[FILTRADO]'
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key])
    } else {
      sanitized[key] = obj[key]
    }
  }

  return sanitized
}
