import { RedisQueue } from "./redis-queue";
import { config } from "./config";
import { generator } from "@repo/bacefook-core";

export class TransactionProducer {
  private generator: typeof generator;
  private redisQueue: RedisQueue;

  constructor() {
    this.generator = generator;
    this.redisQueue = new RedisQueue();
  }

  async initialize(): Promise<void> {
    await this.redisQueue.connect();
    console.log("Transaction producer initialized");
  }

  async start(): Promise<void> {
    console.log(
      `Starting transaction producer with new user per batch: ${config.producer.newUserBatchSize}`
    );

    console.log(`Consuming message every ${config.producer.intervalMs}ms`);

    const eventStream = this.generator.stream(config.producer.newUserBatchSize);

    const processEvents = async () => {
      try {
        const { value: events } = await eventStream.next();

        if (events && events.length > 0) {
          await this.redisQueue.addTransactionBatch(events);
          const queueLength = await this.redisQueue.getQueueLength();

          console.log(
            `Added ${events.length} transactions to queue. Queue length: ${queueLength}`
          );
        }
      } catch (error) {
        console.error("Error processing events:", error);
      }

      setTimeout(processEvents, config.producer.intervalMs);
    };

    processEvents();
  }

  async getQueueStats(): Promise<{ queueLength: number }> {
    const queueLength = await this.redisQueue.getQueueLength();
    return { queueLength };
  }
}
