# Bacefook API Server

API server for querying network relationships in the Bacefook social network platform.

## Getting Started

First, ensure PostgreSQL is running and the database is set up.

Create a `.env` file with:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bacefook"
```

Run the development server:

```bash
npm run dev
```

The API server will start on [http://localhost:3001](http://localhost:3001).

## API Endpoints

### Network Relationships
- `GET /api/network/[name]` - Get network relationships for a user by name

Example:
```bash
curl http://localhost:3001/api/network/user00001
```

## Database Setup

The API uses Prisma to connect to PostgreSQL. Make sure to run:

```bash
npx prisma generate
npx prisma db push
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
