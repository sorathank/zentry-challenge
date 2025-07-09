import { PrismaClient } from "@prisma/client";
import {
  ConnectionEvent,
  RegisterEvent,
  ReferralEvent,
  AddFriendEvent,
  UnfriendEvent,
} from "@repo/bacefook-core/types";

interface BatchData {
  newUsers: Set<string>;
  referrals: Array<{ referrerId: string; referredId: string }>;
  friendships: Array<{ user1: string; user2: string }>;
  unfriendships: Array<{ user1: string; user2: string }>;
  transactionLogs: Array<{ userName: string; type: string; data: any }>;
}

export class DatabaseClient {
  private prisma: PrismaClient;
  private userCache: Map<string, number> = new Map(); // Cache username -> userId
  private cacheLastUpdated: number = 0;
  private readonly CACHE_TTL = 30000;
  private userCreationMutex: Map<string, Promise<number>> = new Map(); // Prevent concurrent user creation

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
    console.log("Connected to PostgreSQL via Prisma");

    // Initialize user cache
    await this.refreshUserCache();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async refreshUserCache(): Promise<void> {
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true },
    });

    this.userCache.clear();
    users.forEach((user) => {
      this.userCache.set(user.name, user.id);
    });

    this.cacheLastUpdated = Date.now();
    console.log(`User cache refreshed with ${users.length} users`);
  }

  private async ensureUserCacheFresh(): Promise<void> {
    if (Date.now() - this.cacheLastUpdated > this.CACHE_TTL) {
      await this.refreshUserCache();
    }
  }

  private preprocessBatch(transactions: ConnectionEvent[]): BatchData {
    const batchData: BatchData = {
      newUsers: new Set(),
      referrals: [],
      friendships: [],
      unfriendships: [],
      transactionLogs: [],
    };

    // Pre-process all transactions to collect required data
    for (const transaction of transactions) {
      switch (transaction.type) {
        case "register":
          const registerEvent = transaction as RegisterEvent;
          batchData.newUsers.add(registerEvent.name);
          batchData.transactionLogs.push({
            userName: registerEvent.name,
            type: "register",
            data: registerEvent,
          });
          break;

        case "referral":
          const referralEvent = transaction as ReferralEvent;
          batchData.newUsers.add(referralEvent.user);
          batchData.newUsers.add(referralEvent.referredBy);
          batchData.referrals.push({
            referrerId: referralEvent.referredBy,
            referredId: referralEvent.user,
          });
          batchData.transactionLogs.push({
            userName: referralEvent.user,
            type: "referral",
            data: referralEvent,
          });
          break;

        case "addfriend":
          const addFriendEvent = transaction as AddFriendEvent;
          batchData.newUsers.add(addFriendEvent.user1_name);
          batchData.newUsers.add(addFriendEvent.user2_name);
          batchData.friendships.push({
            user1: addFriendEvent.user1_name,
            user2: addFriendEvent.user2_name,
          });
          batchData.transactionLogs.push({
            userName: addFriendEvent.user1_name,
            type: "addfriend",
            data: addFriendEvent,
          });
          break;

        case "unfriend":
          const unfriendEvent = transaction as UnfriendEvent;
          batchData.newUsers.add(unfriendEvent.user1_name);
          batchData.newUsers.add(unfriendEvent.user2_name);
          batchData.unfriendships.push({
            user1: unfriendEvent.user1_name,
            user2: unfriendEvent.user2_name,
          });
          batchData.transactionLogs.push({
            userName: unfriendEvent.user1_name,
            type: "unfriend",
            data: unfriendEvent,
          });
          break;
      }
    }

    return batchData;
  }

  private async createUserSafely(name: string): Promise<number> {
    // Check if user creation is already in progress
    const existingPromise = this.userCreationMutex.get(name);
    if (existingPromise) {
      return existingPromise;
    }

    // Create user with retry logic for deadlocks
    const userPromise = this.retryOnDeadlock(async () => {
      try {
        const user = await this.prisma.user.create({
          data: { name },
        });
        this.userCache.set(name, user.id);
        return user.id;
      } catch (error: any) {
        if (error.code === "P2002") {
          // Unique constraint violation - user already exists
          const existingUser = await this.prisma.user.findUnique({
            where: { name },
          });
          if (existingUser) {
            this.userCache.set(name, existingUser.id);
            return existingUser.id;
          }
        }
        throw error;
      }
    }, 3);

    this.userCreationMutex.set(name, userPromise);

    try {
      const userId = await userPromise;
      return userId;
    } finally {
      this.userCreationMutex.delete(name);
    }
  }

  private async retryOnDeadlock<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if it's a deadlock error
        const isDeadlock =
          error.message &&
          (error.message.includes("deadlock detected") ||
            error.message.includes("40P01"));

        if (isDeadlock && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 100 + Math.random() * 100; // Exponential backoff with jitter
          console.warn(
            `Deadlock detected, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private async ensureUsersExist(
    userNames: Set<string>
  ): Promise<Map<string, number>> {
    const userMap = new Map<string, number>();
    const usersToCreate: string[] = [];

    // Check which users are already in cache
    for (const userName of userNames) {
      const cachedUserId = this.userCache.get(userName);
      if (cachedUserId) {
        userMap.set(userName, cachedUserId);
      } else {
        usersToCreate.push(userName);
      }
    }

    // Create missing users one by one to avoid deadlocks
    if (usersToCreate.length > 0) {
      const userCreationPromises = usersToCreate.map((userName) =>
        this.createUserSafely(userName).then((userId) => ({
          name: userName,
          id: userId,
        }))
      );

      const createdUsers = await Promise.all(userCreationPromises);

      for (const user of createdUsers) {
        userMap.set(user.name, user.id);
      }
    }

    return userMap;
  }

  async processBatch(transactions: ConnectionEvent[]): Promise<void> {
    if (transactions.length === 0) return;

    const startTime = Date.now();

    try {
      // Ensure cache is fresh
      await this.ensureUserCacheFresh();

      // Pre-process all transactions
      const batchData = this.preprocessBatch(transactions);

      // Ensure all users exist
      const userMap = await this.ensureUsersExist(batchData.newUsers);

      // Execute all database operations in a single transaction
      await this.prisma.$transaction(
        async (tx) => {
          // Bulk create referrals
          if (batchData.referrals.length > 0) {
            const referralData = batchData.referrals.map((ref) => ({
              referrerId: userMap.get(ref.referrerId)!,
              referredId: userMap.get(ref.referredId)!,
            }));

            await tx.referral.createMany({
              data: referralData,
              skipDuplicates: true,
            });
          }

          // Bulk handle friendships using raw SQL for maximum performance
          if (batchData.friendships.length > 0) {
            const friendshipData = batchData.friendships.map((friendship) => {
              const user1Id = userMap.get(friendship.user1)!;
              const user2Id = userMap.get(friendship.user2)!;
              // Ensure consistent ordering
              const [smallerId, largerId] =
                user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
              return { user1Id: smallerId, user2Id: largerId };
            });

            // Use raw SQL for bulk upsert - much faster than individual upserts
            const friendshipValues = friendshipData
              .map(
                (f) => `(${f.user1Id}, ${f.user2Id}, 'ACTIVE', NOW(), NOW())`
              )
              .join(", ");

            await tx.$executeRawUnsafe(`
              INSERT INTO friendships (user1_id, user2_id, status, created_at, updated_at)
              VALUES ${friendshipValues}
              ON CONFLICT (user1_id, user2_id) 
              DO UPDATE SET status = 'ACTIVE', updated_at = NOW()
            `);
          }

          // Bulk handle unfriendships using raw SQL
          if (batchData.unfriendships.length > 0) {
            const unfriendshipData = batchData.unfriendships.map(
              (unfriendship) => {
                const user1Id = userMap.get(unfriendship.user1)!;
                const user2Id = userMap.get(unfriendship.user2)!;
                const [smallerId, largerId] =
                  user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
                return { user1Id: smallerId, user2Id: largerId };
              }
            );

            // Use raw SQL for bulk updates
            const unfriendshipConditions = unfriendshipData
              .map(
                (u) => `(user1_id = ${u.user1Id} AND user2_id = ${u.user2Id})`
              )
              .join(" OR ");

            if (unfriendshipConditions) {
              await tx.$executeRawUnsafe(`
                UPDATE friendships 
                SET status = 'INACTIVE', updated_at = NOW()
                WHERE (${unfriendshipConditions}) AND status = 'ACTIVE'
              `);
            }
          }

          // Bulk create transaction logs
          if (batchData.transactionLogs.length > 0) {
            const logData = batchData.transactionLogs.map((log) => ({
              userId: userMap.get(log.userName)!,
              transactionType: log.type,
              transactionData: log.data,
            }));

            await tx.transactionLog.createMany({
              data: logData,
            });
          }
        },
        {
          timeout: 60000, // 60 second timeout
          isolationLevel: "ReadCommitted", // Less strict isolation to reduce deadlocks
        }
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `Processed ${transactions.length} transactions in ${processingTime}ms (${((transactions.length / processingTime) * 1000).toFixed(0)} tx/s)`
      );
    } catch (error) {
      console.error(
        `Error processing batch of ${transactions.length} transactions:`,
        error
      );
      throw error;
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
