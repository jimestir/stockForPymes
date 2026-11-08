import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(import.meta.dirname, '../../../.env') });

const prisma = new PrismaClient();

const CATEGORIES = ['Analgésicos', 'Antibióticos', 'Digestivo', 'Dermatología'];

const PRODUCTS = [
  {
    name: 'Paracetamol 500 mg',
    description: 'Analgésico y antipirético',
    category: 'Analgésicos'
  },
  {
    name: 'Ibuprofeno 400 mg',
    description: 'Antiinflamatorio no esteroideo',
    category: 'Analgésicos'
  },
  {
    name: 'Amoxicilina 500 mg',
    description: 'Antibiótico de amplio espectro',
    category: 'Antibióticos'
  },
  {
    name: 'Azitromicina 500 mg',
    description: 'Antibiótico macrólido',
    category: 'Antibióticos'
  },
  {
    name: 'Omeprazol 20 mg',
    description: 'Inhibidor de la bomba de protones',
    category: 'Digestivo'
  },
  {
    name: 'Salbutamol 100 mcg',
    description: 'Broncodilatador en aerosol',
    category: 'Digestivo'
  },
  {
    name: 'Hidrocortisona crema 1%',
    description: 'Corticoide tópico',
    category: 'Dermatología'
  },
  {
    name: 'Protector solar SPF 50',
    description: 'Fotoprotector de amplio espectro',
    category: 'Dermatología'
  }
];

const PHARMACIES = [
  {
    name: 'Farmacia Central',
    address: 'Calle Mayor 1',
    cp: '28001',
    lat: 40.4168,
    lng: -3.7038,
    phone: '910000001'
  },
  {
    name: 'Farmacia del Barrio',
    address: 'Avenida del Puerto 22',
    cp: '28002',
    lat: 40.425,
    lng: -3.69,
    phone: '910000002'
  }
];

// Demo stock/price per pharmacy. Re-running the seed resets these values.
const INVENTORY = [
  {
    pharmacy: 'Farmacia Central',
    product: 'Paracetamol 500 mg',
    stock: 40,
    price: 4.95
  },
  {
    pharmacy: 'Farmacia Central',
    product: 'Ibuprofeno 400 mg',
    stock: 25,
    price: 6.5
  },
  {
    pharmacy: 'Farmacia Central',
    product: 'Amoxicilina 500 mg',
    stock: 12,
    price: 9.9
  },
  {
    pharmacy: 'Farmacia Central',
    product: 'Omeprazol 20 mg',
    stock: 30,
    price: 7.25
  },
  {
    pharmacy: 'Farmacia Central',
    product: 'Protector solar SPF 50',
    stock: 8,
    price: 15.9
  },
  {
    pharmacy: 'Farmacia del Barrio',
    product: 'Paracetamol 500 mg',
    stock: 60,
    price: 4.75
  },
  {
    pharmacy: 'Farmacia del Barrio',
    product: 'Ibuprofeno 400 mg',
    stock: 18,
    price: 6.95
  },
  {
    pharmacy: 'Farmacia del Barrio',
    product: 'Azitromicina 500 mg',
    stock: 5,
    price: 12.4
  },
  {
    pharmacy: 'Farmacia del Barrio',
    product: 'Salbutamol 100 mcg',
    stock: 14,
    price: 5.8
  },
  {
    pharmacy: 'Farmacia del Barrio',
    product: 'Hidrocortisona crema 1%',
    stock: 22,
    price: 8.35
  }
];

async function main() {
  // Si no existe la categoria la crea
  const categoryIds = new Map<string, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    categoryIds.set(name, category.id);
  }

  // Recorre el array PRODUCTS. Comprueba si el producto ya existe por su nombre.
  const productIds = new Map<string, string>();
  for (const item of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { name: item.name }
    });
    const product =
      existing ??
      (await prisma.product.create({
        data: {
          name: item.name,
          description: item.description,
          categoryId: categoryIds.get(item.category)
        }
      }));
    productIds.set(item.name, product.id);
  }

  // Recorre el array PHARMACIES. Si la farmacia ya existe por su nombre la recupera, y si no, la crea.
  const pharmacyIds = new Map<string, string>();
  for (const item of PHARMACIES) {
    const existing = await prisma.pharmacy.findFirst({
      where: { name: item.name }
    });
    const pharmacy = existing ?? (await prisma.pharmacy.create({ data: item }));
    pharmacyIds.set(item.name, pharmacy.id);
  }

  // Recorre cada relación de inventario. Utiliza los mapas anteriores para traducir los nombres de la farmacia y del producto a sus respectivos IDs (pharmacyId y productId).
  for (const row of INVENTORY) {
    const pharmacyId = pharmacyIds.get(row.pharmacy)!;
    const productId = productIds.get(row.product)!;

    await prisma.inventory.upsert({
      where: { pharmacyId_productId: { pharmacyId, productId } },
      create: {
        pharmacyId,
        productId,
        stock: row.stock,
        price: row.price
      },
      update: {
        stock: row.stock,
        price: row.price
      }
    });
  }
  // Cuenta de forma simultánea todos los registros totales de cada tabla con count()
  const [categories, products, pharmacies, inventory] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.pharmacy.count(),
    prisma.inventory.count()
  ]);

  console.log(
    `Seed listo: ${categories} categorías, ${products} productos, ` +
      `${pharmacies} farmacias, ${inventory} filas de inventario.`
  );
}

main()
  .catch((error) => {
    console.error('Error en el seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
