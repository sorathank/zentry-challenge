import { PrismaClient } from "@prisma/client";
import {
  AddFriendEvent,
  ConnectionEvent,
  ReferralEvent,
  RegisterEvent,
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

  private async processRegisterEvent(event: RegisterEvent): Promise<void> {
    await this.prisma.user.upsert({
      where: { name: event.name },
      update: {},
      create: { name: event.name },
    });
  }

  private async processReferralEvent(event: ReferralEvent): Promise<void> {
    await this.prisma.user.upsert({
      where: { name: event.referredBy },
      update: {},
      create: { name: event.referredBy },
    });

    await this.prisma.user.upsert({
      where: { name: event.user },
      update: {},
      create: { name: event.user },
    });
  }

  private async processAddFriendEvent(event: AddFriendEvent): Promise<void> {
    // Ensure both users exist
    await this.prisma.user.upsert({
      where: { name: event.user1_name },
      update: {},
      create: { name: event.user1_name },
    });

    await this.prisma.user.upsert({
      where: { name: event.user2_name },
      update: {},
      create: { name: event.user2_name },
    });
  }

  private async processUnfriendEvent(event: UnfriendEvent): Promise<void> {
    // Ensure both users exist
    await this.prisma.user.upsert({
      where: { name: event.user1_name },
      update: {},
      create: { name: event.user1_name },
    });

    await this.prisma.user.upsert({
      where: { name: event.user2_name },
      update: {},
      create: { name: event.user2_name },
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

  // Health check method
  async getUserCount(): Promise<number> {
    return await this.prisma.user.count();
  }
}
