// src/lib/prisma.ts  — Prisma Client singleton (avoids multiple instances in dev)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Increase connection limit to 50 and pool timeout to 30s to prevent Next.js concurrent request pool exhaustion
const dbUrl = (process.env.DATABASE_URL || '').includes('?') 
  ? `${process.env.DATABASE_URL}&connection_limit=50&pool_timeout=30` 
  : `${process.env.DATABASE_URL}?connection_limit=50&pool_timeout=30`;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ 
  log: ['error'],
  datasources: {
    db: { url: dbUrl }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
