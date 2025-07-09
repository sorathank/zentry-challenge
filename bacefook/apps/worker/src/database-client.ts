import { PrismaClient } from "@prisma/client";
import {
  ConnectionEvent,
  RegisterEvent,
  ReferralEvent,
  AddFriendEvent,
  UnfriendEvent,
} from "@repo/bacefook-core/types";

export class DatabaseClient {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
    console.log("Connected to PostgreSQL via Prisma");
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async ensureUserExists(name: string): Promise<number> {
    const user = await this.prisma.user.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    return user.id;
  }

  private async processRegisterEvent(event: RegisterEvent): Promise<void> {
    await this.ensureUserExists(event.name);

    // Log the transaction
    const user = await this.prisma.user.findUnique({
      where: { name: event.name },
    });
    if (user) {
      await this.prisma.transactionLog.create({
        data: {
          userId: user.id,
          transactionType: "register",
          transactionData: { ...event },
        },
      });
    }
  }

  private async processReferralEvent(event: ReferralEvent): Promise<void> {
    // Ensure both users exist
    const referrerId = await this.ensureUserExists(event.referredBy);
    const referredId = await this.ensureUserExists(event.user);

    // Create referral relationship (if it doesn't exist)
    await this.prisma.referral.upsert({
      where: {
        referrerId_referredId: {
          referrerId,
          referredId,
        },
      },
      update: {},
      create: {
        referrerId,
        referredId,
      },
    });

    await this.prisma.transactionLog.create({
      data: {
        userId: referredId,
        transactionType: "referral",
        transactionData: { ...event },
      },
    });
  }

  private async processAddFriendEvent(event: AddFriendEvent): Promise<void> {
    // Ensure both users exist
    const user1Id = await this.ensureUserExists(event.user1_name);
    const user2Id = await this.ensureUserExists(event.user2_name);

    // Ensure consistent ordering (smaller ID first to prevent duplicates)
    const [smallerId, largerId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    // Create or reactivate friendship
    await this.prisma.friendship.upsert({
      where: {
        user1Id_user2Id: {
          user1Id: smallerId,
          user2Id: largerId,
        },
      },
      update: {
        status: "ACTIVE",
      },
      create: {
        user1Id: smallerId,
        user2Id: largerId,
        status: "ACTIVE",
      },
    });

    // Log the transaction
    await this.prisma.transactionLog.create({
      data: {
        userId: user1Id,
        transactionType: "addfriend",
        transactionData: { ...event },
      },
    });
  }

  private async processUnfriendEvent(event: UnfriendEvent): Promise<void> {
    // Ensure both users exist
    const user1Id = await this.ensureUserExists(event.user1_name);
    const user2Id = await this.ensureUserExists(event.user2_name);

    // Ensure consistent ordering (smaller ID first)
    const [smallerId, largerId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    // Set friendship status to INACTIVE (don't delete, preserve history)
    await this.prisma.friendship.updateMany({
      where: {
        user1Id: smallerId,
        user2Id: largerId,
      },
      data: {
        status: "INACTIVE",
      },
    });

    // Log the transaction
    await this.prisma.transactionLog.create({
      data: {
        userId: user1Id,
        transactionType: "unfriend",
        transactionData: { ...event },
      },
    });
  }

  async processTransaction(transaction: ConnectionEvent): Promise<void> {
    try {
      switch (transaction.type) {
        case "register":
          await this.processRegisterEvent(transaction);
          break;

        case "referral":
          await this.processReferralEvent(transaction);
          break;

        case "addfriend":
          await this.processAddFriendEvent(transaction);
          break;

        case "unfriend":
          await this.processUnfriendEvent(transaction);
          break;

        default:
          console.warn(
            `Unknown transaction type: ${(transaction as any).type}`
          );
      }
    } catch (error) {
      console.error(`Error processing transaction:`, error);
      throw error;
    }
  }

  async processBatch(transactions: ConnectionEvent[]): Promise<void> {
    for (const transaction of transactions) {
      await this.processTransaction(transaction);
    }
  }

  async getUserCount(): Promise<number> {
    return await this.prisma.user.count();
  }

  async getFriendshipCount(): Promise<number> {
    return await this.prisma.friendship.count({
      where: { status: "ACTIVE" },
    });
  }

  async getReferralCount(): Promise<number> {
    return await this.prisma.referral.count();
  }

  async getTransactionLogCount(): Promise<number> {
    return await this.prisma.transactionLog.count();
  }

  async getStats(): Promise<{
    users: number;
    activeFriendships: number;
    referrals: number;
    totalTransactions: number;
  }> {
    const [users, activeFriendships, referrals, totalTransactions] =
      await Promise.all([
        this.getUserCount(),
        this.getFriendshipCount(),
        this.getReferralCount(),
        this.getTransactionLogCount(),
      ]);

    return {
      users,
      activeFriendships,
      referrals,
      totalTransactions,
    };
  }
}
