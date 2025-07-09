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

// Analytics data types
export interface UserMetrics {
  totalUsers: number;
  newUsersToday: number;
  userGrowth: Array<{
    date: string;
    count: number;
  }>;
}

export interface FriendshipMetrics {
  totalFriendships: number;
  activeFriendships: number;
  inactiveFriendships: number;
  friendshipGrowth: Array<{
    date: string;
    count: number;
  }>;
}

export interface ReferralMetrics {
  totalReferrals: number;
  topReferrers: Array<{
    userName: string;
    referralCount: number;
  }>;
  referralChains: Array<{
    referrerId: number;
    referrerName: string;
    referredUsers: Array<{
      id: number;
      name: string;
      referredAt: Date;
    }>;
  }>;
}

export interface TransactionMetrics {
  totalTransactions: number;
  transactionTypes: Array<{
    type: string;
    count: number;
  }>;
  transactionVolume: Array<{
    date: string;
    count: number;
  }>;
}

export interface NetworkAnalytics {
  totalConnections: number;
  averageConnectionsPerUser: number;
  networkDensity: number;
  topConnectedUsers: Array<{
    userName: string;
    connectionCount: number;
  }>;
}
