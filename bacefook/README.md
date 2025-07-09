# Bacefook

A social network analytics platform for visualizing relationship networks, friendships, and referral chains.

## Overall Design

Bacefook is built as a **monorepo application** that provides network relationship visualization and analytics. The platform allows users to explore social connections through an interactive graph interface.

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js)     │◄──►│   (PostgreSQL)  │
│   Port 3000     │    │   Port 3001     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Features

- **Network Visualization**: Interactive D3.js graph showing user relationships
- **Relationship Types**: 
  - **Friendships**: Bidirectional social connections (green)
  - **Referrals**: Directional referral relationships (orange arrows)
- **User Search**: Find and visualize any user's network
- **Real-time Data**: Direct database integration for live relationship data

### Data Model

```mermaid
erDiagram
    Users ||--o{ Friendships : "user1/user2"
    Users ||--o{ Referrals : "referrer/referred"
    Users ||--o{ TransactionLog : "user"
    
    Users {
        int id PK
        string name
        timestamp created_at
        timestamp updated_at
    }
    
    Friendships {
        int id PK
        int user1_id FK
        int user2_id FK
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    Referrals {
        int id PK
        int referrer_id FK
        int referred_id FK
        timestamp created_at
    }
    
    TransactionLog {
        int id PK
        int user_id FK
        string transaction_type
        text transaction_data
        timestamp processed_at
    }
```

## Stack & Framework

### Monorepo Structure

- **[Turborepo](https://turborepo.com/)**: Monorepo build system for managing multiple apps and packages
- **TypeScript**: Full type safety across all applications
- **ESLint & Prettier**: Code quality and formatting

### Applications

#### Frontend (`apps/web`)

- **[Next.js 15](https://nextjs.org/)**: React framework with App Router
- **[React 19](https://react.dev/)**: UI library with latest features
- **[D3.js](https://d3js.org/)**: Data visualization library for interactive network graphs
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework

#### Backend (`apps/api`)

- **[Next.js 15](https://nextjs.org/)**: API routes for backend services
- **[Prisma ORM](https://prisma.io/)**: Type-safe database client and migration tool
- **Custom NetworkService**: Simplified ORM layer for network operations
- **CORS Support**: Cross-origin resource sharing for frontend integration

### Database & Infrastructure

- **[PostgreSQL](https://postgresql.org/)**: Primary database for storing user relationships
- **[Docker Compose](https://docs.docker.com/compose/)**: Container orchestration for development
- **Environment Configuration**: Secure database connection management

### Development Tools

- **[Jest](https://jestjs.io/)**: Testing framework with TypeScript support
- **Test Coverage**: Unit tests for database, service layer, and API endpoints
- **Hot Reload**: Development servers with live code updates

### Shared Packages

- **`@repo/ui`**: Shared React components
- **`@repo/eslint-config`**: Shared ESLint configurations
- **`@repo/typescript-config`**: Shared TypeScript configurations

## How to Run

### Prerequisites

- docker
- node v18+

### Run on local
<!-- TODO: Add installation steps -->


### Testing
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
bacefook/
├── apps/
│   ├── api/                    # Backend API service
│   │   ├── app/api/network/    # Network relationship endpoints
│   │   ├── lib/                # Database and service layer
│   │   └── __tests__/          # API tests
│   └── web/                    # Frontend application
│       ├── app/network/        # Network visualization page
│       └── components/         # Shared UI components
├── packages/
│   ├── eslint-config/          # Shared ESLint configurations
│   ├── typescript-config/      # Shared TypeScript configurations
│   └── ui/                     # Shared React components
└── docker-compose.yml          # Development environment setup
```

## API Endpoints

### Network API
- **GET** `/api/network/[name]` - Retrieve user network data including friends and referrals
- **OPTIONS** `/api/network/[name]` - CORS preflight handling

### Response Format
```json
{
  "user": {
    "id": 1,
    "name": "user1",
    "createdAt": "2023-01-01T00:00:00.000Z"
  },
  "friends": [
    {
      "id": 2,
      "name": "friend1", 
      "status": "ACTIVE",
      "createdAt": "2023-01-02T00:00:00.000Z"
    }
  ],
  "referrals": {
    "given": [
      {
        "id": 3,
        "name": "referred1",
        "referredAt": "2023-01-03T00:00:00.000Z"
      }
    ],
    "received": [
      {
        "id": 4,
        "name": "referrer1", 
        "referredAt": "2023-01-04T00:00:00.000Z"
      }
    ]
  }
}
```
