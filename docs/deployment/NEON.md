# Setting Up Neon Serverless PostgreSQL

## 1. Project Creation
1. Create a free project at [neon.tech](https://neon.tech).
2. Create a database named `autotube`.
3. Copy the Connection String from the dashboard.

## 2. Formatting Connection String
Neon provides a connection string in standard `postgresql://...` format with `sslmode=require`.
AutoTube AI automatically translates this into the async format:
```
postgresql+asyncpg://<username>:<password>@<ep-xyz>.us-east-2.aws.neon.tech/autotube?ssl=require
```

## 3. Running Migrations
From your local machine or build step:
```bash
DATABASE_URL="postgresql+asyncpg://..." alembic upgrade head
```

## 4. Connection Pooling
Neon handles pooling via Neon-pooler or PgBouncer. AutoTube AI's async engine sets `pool_pre_ping=True`, `pool_recycle=180` (to smoothly handle compute auto-suspend), and configurable `DB_POOL_SIZE=5`.
