import { createClient } from "redis";
import { config } from "./config";
import { parseTransaction } from "./utils";
import { ConnectionEvent } from "@repo/bacefook-core/types";

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
    console.log(
      `Connected to Redis at ${config.redis.host}:${config.redis.port}`
    );
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async popBatch(
    queueName: string,
    batchSize: number
  ): Promise<ConnectionEvent[]> {
    const transactions: ConnectionEvent[] = [];

    try {
      const pipeline = this.client.multi();

      for (let i = 0; i < batchSize; i++) {
        pipeline.rPop(queueName);
      }

      const results = await pipeline.exec();

      if (Array.isArray(results)) {
        for (const result of results) {
          if (result && typeof result === "string") {
            try {
              const transaction = parseTransaction(result);
              transactions.push(transaction);
            } catch (parseError) {
              console.error(
                `Failed to parse transaction: ${parseError}. Raw data: ${result}`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Redis pipeline error:", error);

      // Fallback to individual operations if pipeline fails
      try {
        for (let i = 0; i < batchSize; i++) {
          const result = await this.client.rPop(queueName);
          if (result) {
            try {
              const transaction = parseTransaction(result);
              transactions.push(transaction);
            } catch (parseError) {
              console.error(
                `Failed to parse transaction: ${parseError}. Raw data: ${result}`
              );
            }
          } else {
            break; // No more items in queue
          }
        }
      } catch (fallbackError) {
        console.error("Redis fallback error:", fallbackError);
      }
    }

    return transactions;
  }

  async getQueueLength(queueName: string): Promise<number> {
    return await this.client.lLen(queueName);
  }
}
