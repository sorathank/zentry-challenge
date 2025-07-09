import { Worker } from './worker';

async function main(): Promise<void> {
  const worker = new Worker();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  try {
    await worker.initialize();
    await worker.start();
  } catch (error) {
    console.error('Worker failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Application error:', error);
  process.exit(1);
}); 