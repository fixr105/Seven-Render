/**
 * Prisma client singleton for audit logging.
 * When DATABASE_URL is not set, getPrisma() returns null and the logger falls back to n8n only.
 */

import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  if (prismaInstance === null && process.env.DATABASE_URL) {
    try {
      prismaInstance = new PrismaClient();
    } catch {
      // Ignore; logger will use n8n fallback
    }
  }
  return prismaInstance;
}
