import { createClient } from 'redis';
import { config } from './config';
import { parseTransaction } from './utils';
import { ConnectionEvent } from '@repo/bacefook-core/types';

export class RedisClient {
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log(`Connected to Redis at ${config.redis.host}:${config.redis.port}`);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async popBatch(queueName: string, batchSize: number): Promise<ConnectionEvent[]> {
    const transactions: ConnectionEvent[] = [];
    
    // Use optimized batch popping with pipeline
    const pipeline = this.client.multi();
    
    // Queue multiple pops in pipeline
    for (let i = 0; i < batchSize; i++) {
      pipeline.rPop(queueName);
    }
    
    try {
      const results = await pipeline.exec();
      
      if (results) {
        for (const result of results) {
          // Redis pipeline returns [error, value] tuples
          const [error, value] = result as [Error | null, string | null];
          
          if (!error && value) {
            try {
              const transaction = parseTransaction(value);
              transactions.push(transaction);
            } catch (parseError) {
              console.error(`Failed to parse transaction: ${parseError}. Raw data: ${value}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Redis pipeline error:', error);
    }
    
    return transactions;
  }

  async getQueueLength(queueName: string): Promise<number> {
    return await this.client.lLen(queueName);
  }
} 