import { RedisQueue } from './redis-queue';
import { createClient } from 'redis';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

jest.mock('./config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
    },
    producer: {
      queueName: 'test-transactions',
    },
  },
}));

describe('RedisQueue', () => {
  let redisQueue: RedisQueue;
  let mockRedisClient: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      lPush: jest.fn().mockResolvedValue(1),
      lLen: jest.fn().mockResolvedValue(0),
      rPop: jest.fn().mockResolvedValue(null),
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);

    redisQueue = new RedisQueue();
  });

  describe('constructor', () => {
    it('should create Redis client with correct configuration', () => {
      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'localhost',
          port: 6379,
        },
        password: undefined,
        database: 0,
      });
    });
  });

  describe('connect', () => {
    it('should connect to Redis and log success message', async () => {
      await redisQueue.connect();

      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(redisQueue.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis and log success message', async () => {
      await redisQueue.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle disconnection errors', async () => {
      const error = new Error('Disconnection failed');
      mockRedisClient.disconnect.mockRejectedValue(error);

      await expect(redisQueue.disconnect()).rejects.toThrow();
    });
  });

  describe('addTransaction', () => {
    it('should add a single transaction to the queue', async () => {
      const transaction = {
        type: 'register',
        name: 'user00001',
        created_at: '2024-01-01T12:00:00.000Z',
      };

      await redisQueue.addTransaction(transaction);

      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        'test-transactions',
        JSON.stringify(transaction)
      );
    });

    it('should handle serialization of complex transaction objects', async () => {
      const transaction = {
        type: 'addfriend',
        user1_name: 'user00001',
        user2_name: 'user00002',
        created_at: '2024-01-01T12:00:00.000Z',
        metadata: {
          source: 'test',
          tags: ['friend', 'connection'],
        },
      };

      await redisQueue.addTransaction(transaction);

      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        'test-transactions',
        JSON.stringify(transaction)
      );
    });

    it('should handle Redis errors when adding transaction', async () => {
      const transaction = { type: 'register', name: 'user00001' };
      const error = new Error('Redis error');
      mockRedisClient.lPush.mockRejectedValue(error);

      await expect(redisQueue.addTransaction(transaction)).rejects.toThrow();
    });
  });

  describe('addTransactionBatch', () => {
    it('should add multiple transactions to the queue', async () => {
      const transactions = [
        { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
        { type: 'register', name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
        { type: 'addfriend', user1_name: 'user00001', user2_name: 'user00002', created_at: '2024-01-01T12:00:02.000Z' },
      ];

      await redisQueue.addTransactionBatch(transactions);

      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        'test-transactions',
        transactions.map(tx => JSON.stringify(tx))
      );
    });

    it('should handle empty batch', async () => {
      await redisQueue.addTransactionBatch([]);

      expect(mockRedisClient.lPush).toHaveBeenCalledWith('test-transactions', []);
    });

    it('should handle Redis errors when adding batch', async () => {
      const transactions = [{ type: 'register', name: 'user00001' }];
      const error = new Error('Redis batch error');
      mockRedisClient.lPush.mockRejectedValue(error);

      await expect(redisQueue.addTransactionBatch(transactions)).rejects.toThrow('Redis batch error');
    });
  });

  describe('getQueueLength', () => {
    it('should return the queue length', async () => {
      mockRedisClient.lLen.mockResolvedValue(42);

      const length = await redisQueue.getQueueLength();

      expect(mockRedisClient.lLen).toHaveBeenCalledWith('test-transactions');
      expect(length).toBe(42);
    });

    it('should return 0 for empty queue', async () => {
      mockRedisClient.lLen.mockResolvedValue(0);

      const length = await redisQueue.getQueueLength();

      expect(length).toBe(0);
    });

    it('should handle Redis errors when getting queue length', async () => {
      const error = new Error('Redis length error');
      mockRedisClient.lLen.mockRejectedValue(error);

      await expect(redisQueue.getQueueLength()).rejects.toThrow('Redis length error');
    });
  });

  describe('getTransaction', () => {
    it('should pop and return a transaction from the queue', async () => {
      const transaction = {
        type: 'register',
        name: 'user00001',
        created_at: '2024-01-01T12:00:00.000Z',
      };
      mockRedisClient.rPop.mockResolvedValue(JSON.stringify(transaction));

      const result = await redisQueue.getTransaction();

      expect(mockRedisClient.rPop).toHaveBeenCalledWith('test-transactions');
      expect(result).toEqual(transaction);
    });

    it('should return null when queue is empty', async () => {
      mockRedisClient.rPop.mockResolvedValue(null);

      const result = await redisQueue.getTransaction();

      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      mockRedisClient.rPop.mockResolvedValue('invalid json');

      await expect(redisQueue.getTransaction()).rejects.toThrow();
    });

    it('should handle Redis errors when getting transaction', async () => {
      const error = new Error('Redis pop error');
      mockRedisClient.rPop.mockRejectedValue(error);

      await expect(redisQueue.getTransaction()).rejects.toThrow('Redis pop error');
    });

    it('should handle complex transaction objects', async () => {
      const transaction = {
        type: 'addfriend',
        user1_name: 'user00001',
        user2_name: 'user00002',
        created_at: '2024-01-01T12:00:00.000Z',
        metadata: {
          source: 'test',
          connectionType: 'mutual',
        },
      };
      mockRedisClient.rPop.mockResolvedValue(JSON.stringify(transaction));

      const result = await redisQueue.getTransaction();

      expect(result).toEqual(transaction);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full queue lifecycle', async () => {
      // Connect
      await redisQueue.connect();
      
      // Add transactions
      const transactions = [
        { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
        { type: 'register', name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
      ];
      await redisQueue.addTransactionBatch(transactions);
      
      // Check queue length
      mockRedisClient.lLen.mockResolvedValue(2);
      const length = await redisQueue.getQueueLength();
      expect(length).toBe(2);
      
      // Get transaction
      mockRedisClient.rPop.mockResolvedValue(JSON.stringify(transactions[0]));
      const transaction = await redisQueue.getTransaction();
      expect(transaction).toEqual(transactions[0]);
      
      // Disconnect
      await redisQueue.disconnect();
    });
  });
}); 