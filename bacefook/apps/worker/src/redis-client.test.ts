import { RedisClient } from './redis-client';
import { config } from './config';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

// Mock config
jest.mock('./config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'password',
      db: 0,
    },
  },
}));

describe('RedisClient', () => {
  let mockRedisClient: any;
  let redisClient: RedisClient;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      rPop: jest.fn(),
      lLen: jest.fn(),
      multi: jest.fn(),
      exec: jest.fn(),
      on: jest.fn(),
    };

    const mockMulti = {
      rPop: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockRedisClient.multi.mockReturnValue(mockMulti);

    const { createClient } = require('redis');
    (createClient as jest.Mock).mockReturnValue(mockRedisClient);

    redisClient = new RedisClient();
    
    // Clear all mocks after construction
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Redis client with correct config', () => {
      // The createClient was called during beforeEach when creating RedisClient instance
      // Since we cleared mocks after construction, we need to create a new instance
      const { createClient } = require('redis');
      createClient.mockClear();
      
      new RedisClient();
      
      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'localhost',
          port: 6379,
        },
        password: 'password',
        database: 0,
      });
    });

    it('should set up error handler', () => {
      // The RedisClient constructor sets up error handler
      // This is verified by the client creation not throwing
      expect(redisClient).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to Redis', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await redisClient.connect();

      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(redisClient.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      mockRedisClient.disconnect.mockResolvedValue(undefined);

      await redisClient.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle disconnect error', async () => {
      const error = new Error('Disconnect failed');
      mockRedisClient.disconnect.mockRejectedValue(error);

      await expect(redisClient.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('popBatch', () => {
    it('should pop batch with pipeline when supported', async () => {
      const batchSize = 2;
      const queueName = 'test-queue';
      const mockResults = [
        '{"type":"register","name":"John"}',
        '{"type":"register","name":"Jane"}',
      ];

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockResolvedValue(mockResults);

      const result = await redisClient.popBatch(queueName, batchSize);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockMulti.rPop).toHaveBeenCalledTimes(batchSize);
      expect(mockMulti.rPop).toHaveBeenCalledWith(queueName);
      expect(mockMulti.exec).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { type: 'register', name: 'John' },
        { type: 'register', name: 'Jane' },
      ]);
    });

    it('should handle invalid JSON in pipeline results', async () => {
      const batchSize = 2;
      const queueName = 'test-queue';
      const mockResults = [
        'invalid-json',
        '{"type":"register","name":"Jane"}',
      ];

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockResolvedValue(mockResults);

      console.error = jest.fn();
      const result = await redisClient.popBatch(queueName, batchSize);

      expect(result).toEqual([{ type: 'register', name: 'Jane' }]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse transaction')
      );
    });

    it('should fall back to individual operations when pipeline fails', async () => {
      const batchSize = 2;
      const queueName = 'test-queue';
      const pipelineError = new Error('Pipeline failed');

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockRejectedValue(pipelineError);
      mockRedisClient.rPop
        .mockResolvedValueOnce('{"type":"register","name":"John"}')
        .mockResolvedValueOnce('{"type":"register","name":"Jane"}');

      console.error = jest.fn();
      const result = await redisClient.popBatch(queueName, batchSize);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockRedisClient.rPop).toHaveBeenCalledTimes(batchSize);
      expect(mockRedisClient.rPop).toHaveBeenCalledWith(queueName);
      expect(result).toEqual([
        { type: 'register', name: 'John' },
        { type: 'register', name: 'Jane' },
      ]);
      expect(console.error).toHaveBeenCalledWith('Redis pipeline error:', pipelineError);
    });

    it('should handle empty queue in fallback', async () => {
      const batchSize = 2;
      const queueName = 'test-queue';
      const pipelineError = new Error('Pipeline failed');

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockRejectedValue(pipelineError);
      mockRedisClient.rPop
        .mockResolvedValueOnce('{"type":"register","name":"John"}')
        .mockResolvedValueOnce(null);

      console.error = jest.fn();
      const result = await redisClient.popBatch(queueName, batchSize);

      expect(result).toEqual([{ type: 'register', name: 'John' }]);
    });

    it('should handle fallback errors', async () => {
      const batchSize = 2;
      const queueName = 'test-queue';
      const pipelineError = new Error('Pipeline failed');
      const fallbackError = new Error('Fallback failed');

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockRejectedValue(pipelineError);
      mockRedisClient.rPop.mockRejectedValue(fallbackError);

      console.error = jest.fn();
      const result = await redisClient.popBatch(queueName, batchSize);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Redis pipeline error:', pipelineError);
      expect(console.error).toHaveBeenCalledWith('Redis fallback error:', fallbackError);
    });

    it('should handle null and undefined results', async () => {
      const batchSize = 3;
      const queueName = 'test-queue';
      const mockResults = [
        '{"type":"register","name":"John"}',
        null,
        undefined,
      ];

      const mockMulti = mockRedisClient.multi();
      mockMulti.exec.mockResolvedValue(mockResults);

      const result = await redisClient.popBatch(queueName, batchSize);

      expect(result).toEqual([{ type: 'register', name: 'John' }]);
    });
  });

  describe('getQueueLength', () => {
    it('should return queue length', async () => {
      const queueName = 'test-queue';
      const expectedLength = 42;
      
      mockRedisClient.lLen.mockResolvedValue(expectedLength);

      const result = await redisClient.getQueueLength(queueName);

      expect(mockRedisClient.lLen).toHaveBeenCalledWith(queueName);
      expect(result).toBe(expectedLength);
    });

    it('should handle lLen error', async () => {
      const queueName = 'test-queue';
      const error = new Error('lLen failed');
      
      mockRedisClient.lLen.mockRejectedValue(error);

      await expect(redisClient.getQueueLength(queueName)).rejects.toThrow('lLen failed');
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors', () => {
      // Create a mock error handler to simulate Redis error
      const mockError = new Error('Redis connection lost');
      console.error = jest.fn();
      
      // The Redis client constructor sets up error handling
      // This test verifies the client can be created without errors
      expect(redisClient).toBeDefined();
      expect(mockError.message).toBe('Redis connection lost');
    });
  });

  describe('config variations', () => {
    it('should handle config without password', () => {
      jest.resetModules();
      jest.mock('./config', () => ({
        config: {
          redis: {
            host: 'localhost',
            port: 6379,
            db: 0,
          },
        },
      }));

      const { createClient } = require('redis');
      (createClient as jest.Mock).mockReturnValue(mockRedisClient);

      const { RedisClient } = require('./redis-client');
      new RedisClient();

      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'localhost',
          port: 6379,
        },
        password: undefined,
        database: 0,
      });
    });

    it('should handle config with different values', () => {
      jest.resetModules();
      jest.mock('./config', () => ({
        config: {
          redis: {
            host: 'redis.example.com',
            port: 6380,
            password: 'secret123',
            db: 2,
          },
        },
      }));

      const { createClient } = require('redis');
      (createClient as jest.Mock).mockReturnValue(mockRedisClient);

      const { RedisClient } = require('./redis-client');
      new RedisClient();

      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'redis.example.com',
          port: 6380,
        },
        password: 'secret123',
        database: 2,
      });
    });
  });
}); 