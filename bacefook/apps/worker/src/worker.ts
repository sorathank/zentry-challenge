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
  private readonly maxBatchSize: number;

  constructor(concurrency?: number) {
    this.redisClient = new RedisClient();
    this.databaseClient = new DatabaseClient();
    this.concurrency = concurrency || config.worker.concurrency;
    this.maxBatchSize = config.worker.batchSize;
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
    console.log(`Max batch size: ${this.maxBatchSize}`);

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
          this.maxBatchSize
        );

        if (transactions.length > 0) {
          // Process large batches in parallel chunks for better performance
          const chunkSize = Math.min(5000, Math.ceil(transactions.length / 4));
          const chunks = this.chunkArray(transactions, chunkSize);

          if (chunks.length > 1) {
            // Process chunks in parallel
            await Promise.all(
              chunks.map((chunk) => this.databaseClient.processBatch(chunk))
            );
          } else {
            // Process single batch
            await this.databaseClient.processBatch(transactions);
          }

          const processingTime = Date.now() - startTime;
          this.processedCount += transactions.length;

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
          await this.sleep(50); // Further reduced sleep time for faster polling
        }
      } catch (error) {
        console.error(`Worker ${workerId} error:`, error);
        await this.sleep(200); // Wait on error
      }
    }

    console.log(`Worker ${workerId} stopped`);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      const transactionsPerSecond = this.processedCount / elapsedSeconds;

      const targetIn5Seconds = 100000;
      
      if (elapsedSeconds >= 5) {
        const targetStatus = transactionsPerSecond >= targetIn5Seconds ? 'ACHIEVED' : 'NOT ACHIEVED';
        console.log(
          `Actual 5s result: ${this.processedCount / (elapsedSeconds / 5)}/100000 - Target ${targetStatus}`
        );
      }
    }, 5000);
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
      transactionsPerSecond,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
