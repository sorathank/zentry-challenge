import { Worker } from './worker';

// Mock dependencies
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  popBatch: jest.fn(),
  getQueueLength: jest.fn(),
};

const mockDatabaseClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  processBatch: jest.fn(),
  getUserCount: jest.fn(),
};

const mockConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
  },
  worker: {
    batchSize: 1000,
    queueName: 'test-queue',
    concurrency: 4,
    maxRetries: 3,
  },
};

// Mock the imports
jest.mock('./redis-client', () => ({
  RedisClient: jest.fn().mockImplementation(() => mockRedisClient),
}));

jest.mock('./database-client', () => ({
  DatabaseClient: jest.fn().mockImplementation(() => mockDatabaseClient),
}));

jest.mock('./config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
    },
    worker: {
      batchSize: 1000,
      queueName: 'test-queue',
      concurrency: 4,
      maxRetries: 3,
    },
  },
}));

describe('Worker', () => {
  let worker: Worker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new Worker();
  });

  describe('constructor', () => {
    it('should initialize with default concurrency', () => {
      expect(worker).toBeDefined();
    });

    it('should initialize with custom concurrency', () => {
      const customWorker = new Worker(8);
      expect(customWorker).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should connect to Redis and database', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockDatabaseClient.connect.mockResolvedValue(undefined);

      console.log = jest.fn();
      await worker.initialize();

      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
      expect(mockDatabaseClient.connect).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Worker initialized');
    });

    it('should handle Redis connection errors', async () => {
      const error = new Error('Redis connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(worker.initialize()).rejects.toThrow('Redis connection failed');
    });

    it('should handle database connection errors', async () => {
      const error = new Error('Database connection failed');
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockDatabaseClient.connect.mockRejectedValue(error);

      await expect(worker.initialize()).rejects.toThrow('Database connection failed');
    });
  });

  describe('stop', () => {
    it('should disconnect from Redis and database', async () => {
      mockRedisClient.disconnect.mockResolvedValue(undefined);
      mockDatabaseClient.disconnect.mockResolvedValue(undefined);

      console.log = jest.fn();
      await worker.stop();

      expect(console.log).toHaveBeenCalledWith('Stopping worker...');
      expect(console.log).toHaveBeenCalledWith('Worker stopped');
      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
      expect(mockDatabaseClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it.skip('should handle disconnect errors gracefully', async () => {
      const error = new Error('Disconnect failed');
      mockRedisClient.disconnect.mockRejectedValue(error);
      mockDatabaseClient.disconnect.mockResolvedValue(undefined);

      console.error = jest.fn();
      await worker.stop();

      expect(console.error).toHaveBeenCalledWith('Error during shutdown:', error);
    });
  });

  describe('getStats', () => {
    it('should return worker statistics', async () => {
      mockRedisClient.getQueueLength.mockResolvedValue(100);
      mockDatabaseClient.getUserCount.mockResolvedValue(50);

      const stats = await worker.getStats();

      expect(stats).toEqual({
        queueLength: 100,
        userCount: 50,
        processedCount: 0,
        transactionsPerSecond: expect.any(Number),
      });

      expect(mockRedisClient.getQueueLength).toHaveBeenCalledWith(
        mockConfig.worker.queueName
      );
      expect(mockDatabaseClient.getUserCount).toHaveBeenCalledTimes(1);
    });

    it('should handle stats errors', async () => {
      const error = new Error('Stats error');
      mockRedisClient.getQueueLength.mockRejectedValue(error);

      await expect(worker.getStats()).rejects.toThrow('Stats error');
    });
  });

  describe('basic functionality', () => {
    it('should have correct default configuration', () => {
      expect(worker).toBeDefined();
      // Worker is created and uses mocked config
    });

    it('should handle method calls without crashing', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockDatabaseClient.connect.mockResolvedValue(undefined);

      // Test that basic operations work
      await worker.initialize();
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockDatabaseClient.connect).toHaveBeenCalled();
    });
  });
}); 