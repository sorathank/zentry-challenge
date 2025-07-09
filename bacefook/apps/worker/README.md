# Worker Service

A simple worker that consumes transactions from Redis and processes them into PostgreSQL using Prisma.

## What it does

1. Connects to Redis and PostgreSQL (via Prisma)
2. Fetches batches of transactions from Redis queue
3. Processes each transaction type (register, referral, addfriend, unfriend)
4. Inserts user data into PostgreSQL

## Setup

```bash
# Install dependencies
npm install

# Set up the database URL for Prisma
export DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/bacefook"

# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Run the worker
npm run dev
```

## Environment Variables

### Required
- `DATABASE_URL`: PostgreSQL connection string for Prisma

### Optional
- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `BATCH_SIZE`: Number of transactions to process at once (default: 10)
- `QUEUE_NAME`: Redis queue name (default: transactions)

## Output

```
Connected to Redis at localhost:6379
Connected to PostgreSQL via Prisma
Worker initialized
Worker started with batch size: 10
Processed 10 transactions
Transaction types: { register: 6, addfriend: 3, referral: 1 }
Processed 8 transactions
Transaction types: { register: 5, unfriend: 2, addfriend: 1 }
```

## Database Operations

The worker uses **Prisma ORM** for all database operations:

- **Type-safe queries** - No raw SQL
- **Automatic migrations** - Schema changes handled by Prisma
- **Connection pooling** - Handled automatically
- **Query optimization** - Built-in by Prisma

### User Creation
- Uses `upsert` operations to safely create or update users
- Handles duplicate names gracefully
- Ensures referential integrity

## Development

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create and apply migrations
npm run db:migrate

# Push schema changes to database
npm run db:push

# Run with hot reload
npm run dev
```

## Database Schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

## Architecture

- **RedisClient**: Type-safe Redis operations with parsing validation
- **DatabaseClient**: Prisma-based database operations with transaction processing
- **Worker**: Orchestrates the pipeline with error handling and monitoring
- **Types**: Strong typing with runtime validation using type guards

## Error Handling

- **Invalid transactions** are logged and skipped
- **Database errors** are logged and cause graceful retries
- **Connection issues** trigger exponential backoff
- **Graceful shutdown** on SIGINT/SIGTERM