# Worker Service

A simple worker that consumes transactions from Redis and processes them into PostgreSQL using Prisma.

## What it does

1. Connects to Redis and PostgreSQL (via Prisma)
2. Fetches batches of transactions from Redis queue
3. Processes each transaction type (register, referral, addfriend, unfriend)
4. Inserts user data into PostgreSQL

## Database Schema

The worker manages a comprehensive social media database with the following tables:

### Users
- **id**: Primary key
- **name**: Unique username
- **createdAt**: Registration timestamp
- **updatedAt**: Last modified timestamp

### Friendships
- **id**: Primary key
- **user1Id**: First user (smaller ID for consistency)
- **user2Id**: Second user (larger ID for consistency)
- **status**: ACTIVE or INACTIVE
- **createdAt**: Friendship creation timestamp
- **updatedAt**: Last status change timestamp

### Referrals
- **id**: Primary key
- **referrerId**: User who made the referral
- **referredId**: User who was referred
- **createdAt**: Referral timestamp

### Transaction Logs
- **id**: Primary key
- **userId**: User associated with the transaction
- **transactionType**: Type of transaction (register, referral, addfriend, unfriend)
- **transactionData**: Full transaction data (JSON)
- **processedAt**: When the transaction was processed

## Setup

### Prerequisites
- Node.js 18+
- Redis server
- PostgreSQL database

### Environment Configuration

Create a `.env` file in the worker directory with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/bacefook"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Worker Configuration
BATCH_SIZE=20000
QUEUE_NAME=transactions
```

**Note**: Replace `postgres:password` with your actual PostgreSQL username and password.

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Apply database migrations
npm run db:migrate
```

### Development

```bash
# Start the worker
npm run dev
```

## Architecture

- **RedisClient**: Type-safe Redis operations with parsing validation
- **DatabaseClient**: Prisma-based database operations with transaction processing
- **Worker**: Orchestrates the pipeline with error handling and monitoring
- **Types**: Strong typing with runtime validation using type guards

## Output

The worker logs:
- Connection status to Redis and PostgreSQL
- Transaction processing progress
- Database statistics (users, friendships, referrals, transactions)
- Error messages and retry attempts