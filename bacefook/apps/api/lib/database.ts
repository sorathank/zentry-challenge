import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = db;

// Database connection health check
export async function checkDatabaseConnection() {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "connected", message: "Database connection successful" };
  } catch (error) {
    console.error("Database connection failed:", error);
    return { status: "error", message: "Database connection failed" };
  }
}
