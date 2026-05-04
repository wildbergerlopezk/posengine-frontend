// src/customers/services/customer.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateCustomerDto } from '../customer/dto/create-customer.dto'
import { UpdateCustomerDto } from '../customer/dto/update-customer.dto'
import { CustomerFilterDto } from '../customer/dto/customer-filter.dto'

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) { }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateCustomerDto) {
    await this.checkDuplicates(tenantId, dto)

    return this.prisma.customer.create({
      data: { ...dto, tenantId },
    })
  }

  // ── FindAll ─────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: CustomerFilterDto) {
    const { search, documentType, creditEnabled, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { tenantId, isActive: true }

    if (search) {
      where.OR = [
        { name:           { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { phone:          { contains: search, mode: 'insensitive' } },
        { email:          { contains: search, mode: 'insensitive' } },
        { address:        { contains: search, mode: 'insensitive' } },
      ]
    }

    if (documentType !== undefined) where.documentType = documentType
    if (creditEnabled !== undefined) where.creditEnabled = creditEnabled

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── FindOne ─────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    })
    if (!customer) throw new NotFoundException(`Cliente con id "${id}" no encontrado`)
    return customer
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateCustomerDto) {
    await this.findOne(id, tenantId)
    await this.checkDuplicates(tenantId, dto, id)

    return this.prisma.customer.update({
      where: { id },
      data: dto,
    })
  }

  private async checkDuplicates(tenantId: string, dto: Partial<CreateCustomerDto>, excludeId?: string) {
    const { documentNumber, email, phone } = dto

    if (documentNumber) {
      const conflict = await this.prisma.customer.findFirst({
        where: {
          documentNumber,
          tenantId,
          ...(excludeId && { NOT: { id: excludeId } })
        },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe un cliente con el documento "${documentNumber}"`)
      }
    }

    if (email) {
      const conflict = await this.prisma.customer.findFirst({
        where: {
          email,
          tenantId,
          ...(excludeId && { NOT: { id: excludeId } })
        },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe un cliente con el correo "${email}"`)
      }
    }

    if (phone) {
      const conflict = await this.prisma.customer.findFirst({
        where: {
          phone,
          tenantId,
          ...(excludeId && { NOT: { id: excludeId } })
        },
      })
      if (conflict) {
        throw new ConflictException(`Ya existe un cliente con el teléfono "${phone}"`)
      }
    }
  }

  // ── Soft delete ─────────────────────────────────────────────────────────────
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId)
    // Soft delete: marcar como inactivo para no romper historial de ventas
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    })
  }
}