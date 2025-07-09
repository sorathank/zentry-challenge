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
    
    for (let i = 0; i < batchSize; i++) {
      const transactionString = await this.client.rPop(queueName);
      if (!transactionString) break;
      
      try {
        const transaction = parseTransaction(transactionString);
        transactions.push(transaction);
      } catch (error) {
        console.error(`Failed to parse transaction: ${error}. Raw data: ${transactionString}`);
      }
    }
    
    return transactions;
  }

  async getQueueLength(queueName: string): Promise<number> {
    return await this.client.lLen(queueName);
  }
} 