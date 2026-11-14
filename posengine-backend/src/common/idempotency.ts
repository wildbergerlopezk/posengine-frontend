import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common'
import { randomUUID, createHash } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'

export interface IdempotencyClaim {
  id: string
  created: boolean
  resourceType: string | null
  resourceIds: string[]
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

export function hashIdempotencyRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload)) ?? 'null').digest('hex')
}

export async function findIdempotencyReplay(
  client: Prisma.TransactionClient | PrismaService,
  tenantId: string,
  operation: string,
  key: string | undefined,
  payload: unknown,
): Promise<IdempotencyClaim | undefined> {
  if (key === undefined) return undefined
  if (!/^[\x21-\x7e]{1,128}$/.test(key)) {
    throw new BadRequestException('Idempotency-Key debe contener entre 1 y 128 caracteres ASCII visibles.')
  }
  const existing = await client.idempotencyRecord.findUnique({
    where: { tenantId_operation_key: { tenantId, operation, key } },
  })
  if (!existing) return undefined
  if (existing.requestHash !== hashIdempotencyRequest(payload)) {
    throw new ConflictException('La clave de idempotencia ya se utilizó con contenido diferente.')
  }
  if (!existing.resourceType || existing.resourceIds.length === 0) {
    throw new ConflictException('La operación asociada a esta clave todavía no está disponible; reintentá la misma solicitud.')
  }
  return {
    id: existing.id,
    created: false,
    resourceType: existing.resourceType,
    resourceIds: existing.resourceIds,
  }
}

export async function claimIdempotency(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operation: string,
  key: string | undefined,
  payload: unknown,
): Promise<IdempotencyClaim | undefined> {
  if (key === undefined) return undefined
  const requestHash = hashIdempotencyRequest(payload)
  const now = new Date()
  const inserted = await tx.idempotencyRecord.createMany({
    data: [{
      id: randomUUID(),
      tenantId,
      operation,
      key,
      requestHash,
      createdAt: now,
      updatedAt: now,
    }],
    skipDuplicates: true,
  })

  if (inserted.count === 1) {
    const record = await tx.idempotencyRecord.findUnique({
      where: { tenantId_operation_key: { tenantId, operation, key } },
      select: { id: true },
    })
    if (!record) throw new InternalServerErrorException('No se pudo reservar la clave de idempotencia.')
    return { id: record.id, created: true, resourceType: null, resourceIds: [] }
  }

  const existing = await tx.idempotencyRecord.findUnique({
    where: { tenantId_operation_key: { tenantId, operation, key } },
  })
  if (!existing) throw new ConflictException('La clave está siendo procesada; reintentá la misma operación.')
  return findIdempotencyReplay(tx, tenantId, operation, key, payload)
}

export async function completeIdempotency(
  tx: Prisma.TransactionClient,
  tenantId: string,
  claim: IdempotencyClaim | undefined,
  resourceType: string,
  resourceIds: string[],
): Promise<void> {
  if (!claim) return
  if (!claim.created) throw new InternalServerErrorException('No se puede completar una clave reclamada por otra transacción.')
  const updated = await tx.idempotencyRecord.updateMany({
    where: { id: claim.id, tenantId, resourceType: null },
    data: { resourceType, resourceIds },
  })
  if (updated.count !== 1) throw new InternalServerErrorException('No se pudo completar la clave de idempotencia.')
}

export function requireIdempotencyResource<T>(
  claim: IdempotencyClaim,
  expectedType: string,
): string {
  if (claim.created || claim.resourceType !== expectedType || claim.resourceIds.length !== 1) {
    throw new InternalServerErrorException('La clave de idempotencia apunta a un resultado incompatible.')
  }
  return claim.resourceIds[0]
}
