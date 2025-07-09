import { createClient, RedisClientType } from "redis";
import { config } from "./config";

export class RedisQueue {
  private client: RedisClientType;
  private queueName: string;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.queueName = config.producer.queueName;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.debug(
      `Connected to Redis at ${config.redis.host}:${config.redis.port}`
    );
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    console.debug("Disconnected from Redis");
  }

  async addTransaction(transaction: any): Promise<void> {
    await this.client.lPush(this.queueName, JSON.stringify(transaction));
  }

  async addTransactionBatch(transactions: any[]): Promise<void> {
    const serializedTransactions = transactions.map((tx) => JSON.stringify(tx));
    await this.client.lPush(this.queueName, serializedTransactions);
  }

  async getQueueLength(): Promise<number> {
    return await this.client.lLen(this.queueName);
  }

  async getTransaction(): Promise<any | null> {
    const result = await this.client.rPop(this.queueName);
    return result ? JSON.parse(result) : null;
  }
}
