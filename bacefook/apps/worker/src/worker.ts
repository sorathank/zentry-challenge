import { RedisClient } from './redis-client';
import { DatabaseClient } from './database-client';
import { config } from './config';
import { ConnectionEvent } from '@repo/bacefook-core/types';

export class Worker {
  private redisClient: RedisClient;
  private databaseClient: DatabaseClient;
  private isRunning = false;

  constructor() {
    this.redisClient = new RedisClient();
    this.databaseClient = new DatabaseClient();
  }

  async initialize(): Promise<void> {
    await this.redisClient.connect();
    await this.databaseClient.connect();
    console.log('Worker initialized');
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`Worker started with batch size: ${config.worker.batchSize}`);
    
    while (this.isRunning) {
      try {
        const transactions: ConnectionEvent[] = await this.redisClient.popBatch(
          config.worker.queueName, 
          config.worker.batchSize
        );
        
        if (transactions.length > 0) {
          await this.databaseClient.processBatch(transactions);
          console.log(`Processed ${transactions.length} transactions`);
          
          // Log transaction types for monitoring
          const typeCounts = transactions.reduce((acc, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`Transaction types:`, typeCounts);
        } else {
          // No transactions, wait a bit before checking again
          await this.sleep(1000);
        }
      } catch (error) {
        console.error('Error processing batch:', error);
        await this.sleep(5000); // Wait longer on error
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.redisClient.disconnect();
    await this.databaseClient.disconnect();
    console.log('Worker stopped');
  }

  async getStats(): Promise<{ queueLength: number; userCount: number }> {
    const queueLength = await this.redisClient.getQueueLength(config.worker.queueName);
    const userCount = await this.databaseClient.getUserCount();
    return { queueLength, userCount };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 