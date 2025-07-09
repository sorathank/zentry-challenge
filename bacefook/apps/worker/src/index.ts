import dotenv from "dotenv";

dotenv.config();

import { Worker } from "./worker";

async function main(): Promise<void> {
  const worker = new Worker();

  try {
    await worker.initialize();
    await worker.start();
  } catch (error) {
    console.error("Worker failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
