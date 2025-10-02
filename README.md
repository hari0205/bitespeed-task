# Identity Reconciliation System

A Node.js + TypeScript service for tracking and linking customer identities across multiple purchases.

## Project Structure

```
src/
├── controllers/     # Express route controllers
├── services/        # Business logic services
├── repositories/    # Data access layer
├── types/          # TypeScript type definitions
├── middleware/     # Express middleware
├── config/         # Configuration files
├── utils/          # Utility functions
└── test/           # Test utilities and setup
```

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   yarn install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

### Development

```bash
# Start development server with hot reload
yarn dev

# Run tests
yarn test

# Run tests with coverage
yarn test:coverage

# Lint code
yarn lint

# Format code
yarn format

# Type check
yarn typecheck
```

### Database

```bash
# Generate Prisma client
yarn db:generate

# Run database migrations
yarn db:migrate

# Open Prisma Studio
yarn db:studio
```

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+
- **Framework**: Express.js
- **Database**: SQLite (development)
- **ORM**: Prisma
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Logging**: Winston
