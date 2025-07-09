import { DatabaseClient } from './database-client';
import { ConnectionEvent } from '@repo/bacefook-core/types';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  referral: {
    createMany: jest.fn(),
    count: jest.fn(),
  },
  friendship: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  transactionLog: {
    createMany: jest.fn(),
    count: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

describe('DatabaseClient', () => {
  let databaseClient: DatabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    databaseClient = new DatabaseClient();
  });

  describe('connect', () => {
    it('should connect to database and initialize cache', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      
      console.log = jest.fn();
      await databaseClient.connect();

      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: { id: true, name: true },
      });
      expect(console.log).toHaveBeenCalledWith('Connected to PostgreSQL via Prisma');
      expect(console.log).toHaveBeenCalledWith('User cache refreshed with 2 users');
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPrisma.$connect.mockRejectedValue(error);

      await expect(databaseClient.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database', async () => {
      await databaseClient.disconnect();

      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('processBatch', () => {
    beforeEach(async () => {
      // Setup initial cache by calling connect
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      mockPrisma.$connect.mockResolvedValue(undefined);
      await databaseClient.connect();
      
      // Setup for successful operations
      mockPrisma.user.create.mockResolvedValue({ id: 3, name: 'Test User' });
          mockPrisma.referral.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.friendship.upsert.mockResolvedValue({ 
      id: 1, user1Id: 1, user2Id: 2, status: 'ACTIVE' 
    });
    mockPrisma.friendship.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.transactionLog.createMany.mockResolvedValue({ count: 1 });
      
      // Mock transaction wrapper
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrisma);
      });
    });

    it('should process register events', async () => {
      const transactions: ConnectionEvent[] = [
        { type: 'register', name: 'Charlie', created_at: new Date().toISOString() },
      ];

      mockPrisma.user.create.mockResolvedValue({ id: 3, name: 'Charlie' });

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { name: 'Charlie' },
      });
    });

    it('should process referral events', async () => {
      const transactions: ConnectionEvent[] = [
        { 
          type: 'referral', 
          referredBy: 'Alice', 
          user: 'Bob', 
          created_at: new Date().toISOString() 
        },
      ];

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.referral.createMany).toHaveBeenCalledWith({
        data: [{ referrerId: 1, referredId: 2 }],
        skipDuplicates: true,
      });
    });

    it('should process friendship events', async () => {
      const transactions: ConnectionEvent[] = [
        { 
          type: 'addfriend', 
          user1_name: 'Alice', 
          user2_name: 'Bob', 
          created_at: new Date().toISOString() 
        },
      ];

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.friendship.upsert).toHaveBeenCalledWith({
        where: { user1Id_user2Id: { user1Id: 1, user2Id: 2 } },
        update: { status: 'ACTIVE', updatedAt: expect.any(Date) },
        create: { user1Id: 1, user2Id: 2, status: 'ACTIVE' },
      });
    });

    it('should process unfriend events', async () => {
      const transactions: ConnectionEvent[] = [
        { 
          type: 'unfriend', 
          user1_name: 'Alice', 
          user2_name: 'Bob', 
          created_at: new Date().toISOString() 
        },
      ];

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.friendship.updateMany).toHaveBeenCalledWith({
        where: { 
          user1Id: 1, 
          user2Id: 2,
          status: 'ACTIVE'
        },
        data: { status: 'INACTIVE', updatedAt: expect.any(Date) },
      });
    });

    it('should process transaction logs', async () => {
      const transactions: ConnectionEvent[] = [
        { type: 'register', name: 'Charlie', created_at: new Date().toISOString() },
        { type: 'referral', referredBy: 'Alice', user: 'Bob', created_at: new Date().toISOString() },
      ];

      mockPrisma.user.create.mockResolvedValue({ id: 3, name: 'Charlie' });

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.transactionLog.createMany).toHaveBeenCalledWith({
        data: [
          { transactionType: 'register', transactionData: transactions[0], userId: 3 },
          { transactionType: 'referral', transactionData: transactions[1], userId: 2 },
        ],
      });
    });

    it('should handle empty batch', async () => {
      await databaseClient.processBatch([]);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.referral.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.friendship.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.transactionLog.createMany).not.toHaveBeenCalled();
    });

    it('should handle duplicate user creation', async () => {
      const transactions: ConnectionEvent[] = [
        { type: 'register', name: 'Charlie', created_at: new Date().toISOString() },
      ];

      const uniqueError = new Error('Unique constraint violation');
      (uniqueError as any).code = 'P2002';
      
      mockPrisma.user.create.mockRejectedValue(uniqueError);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 3, name: 'Charlie' });

      await databaseClient.processBatch(transactions);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { name: 'Charlie' },
      });
    });

    it('should handle processing errors', async () => {
      const transactions: ConnectionEvent[] = [
        { type: 'register', name: 'Charlie', created_at: new Date().toISOString() },
      ];

      const error = new Error('Database error');
      mockPrisma.user.create.mockRejectedValue(error);

      await expect(databaseClient.processBatch(transactions)).rejects.toThrow('Database error');
    });
  });

  describe('stats methods', () => {
    it('should get user count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await databaseClient.connect();
      jest.clearAllMocks();

      const mockCount = jest.fn().mockResolvedValue(42);
      mockPrisma.user.count = mockCount;

      const result = await databaseClient.getUserCount();

      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(result).toBe(42);
    });

    it('should get friendship count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await databaseClient.connect();
      jest.clearAllMocks();

      const mockCount = jest.fn().mockResolvedValue(10);
      mockPrisma.friendship.count = mockCount;

      const result = await databaseClient.getFriendshipCount();

      expect(mockCount).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
      expect(result).toBe(10);
    });

    it('should get referral count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await databaseClient.connect();
      jest.clearAllMocks();

      const mockCount = jest.fn().mockResolvedValue(5);
      mockPrisma.referral.count = mockCount;

      const result = await databaseClient.getReferralCount();

      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(result).toBe(5);
    });

    it('should get transaction log count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await databaseClient.connect();
      jest.clearAllMocks();

      const mockCount = jest.fn().mockResolvedValue(100);
      mockPrisma.transactionLog.count = mockCount;

      const result = await databaseClient.getTransactionLogCount();

      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(result).toBe(100);
    });

    it('should get all stats', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await databaseClient.connect();
      jest.clearAllMocks();

      const mockUserCount = jest.fn().mockResolvedValue(42);
      const mockFriendshipCount = jest.fn().mockResolvedValue(10);
      const mockReferralCount = jest.fn().mockResolvedValue(5);
      const mockTransactionLogCount = jest.fn().mockResolvedValue(100);

      mockPrisma.user.count = mockUserCount;
      mockPrisma.friendship.count = mockFriendshipCount;
      mockPrisma.referral.count = mockReferralCount;
      mockPrisma.transactionLog.count = mockTransactionLogCount;

      const result = await databaseClient.getStats();

      expect(result).toEqual({
        users: 42,
        activeFriendships: 10,
        referrals: 5,
        totalTransactions: 100,
      });
    });
  });
}); 