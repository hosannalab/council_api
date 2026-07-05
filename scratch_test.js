require('dotenv').config();
console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

try {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  console.log('Prisma client instantiated successfully with PrismaPg adapter!');
} catch (e) {
  console.error('Error instantiating Prisma client:', e);
}
