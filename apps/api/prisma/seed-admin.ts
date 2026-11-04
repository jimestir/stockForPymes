import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(import.meta.dirname, '../../../.env') });

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@stockpymes.local').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin1234!';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Administrador';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: UserRole.ADMIN },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  console.log(`Admin listo: ${user.email} (rol ${user.role})`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(
      'Password por defecto: Admin1234! — define ADMIN_PASSWORD para cambiarla.'
    );
  }
}

main()
  .catch((error) => {
    console.error('Error creando el admin:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
