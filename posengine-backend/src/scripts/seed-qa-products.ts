import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../modules/product/product.service';
import { StockMovementService } from '../modules/stock-movement/stock-movement.service';
import { CreateProductDto } from '../modules/product/dto/create-product.dto';
import { StockMovementType, UnitType } from '../generated/prisma/enums';

const DATABASE_ALLOWLIST = 'posengine';
const SKU_PREFIX = 'QA-PROD-';
const SEED_LABEL = 'QA seed PosEngine';

const categories = [
  { name: 'QA Catálogo · Repuestos de motocicleta', subcategories: ['Motor', 'Transmisión', 'Frenos'] },
  { name: 'QA Catálogo · Ferretería', subcategories: ['Herramientas', 'Fijaciones', 'Pintura'] },
  { name: 'QA Catálogo · Despensa', subcategories: ['Almacén', 'Bebidas', 'Limpieza'] },
  { name: 'QA Catálogo · Electricidad', subcategories: ['Iluminación', 'Cables', 'Accesorios'] },
  { name: 'QA Catálogo · Lubricantes', subcategories: ['Motor', 'Mantenimiento'] },
  { name: 'QA Catálogo · Plomería', subcategories: ['Conexiones', 'Grifería'] },
  { name: 'QA Catálogo · Seguridad', subcategories: ['Protección personal', 'Señalización'] },
  { name: 'QA Catálogo · Accesorios', subcategories: ['Motocicleta', 'Uso diario'] },
  { name: 'QA Catálogo · Cocina', subcategories: ['Utensilios', 'Almacenamiento'] },
  { name: 'QA Catálogo · Jardín', subcategories: ['Riego', 'Herramientas'] },
];

const catalogRows: Array<{ category: number; names: string[] }> = [
  { category: 0, names: ['Filtro de aceite para motocicleta', 'Bujía estándar rosca corta', 'Cadena de transmisión 428 reforzada', 'Pastillas de freno delanteras', 'Cable de embrague universal', 'Kit de transmisión para uso urbano', 'Espejo retrovisor rosca derecha', 'Cámara para rueda 18 pulgadas', 'Manija de freno de aluminio', 'Filtro de aire rectangular para motor'] },
  { category: 1, names: ['Martillo de carpintero 16 oz', 'Destornillador punta plana 6 pulgadas', 'Juego de llaves combinadas', 'Tornillo galvanizado cabeza hexagonal', 'Cinta métrica retráctil 5 metros', 'Pintura sintética blanca 900 ml', 'Alicate universal con mango aislado', 'Candado de acero arco largo', 'Disco de corte para metal 4 1/2 pulgadas', 'Nivel de burbuja profesional 60 cm'] },
  { category: 2, names: ['Arroz largo fino paquete 1 kg', 'Aceite vegetal botella 900 ml', 'Yerba mate tradicional paquete 1 kg', 'Galletitas dulces paquete familiar', 'Jabón para ropa en polvo 800 g', 'Agua mineral sin gas botella 1.5 l', 'Café molido paquete 250 g', 'Azúcar blanca paquete 1 kg', 'Detergente concentrado botella 500 ml', 'Leche entera larga vida caja 1 l'] },
  { category: 3, names: ['Lámpara LED luz cálida 9 W', 'Cable unipolar flexible 2.5 mm por metro', 'Tomacorriente doble para embutir', 'Cinta aisladora negra 10 metros', 'Portalámpara rosca E27', 'Interruptor simple blanco', 'Reflector LED exterior 50 W', 'Ficha macho reforzada 10 A', 'Extensión eléctrica de 5 metros', 'Panel LED cuadrado para techo'] },
  { category: 4, names: ['Aceite para motor 20W-50 botella 1 l', 'Grasa multipropósito pote 500 g', 'Lubricante para cadena aerosol 300 ml', 'Refrigerante para radiador botella 1 l', 'Aceite hidráulico bidón 5 l', 'Limpiador de carburador aerosol 400 ml', 'Aceite para motor sintético botella 4 l', 'Líquido de frenos DOT 4 botella 500 ml', 'Desengrasante biodegradable bidón 2 l', 'Aditivo para combustible botella 250 ml'] },
  { category: 5, names: ['Codo PVC 90 grados 20 mm', 'Tubo PVC para agua fría 3 m', 'Cinta selladora para roscas 12 mm', 'Canilla plástica para jardín', 'Llave de paso metálica 1/2 pulgada', 'Unión PVC roscada 25 mm', 'Flexible mallado para lavatorio 40 cm', 'Sifón flexible para pileta', 'Pegamento para PVC pomo 100 ml', 'Grifo monocomando para cocina'] },
  { category: 6, names: ['Guantes de trabajo reforzados talle M', 'Lentes transparentes de protección', 'Casco de seguridad con ajuste', 'Chaleco reflectivo alta visibilidad', 'Protector auditivo tipo copa', 'Máscara descartable para polvo', 'Botín de seguridad con puntera', 'Faja lumbar de soporte ajustable', 'Conos de señalización naranja 50 cm', 'Cinta de peligro amarilla y negra'] },
  { category: 7, names: ['Soporte para teléfono de motocicleta', 'Candado para disco de freno compacto', 'Cubrepuños universales negros', 'Red elástica portaequipaje 40 cm', 'Impermeable liviano para motociclista', 'Luz trasera LED recargable', 'Bolso lateral impermeable mediano', 'Cubre asiento antideslizante', 'Soporte metálico para casco', 'Inflador portátil para neumáticos'] },
  { category: 8, names: ['Espátula de cocina acero inoxidable', 'Recipiente hermético plástico 1.2 l', 'Cuchillo de cocina hoja 20 cm', 'Tabla para picar mediana', 'Colador de acero inoxidable 18 cm', 'Termo para líquidos capacidad 1 l', 'Vaso térmico con tapa 450 ml', 'Rallador manual cuatro caras', 'Sartén antiadherente 24 cm', 'Jarra medidora transparente 1 l'] },
  { category: 9, names: ['Manguera de jardín flexible por metro', 'Regadera plástica capacidad 5 l', 'Tijera de poda con seguro', 'Aspersor circular para jardín', 'Pala de punta con mango', 'Guantes impermeables para jardinería', 'Conector rápido para manguera 1/2 pulgada', 'Pulverizador manual 2 l', 'Rastrillo metálico para hojas', 'Maceta plástica redonda 25 cm'] },
];

function verifyTarget() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL no está configurada. Seed cancelado.');

  const url = new URL(rawUrl);
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const database = url.pathname.replace(/^\//, '').split('/')[0];

  if (!loopbackHosts.has(url.hostname)) throw new Error('El seed solo admite un host loopback. Seed cancelado.');
  if (database !== DATABASE_ALLOWLIST) throw new Error(`Base no permitida (${database}). Seed cancelado.`);
  if (process.env.QA_SEED_ALLOW_LOCAL !== 'YES' || process.env.QA_SEED_ALLOW_DATABASE !== DATABASE_ALLOWLIST) {
    throw new Error('Confirmá el destino configurando QA_SEED_ALLOW_LOCAL=YES y QA_SEED_ALLOW_DATABASE=posengine.');
  }

  return { host: url.hostname, port: url.port || '5432', database };
}

function buildCatalog() {
  return catalogRows.flatMap((group, groupIndex) => group.names.map((baseName, rowIndex) => {
    const index = groupIndex * 10 + rowIndex + 1;
    const code = String(index).padStart(3, '0');
    const costSamples = [8_500, 24_000, 79_500, 165_000, 480_000, 1_250_000, 3_800_000];
    const cost = costSamples[(index * 3) % costSamples.length];
    const retailMargin = [18, 25, 32, 40, 55][index % 5];
    const wholesaleMargin = [4, 7, 10, 12, 15][index % 5];
    const unitType = index % 17 === 0 ? UnitType.KG : index % 23 === 0 ? UnitType.L : UnitType.UNIT;
    const barcode = index <= 20
      ? String(index).padStart(12, '0')
      : `C128-QA-${String(index).padStart(6, '0')}`;
    const category = categories[group.category];
    const subcategoryName = category.subcategories[rowIndex % category.subcategories.length];

    return {
      code,
      name: `${baseName} · ${SKU_PREFIX}${code}`,
      description: `${SEED_LABEL} ${SKU_PREFIX}${code}. Artículo ficticio para pruebas locales.`,
      sku: `${SKU_PREFIX}${code}`,
      barcode,
      categoryName: category.name,
      subcategoryName,
      unitType,
      cost,
      price: Math.round(cost * (1 + retailMargin / 100)),
      wholesalePrice: Math.round(cost * (1 + wholesaleMargin / 100)),
      stock: 250 + (index % 8) * 100,
      stockMinimum: 5,
    };
  }));
}

function subcategoryLabel(categoryName: string, subcategoryName: string) {
  return `${categoryName.replace('QA Catálogo · ', '')}: ${subcategoryName}`;
}

async function resolveTenant(prisma: PrismaService) {
  const candidates = await prisma.user.findMany({
    where: { active: true, tenantId: { not: null } },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });
  const candidateIds = candidates.map(({ tenantId }) => tenantId).filter((id): id is string => Boolean(id));
  const requestedId = process.env.QA_SEED_TENANT_ID;

  if (requestedId && !candidateIds.includes(requestedId)) {
    throw new Error('QA_SEED_TENANT_ID no corresponde a un tenant con usuario activo. Seed cancelado.');
  }
  if (!requestedId && candidateIds.length !== 1) {
    throw new Error('La base tiene varios tenants activos; definí QA_SEED_TENANT_ID explícitamente.');
  }

  const tenantId = requestedId || candidateIds[0];
  if (!tenantId || !await prisma.tenant.findFirst({ where: { id: tenantId, active: true }, select: { id: true } })) {
    throw new Error('No se encontró un tenant activo elegible. Seed cancelado.');
  }
  return tenantId;
}

async function assertMigrationsCurrent(prisma: PrismaService) {
  const migrationPath = join(process.cwd(), 'prisma', 'migrations');
  const localMigrations = readdirSync(migrationPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const appliedRows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
  `;
  const applied = new Set(appliedRows.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
  const missing = localMigrations.filter(name => !applied.has(name));
  if (missing.length) throw new Error(`Faltan migraciones aplicadas (${missing.length}). Seed cancelado.`);
}

async function ensureCategories(prisma: PrismaService, tenantId: string) {
  const ids = new Map<string, string>();
  const subcategoryIds = new Map<string, string>();

  for (const category of categories) {
    let existingCategory = await prisma.category.findFirst({ where: { tenantId, name: category.name } });
    if (!existingCategory) {
      existingCategory = await prisma.category.create({ data: { tenantId, name: category.name } });
    }
    ids.set(category.name, existingCategory.id);

    for (const subcategoryName of category.subcategories) {
      const storedName = subcategoryLabel(category.name, subcategoryName);
      let subcategory = await prisma.subcategory.findFirst({ where: { tenantId, name: storedName } });
      if (subcategory && subcategory.categoryId !== existingCategory.id) {
        throw new Error(`La subcategoría de QA "${subcategoryName}" ya pertenece a otra categoría. Seed cancelado.`);
      }
      if (!subcategory) {
        subcategory = await prisma.subcategory.create({
          data: { tenantId, categoryId: existingCategory.id, name: storedName },
        });
      }
      subcategoryIds.set(`${category.name}::${subcategoryName}`, subcategory.id);
    }
  }
  return { ids, subcategoryIds };
}

async function seed(prisma: PrismaService, tenantId: string) {
  const movementService = new StockMovementService(prisma);
  const productService = new ProductService(prisma, movementService);
  const { ids: categoryIds, subcategoryIds } = await ensureCategories(prisma, tenantId);
  let created = 0;
  let existing = 0;
  let repairedMovement = 0;

  for (const item of buildCatalog()) {
    const categoryId = categoryIds.get(item.categoryName);
    const subcategoryId = subcategoryIds.get(`${item.categoryName}::${item.subcategoryName}`);
    if (!categoryId || !subcategoryId) throw new Error(`Categoría QA incompleta para ${item.sku}.`);

    const product = await prisma.product.findFirst({ where: { tenantId, sku: item.sku } });
    if (product) {
      if (product.name !== item.name || !product.description?.includes(`${SEED_LABEL} ${item.sku}`)) {
        throw new Error(`El SKU ${item.sku} ya existe y no parece pertenecer a este seed. No se sobrescribió.`);
      }
      if (product.stock !== item.stock) throw new Error(`El stock de ${item.sku} cambió después del seed; no se sobrescribió.`);
      if (product.barcode !== item.barcode) throw new Error(`El barcode de ${item.sku} cambió; no se sobrescribió.`);
      const initialMovements = await prisma.stockMovement.findMany({
        where: { tenantId, productId: product.id, type: StockMovementType.INITIAL },
        select: { id: true, notes: true, quantity: true, before: true, after: true },
      });
      if (initialMovements.length === 0) {
        const anyMovement = await prisma.stockMovement.count({ where: { tenantId, productId: product.id } });
        if (anyMovement !== 0) throw new Error(`Hay movimientos previos en ${item.sku}; no se alteró su historial.`);
        const movement = await movementService.registerInitial(tenantId, product.id, item.stock);
        if (!movement) throw new Error(`No se pudo registrar el stock inicial de ${item.sku}.`);
        await prisma.stockMovement.update({ where: { id: movement.id }, data: { notes: `${SEED_LABEL}: ${item.sku}` } });
        repairedMovement++;
      } else if (
        initialMovements.length !== 1
        || !['Stock inicial del producto', `${SEED_LABEL}: ${item.sku}`].includes(initialMovements[0].notes ?? '')
        || initialMovements[0].quantity !== item.stock
        || initialMovements[0].before !== 0
        || initialMovements[0].after !== item.stock
      ) {
        throw new Error(`El movimiento inicial de ${item.sku} no coincide con el seed; no se modificó.`);
      }
      if (initialMovements[0]?.notes === 'Stock inicial del producto') {
        await prisma.stockMovement.update({
          where: { id: initialMovements[0].id },
          data: { notes: `${SEED_LABEL}: ${item.sku}` },
        });
      }
      existing++;
      continue;
    }

    const barcodeConflict = await prisma.product.findFirst({ where: { tenantId, barcode: item.barcode }, select: { id: true } });
    if (barcodeConflict) throw new Error(`El barcode de ${item.sku} ya está usado en este tenant. Seed cancelado.`);

    const dto: CreateProductDto = {
      name: item.name,
      description: item.description,
      categoryId,
      subcategoryId,
      sku: item.sku,
      barcode: item.barcode,
      cost: item.cost,
      price: item.price,
      wholesalePrice: item.wholesalePrice,
      stock: item.stock,
      stockMinimum: item.stockMinimum,
      unitType: item.unitType,
      isActive: true,
    };
    const createdProduct = await productService.create(tenantId, dto);
    if (!createdProduct) throw new Error(`No se pudo recuperar el producto creado ${item.sku}.`);
    const movementUpdated = await prisma.stockMovement.updateMany({
      where: { tenantId, productId: createdProduct.id, type: StockMovementType.INITIAL, notes: 'Stock inicial del producto' },
      data: { notes: `${SEED_LABEL}: ${item.sku}` },
    });
    if (movementUpdated.count !== 1) throw new Error(`No se pudo etiquetar el movimiento inicial de ${item.sku}.`);
    created++;
  }
  console.log(JSON.stringify({ action: 'seed', database: DATABASE_ALLOWLIST, host: 'loopback', tenantProductsCreated: created, productsPreserved: existing, initialMovementsRepaired: repairedMovement }));
}

async function cleanup(prisma: PrismaService, tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId, sku: { startsWith: SKU_PREFIX } },
    select: { id: true, sku: true, description: true },
  });
  const seededProducts = products.filter(product => /^QA-PROD-\d{3}$/.test(product.sku ?? '') && product.description?.startsWith(`${SEED_LABEL} ${product.sku}`));
  const ids = seededProducts.map(product => product.id);
  if (!ids.length) {
    console.log(JSON.stringify({ action: 'cleanup', deletedProducts: 0, database: DATABASE_ALLOWLIST }));
    return;
  }

  const [sales, purchases, returns] = await Promise.all([
    prisma.saleItem.count({ where: { productId: { in: ids } } }),
    prisma.purchaseItem.count({ where: { productId: { in: ids } } }),
    prisma.purchaseReturnItem.count({ where: { productId: { in: ids } } }),
  ]);
  if (sales || purchases || returns) {
    throw new Error(`Cleanup bloqueado: los productos QA ya tienen referencias comerciales (ventas ${sales}, compras ${purchases}, devoluciones ${returns}). No se borró ningún registro.`);
  }

  for (const product of seededProducts) {
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId, productId: product.id },
      select: { id: true, notes: true, type: true },
    });
    if (movements.length !== 1 || movements[0].type !== StockMovementType.INITIAL || movements[0].notes !== `${SEED_LABEL}: ${product.sku}`) {
      throw new Error(`Cleanup bloqueado: ${product.sku} tiene movimientos distintos al inicial del seed. No se borró ningún producto.`);
    }
  }

  await prisma.$transaction(async tx => {
    for (const product of seededProducts) {
      await tx.stockMovement.deleteMany({ where: { tenantId, productId: product.id, notes: `${SEED_LABEL}: ${product.sku}` } });
      await tx.product.delete({ where: { id: product.id } });
    }

    for (const category of categories) {
      const categoryRow = await tx.category.findFirst({ where: { tenantId, name: category.name } });
      for (const subcategoryName of category.subcategories) {
        const subcategory = await tx.subcategory.findFirst({ where: { tenantId, name: subcategoryLabel(category.name, subcategoryName) } });
        if (categoryRow && subcategory?.categoryId === categoryRow.id) {
          const productsRemaining = await tx.product.count({ where: { tenantId, subcategoryId: subcategory.id } });
          if (productsRemaining === 0) await tx.subcategory.delete({ where: { id: subcategory.id } });
        }
      }
      if (categoryRow) {
        const [productsRemaining, subcategoriesRemaining] = await Promise.all([
          tx.product.count({ where: { tenantId, categoryId: categoryRow.id } }),
          tx.subcategory.count({ where: { tenantId, categoryId: categoryRow.id } }),
        ]);
        if (productsRemaining === 0 && subcategoriesRemaining === 0) await tx.category.delete({ where: { id: categoryRow.id } });
      }
    }
  });
  console.log(JSON.stringify({ action: 'cleanup', deletedProducts: seededProducts.length, database: DATABASE_ALLOWLIST }));
}

async function main() {
  const target = verifyTarget();
  const prisma = new PrismaService();
  try {
    const identity = await prisma.$queryRaw<Array<{ db: string; address: string | null; recovery: boolean }>>`
      SELECT current_database() AS db, inet_server_addr()::text AS address, pg_is_in_recovery() AS recovery
    `;
    const address = identity[0]?.address?.split('/')[0];
    if (identity[0]?.db !== target.database || !address || !['127.0.0.1', '::1'].includes(address) || identity[0].recovery) {
      throw new Error('El servidor PostgreSQL no confirmó una instancia local primaria y aislable. Seed cancelado.');
    }
    await assertMigrationsCurrent(prisma);
    const tenantId = await resolveTenant(prisma);
    if (process.argv.includes('--cleanup')) await cleanup(prisma, tenantId);
    else await seed(prisma, tenantId);
    console.log(`Destino verificado: ${target.host}:${target.port}/${target.database}`);
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Falló el seed QA.');
  process.exitCode = 1;
});
