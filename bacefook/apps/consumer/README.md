# Consumer App

A transaction producer that generates social media events using the bacefook-core package and queues them in Redis.

## Features

- Generates batches of social media transactions (register, referral, friend, unfriend events)
- Configurable batch size and interval
- Redis queue for transaction storage
- Graceful shutdown handling
- Real-time queue statistics

## Configuration

Configure the app using environment variables:

### Redis Configuration
- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)
- `REDIS_DB`: Redis database number (default: 0)

### Producer Configuration
- `BATCH_SIZE`: Number of transactions to generate per batch (default: 10)
- `INTERVAL_MS`: Interval between batches in milliseconds (default: 1000)
- `QUEUE_NAME`: Name of the Redis queue (default: transactions)

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Example with custom configuration
```bash
BATCH_SIZE=50 INTERVAL_MS=500 REDIS_HOST=redis.example.com npm run dev
```

## Output

The producer will generate transaction events and add them to the Redis queue. You'll see output like:

```
Starting transaction producer with batch size: 10, interval: 1000ms
Added 10 transactions to queue. Queue length: 10
Sample transaction: {
  "type": "register",
  "name": "user00001",
  "created_at": "2024-01-01T12:00:00.000Z"
}
Queue Stats - Length: 45
```

## Queue Structure

Transactions are stored in Redis as JSON strings in a list structure. Each transaction follows the schema defined in the bacefook-core package:

- `register`: User registration events
- `referral`: User referral events  
- `addfriend`: Friend connection events
- `unfriend`: Friend disconnection events