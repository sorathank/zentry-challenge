export interface Config {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  producer: {
    batchSize: number;
    intervalMs: number;
    queueName: string;
  };
}

export const config: Config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0", 10),
  },
  producer: {
    batchSize: parseInt(process.env.BATCH_SIZE || "10", 10),
    intervalMs: parseInt(process.env.INTERVAL_MS || "1000", 10),
    queueName: process.env.QUEUE_NAME || "transactions",
  },
};
