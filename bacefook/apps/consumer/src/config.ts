export interface Config {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  producer: {
    newUserBatchSize: number;
    intervalMs: number;
    queueName: string;
  };
}

export const config: Config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
  },
  producer: {
    newUserBatchSize: parseInt(process.env.NEW_USER_BATCH_SIZE || "10000"),
    intervalMs: parseInt(process.env.INTERVAL_MS || "1000"),
    queueName: process.env.QUEUE_NAME || "transactions",
  },
};
