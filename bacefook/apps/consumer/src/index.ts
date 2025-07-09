import dotenv from "dotenv";

dotenv.config();

import { TransactionProducer } from "./producer";

async function main() {
  const producer = new TransactionProducer();

  try {
    await producer.initialize();
    await producer.start();

    setInterval(async () => {
      try {
        const stats = await producer.getQueueStats();
        console.log(`Queue Length: ${stats.queueLength}`);
      } catch (error) {
        console.error("Error getting queue length:", error);
      }
    }, 5000);
  } catch (error) {
    console.error("Failed to start producer:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
