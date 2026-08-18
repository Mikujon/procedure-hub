import { PrismaClient } from "@prisma/client";

// Standard singleton pattern to avoid exhausting DB connections in dev
// (Next.js hot-reloads modules but keeps the Node process alive).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
