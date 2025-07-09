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
      await this.retryOnDeadlock(async () => {
        await this.prisma.$transaction(
          async (tx) => {
            // Bulk create referrals using Prisma ORM
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

            // Handle friendships using Prisma ORM upserts
            if (batchData.friendships.length > 0) {
              const friendshipData = batchData.friendships.map((friendship) => {
                const user1Id = userMap.get(friendship.user1)!;
                const user2Id = userMap.get(friendship.user2)!;
                // Ensure consistent ordering
                const [smallerId, largerId] =
                  user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
                return { user1Id: smallerId, user2Id: largerId };
              });

              // Process friendships in parallel batches for better performance
              const chunkSize = 100;
              for (let i = 0; i < friendshipData.length; i += chunkSize) {
                const chunk = friendshipData.slice(i, i + chunkSize);

                await Promise.all(
                  chunk.map((friendship) =>
                    tx.friendship.upsert({
                      where: {
                        user1Id_user2Id: {
                          user1Id: friendship.user1Id,
                          user2Id: friendship.user2Id,
                        },
                      },
                      update: {
                        status: "ACTIVE",
                        updatedAt: new Date(),
                      },
                      create: {
                        user1Id: friendship.user1Id,
                        user2Id: friendship.user2Id,
                        status: "ACTIVE",
                      },
                    })
                  )
                );
              }
            }

            // Handle unfriendships using Prisma ORM
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

              // Process unfriendships in parallel batches
              const chunkSize = 100;
              for (let i = 0; i < unfriendshipData.length; i += chunkSize) {
                const chunk = unfriendshipData.slice(i, i + chunkSize);

                await Promise.all(
                  chunk.map((unfriendship) =>
                    tx.friendship.updateMany({
                      where: {
                        user1Id: unfriendship.user1Id,
                        user2Id: unfriendship.user2Id,
                        status: "ACTIVE",
                      },
                      data: {
                        status: "INACTIVE",
                        updatedAt: new Date(),
                      },
                    })
                  )
                );
              }
            }

            // Bulk create transaction logs using Prisma ORM
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
      }, 5); // Retry up to 5 times for deadlocks

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
