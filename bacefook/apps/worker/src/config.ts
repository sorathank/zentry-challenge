import dotenv from "dotenv";

dotenv.config();

export const config = {
  redis: {
    host: process.env["REDIS_HOST"],
    port: parseInt(process.env["REDIS_PORT"] || "6379"),
    password: process.env["REDIS_PASSWORD"],
    db: parseInt(process.env["REDIS_DB"] || "0"),
  },
  database: {
    url: process.env["DATABASE_URL"],
  },
  worker: {
    batchSize: parseInt(process.env["BATCH_SIZE"] || "100"),
    queueName: process.env["QUEUE_NAME"] || "transactions",
  },
};
