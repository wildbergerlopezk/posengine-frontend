import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class ProductService {
    constructor(private readonly prisma: PrismaService) { }

    async create(tenantId: string, dto: CreateProductDto) {
        const category = await this.prisma.category.findFirst({
            where: { id: dto.categoryId, tenantId },
        });

        if (!category) {
            throw new NotFoundException(
                `Categoría con id "${dto.categoryId}" no encontrada`,
            );
        }

        if (dto.subcategoryId) {
            const subcategory = await this.prisma.subcategory.findFirst({
                where: {
                    id: dto.subcategoryId,
                    categoryId: dto.categoryId,
                    tenantId,
                },
            });

            if (!subcategory) {
                throw new BadRequestException(
                    `La subcategoría "${dto.subcategoryId}" no existe o no pertenece a la categoría seleccionada`,
                );
            }
        }

        const existing = await this.prisma.product.findUnique({
            where: { name_tenantId: { name: dto.name, tenantId } },
        });

        if (existing) {
            throw new ConflictException(
                `Ya existe un producto con el nombre "${dto.name}"`,
            );
        }

        return this.prisma.product.create({
            data: {
                name: dto.name,
                price: dto.price,
                categoryId: dto.categoryId,
                subcategoryId: dto.subcategoryId,
                tenantId,
            },
            include: {
                category: true,
                subcategory: true,
            },
        });
    }

    async findAll(tenantId: string, query: PaginationQueryDto) {
        const { limit, skip } = query;

        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                where: { tenantId },
                include: {
                    category: true,
                    subcategory: true,
                },
                orderBy: { name: 'asc' },
                take: limit,
                skip: skip,
            }),
            this.prisma.product.count({ where: { tenantId } }),
        ]);

        return {
            items,
            total,
            page: query.page,
            limit: query.limit,
        };
    }

    async findOne(id: string, tenantId: string) {
        const product = await this.prisma.product.findFirst({
            where: { id, tenantId },
            include: {
                category: true,
                subcategory: true,
            },
        });

        if (!product) {
            throw new NotFoundException(`Producto con id "${id}" no encontrado`);
        }

        return product;
    }

    async update(id: string, tenantId: string, dto: UpdateProductDto) {
        const product = await this.findOne(id, tenantId);

        if (dto.name) {
            const conflict = await this.prisma.product.findFirst({
                where: {
                    name: dto.name,
                    tenantId,
                    NOT: { id },
                },
            });

            if (conflict) {
                throw new ConflictException(
                    `Ya existe un producto con el nombre "${dto.name}"`,
                );
            }
        }

        const categoryId = dto.categoryId || product.categoryId;
        const subcategoryId = dto.subcategoryId !== undefined ? dto.subcategoryId : product.subcategoryId;

        if (dto.categoryId) {
            const category = await this.prisma.category.findFirst({
                where: { id: dto.categoryId, tenantId },
            });
            if (!category) {
                throw new NotFoundException(`Categoría con id "${dto.categoryId}" no encontrada`);
            }
        }

        if (subcategoryId) {
            const subcategory = await this.prisma.subcategory.findFirst({
                where: {
                    id: subcategoryId,
                    categoryId: categoryId,
                    tenantId,
                },
            });

            if (!subcategory) {
                throw new BadRequestException(
                    `La subcategoría no existe o no pertenece a la categoría seleccionada`,
                );
            }
        }

        return this.prisma.product.update({
            where: { id },
            data: dto,
            include: {
                category: true,
                subcategory: true,
            },
        });
    }

    async remove(id: string, tenantId: string) {
        await this.findOne(id, tenantId);
        await this.prisma.product.delete({ where: { id } });
        return { message: 'Producto eliminado correctamente' };
    }
}
