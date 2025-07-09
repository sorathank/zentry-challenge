import { RedisClient } from "./redis-client";
import { DatabaseClient } from "./database-client";
import { config } from "./config";
import { ConnectionEvent } from "@repo/bacefook-core/types";

export class Worker {
  private redisClient: RedisClient;
  private databaseClient: DatabaseClient;
  private isRunning: boolean = false;
  private workers: Promise<void>[] = [];
  private readonly concurrency: number;
  private processedCount: number = 0;
  private startTime: number = 0;

  constructor() {
    this.redisClient = new RedisClient();
    this.databaseClient = new DatabaseClient();
    this.concurrency = config.worker.concurrency;
  }

  async initialize(): Promise<void> {
    await this.redisClient.connect();
    await this.databaseClient.connect();
    console.log("Worker initialized");
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.startTime = Date.now();
    
    console.log(`Worker started with ${this.concurrency} concurrent workers`);
    console.log(`Batch size: ${config.worker.batchSize}`);

    // Start multiple worker processes in parallel
    this.workers = Array.from({ length: this.concurrency }, (_, i) => 
      this.workerProcess(i)
    );

    // Start performance monitoring
    this.startPerformanceMonitoring();

    // Wait for all workers to complete
    await Promise.all(this.workers);
  }

  private async workerProcess(workerId: number): Promise<void> {
    console.log(`Worker ${workerId} started`);
    
    while (this.isRunning) {
      try {
        const startTime = Date.now();
        
        const transactions: ConnectionEvent[] = await this.redisClient.popBatch(
          config.worker.queueName,
          config.worker.batchSize
        );

        if (transactions.length > 0) {
          await this.databaseClient.processBatch(transactions);
          
          const processingTime = Date.now() - startTime;
          this.processedCount += transactions.length;
          
          console.log(`Worker ${workerId}: Processed ${transactions.length} transactions in ${processingTime}ms`);
          
          // Log transaction type distribution
          const typeCounts = transactions.reduce(
            (acc, tx) => {
              acc[tx.type] = (acc[tx.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          console.log(`Worker ${workerId} types:`, typeCounts);
        } else {
          // No transactions, wait a bit before checking again
          await this.sleep(100); // Reduced sleep time for faster polling
        }
      } catch (error) {
        console.error(`Worker ${workerId} error:`, error);
        await this.sleep(100); // Wait on error
      }
    }
    
    console.log(`Worker ${workerId} stopped`);
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const transactionsPerSecond = this.processedCount / elapsedSeconds;
      
      console.log(`Performance: ${this.processedCount} transactions processed in ${elapsedSeconds.toFixed(1)}s`);
      console.log(`Average rate: ${transactionsPerSecond.toFixed(0)} transactions/second`);
    }, 5000); // Report every 5 seconds
  }

  async stop(): Promise<void> {
    console.log("Stopping worker...");
    this.isRunning = false;
    await Promise.all(this.workers);
    await this.redisClient.disconnect();
    await this.databaseClient.disconnect();
    console.log("Worker stopped");
  }

  async getStats(): Promise<{ 
    queueLength: number; 
    userCount: number; 
    processedCount: number;
    transactionsPerSecond: number;
  }> {
    const queueLength = await this.redisClient.getQueueLength(
      config.worker.queueName
    );
    const userCount = await this.databaseClient.getUserCount();
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const transactionsPerSecond = this.processedCount / elapsedSeconds;
    
    return { 
      queueLength, 
      userCount, 
      processedCount: this.processedCount,
      transactionsPerSecond
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
