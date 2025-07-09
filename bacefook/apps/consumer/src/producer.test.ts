import { TransactionProducer } from './producer';
import { RedisQueue } from './redis-queue';
import { generator } from '@repo/bacefook-core';

jest.mock('@repo/bacefook-core', () => ({
  generator: {
    stream: jest.fn(),
  },
}));

jest.mock('./redis-queue', () => ({
  RedisQueue: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    addTransactionBatch: jest.fn().mockResolvedValue(undefined),
    getQueueLength: jest.fn().mockResolvedValue(0),
  })),
}));

jest.mock('./config', () => ({
  config: {
    producer: {
      batchSize: 5,
      intervalMs: 100,
    },
  },
}));

jest.useFakeTimers();

describe('TransactionProducer', () => {
  let producer: TransactionProducer;
  let mockRedisQueue: jest.Mocked<any>;
  let mockEventStream: jest.Mocked<any>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockEventStream = {
      next: jest.fn(),
    };

    (generator.stream as jest.Mock).mockReturnValue(mockEventStream);

    mockRedisQueue = {
      connect: jest.fn().mockResolvedValue(undefined),
      addTransactionBatch: jest.fn().mockResolvedValue(undefined),
      getQueueLength: jest.fn().mockResolvedValue(0),
    };

    (RedisQueue as jest.Mock).mockImplementation(() => mockRedisQueue);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    producer = new TransactionProducer();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create generator and redisQueue instances', () => {
      expect(generator.stream).not.toHaveBeenCalled();
      expect(RedisQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialize', () => {
    it('should connect to Redis and log success message', async () => {
      await producer.initialize();

      expect(mockRedisQueue.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle Redis connection errors', async () => {
      const error = new Error('Redis connection failed');
      mockRedisQueue.connect.mockRejectedValue(error);

      await expect(producer.initialize()).rejects.toThrow('Redis connection failed');
    });
  });

  describe('start', () => {
    beforeEach(() => {
      mockEventStream.next.mockResolvedValue({
        value: [
          { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
          { type: 'register', name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
        ],
      });
      mockRedisQueue.getQueueLength.mockResolvedValue(25);
    });

    it('should create event stream with correct batch size', async () => {
      await producer.start();

      expect(generator.stream).toHaveBeenCalledWith(5);
    });

    it('should process events and add them to Redis queue', async () => {
      await producer.start();

      expect(mockEventStream.next).toHaveBeenCalledTimes(1);
      expect(mockRedisQueue.addTransactionBatch).toHaveBeenCalledWith([
        { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
        { type: 'register', name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
      ]);
    });

    it('should continue processing in subsequent iterations', async () => {
      await producer.start();

      expect(mockEventStream.next).toHaveBeenCalledTimes(1);

      await jest.runOnlyPendingTimersAsync();
      expect(mockEventStream.next).toHaveBeenCalledTimes(2);

      await jest.runOnlyPendingTimersAsync();
      expect(mockEventStream.next).toHaveBeenCalledTimes(3);
    });

    it('should handle empty event batches gracefully', async () => {
      mockEventStream.next.mockResolvedValue({ value: [] });

      await producer.start();
      await jest.runOnlyPendingTimersAsync();

      expect(mockRedisQueue.addTransactionBatch).not.toHaveBeenCalled();
      expect(mockRedisQueue.getQueueLength).not.toHaveBeenCalled();
    });

    it('should handle null event values gracefully', async () => {
      mockEventStream.next.mockResolvedValue({ value: null });

      await producer.start();
      await jest.runOnlyPendingTimersAsync();

      expect(mockRedisQueue.addTransactionBatch).not.toHaveBeenCalled();
      expect(mockRedisQueue.getQueueLength).not.toHaveBeenCalled();
    });

    it('should handle undefined event values gracefully', async () => {
      mockEventStream.next.mockResolvedValue({ value: undefined });

      await producer.start();
      await jest.runOnlyPendingTimersAsync();

      expect(mockRedisQueue.addTransactionBatch).not.toHaveBeenCalled();
      expect(mockRedisQueue.getQueueLength).not.toHaveBeenCalled();
    });

    it('should process different transaction types', async () => {
      const mixedTransactions = [
        { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
        { type: 'addfriend', user1_name: 'user00001', user2_name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
        { type: 'unfriend', user1_name: 'user00001', user2_name: 'user00003', created_at: '2024-01-01T12:00:02.000Z' },
        { type: 'referral', referredBy: 'user00001', user: 'user00004', created_at: '2024-01-01T12:00:03.000Z' },
      ];
      
      mockEventStream.next.mockResolvedValue({ value: mixedTransactions });

      await producer.start();
      await jest.runOnlyPendingTimersAsync();

      expect(mockRedisQueue.addTransactionBatch).toHaveBeenCalledWith(mixedTransactions);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue length from Redis', async () => {
      mockRedisQueue.getQueueLength.mockResolvedValue(42);

      const stats = await producer.getQueueStats();

      expect(mockRedisQueue.getQueueLength).toHaveBeenCalledTimes(1);
      expect(stats).toEqual({ queueLength: 42 });
    });

    it('should return zero for empty queue', async () => {
      mockRedisQueue.getQueueLength.mockResolvedValue(0);

      const stats = await producer.getQueueStats();
      expect(stats).toEqual({ queueLength: 0 });
    });

    it('should handle Redis errors when getting queue stats', async () => {
      const error = new Error('Redis stats error');
      mockRedisQueue.getQueueLength.mockRejectedValue(error);

      await expect(producer.getQueueStats()).rejects.toThrow('Redis stats error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full producer lifecycle', async () => {
      mockEventStream.next.mockResolvedValue({
        value: [
          { type: 'register', name: 'user00001', created_at: '2024-01-01T12:00:00.000Z' },
          { type: 'register', name: 'user00002', created_at: '2024-01-01T12:00:01.000Z' },
        ],
      });
      
      await producer.initialize();
      expect(mockRedisQueue.connect).toHaveBeenCalledTimes(1);
      
      await producer.start();
      expect(generator.stream).toHaveBeenCalledWith(5);
      
      expect(mockEventStream.next).toHaveBeenCalledTimes(1);
      expect(mockRedisQueue.addTransactionBatch).toHaveBeenCalledTimes(1);
      
      mockRedisQueue.getQueueLength.mockResolvedValue(100);
      const stats = await producer.getQueueStats();
      expect(stats.queueLength).toBe(100);
    });
  });
}); 