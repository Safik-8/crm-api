# CRM API — Backend

> Express.js + Prisma + PostgreSQL

---

## Developer Onboarding (Fresh Setup)

Follow these steps exactly after pulling this repository for the first time.

### 1. Prerequisites

- Node.js >= 18
- PostgreSQL running locally (or a Supabase/Neon connection string)

### 2. Environment Variables

```bash
cp .env.example .env
```

Open `.env` and set your database connection strings:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/crm_db"
DIRECT_URL="postgresql://user:password@localhost:5432/crm_db"
JWT_SECRET="your-secret-key"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Migrations

```bash
npx prisma migrate deploy
```

> This applies all migration files in `prisma/migrations/` to your database.
> Never use `prisma db push` — it bypasses the migration history.

### 5. Run the Baseline Seed

```bash
npx prisma db seed
```

This seeds all required baseline data:

| # | What is seeded | Details |
|---|---|---|
| 1 | System Roles | SUPER_ADMIN, COMPANY_ADMIN, BRANCH_MANAGER, BDE, ISE |
| 2 | Super Admin User | `superadmin@gmail.com` / `superadmin123` |
| 3 | Default Company | StackDot (code: STACKDOT) |
| 4 | Default Branch | Headquarters (code: HQ-01) |
| 5 | Global Lead Statuses | New, Open, Duplicate, Closed |
| 6 | Global Lead Sources | Website, Walk-in, Referral, Google Ads, etc. |
| 7 | Lead Pipeline Stages | Prospect → Closure |
| 8 | Opportunity Stages | Qualification → Won / Lost / Cancelled |
| 9 | Win/Loss Reasons | 6 LOSS + 4 WIN default reasons |
| 10 | Qualification Criteria | 5 BANT criteria totalling 100 pts |

The seed is **fully idempotent** — running it multiple times is safe and will not duplicate data.

### 6. Start the Development Server

```bash
npm run dev
```

The server runs at `http://localhost:3000` by default.

---

## Reset Database (Development Only)

To fully wipe and re-seed your local database:

```bash
npx prisma migrate reset
```

This command:
1. Drops all tables
2. Re-applies all migrations
3. Automatically runs `npx prisma db seed`

> **Never run `migrate reset` in production or staging.**

---

## Login Credentials (After Seed)

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@gmail.com` | `superadmin123` |
| Company Admin | `admin@stackdot.in` | `password123` |
| Branch Manager | `manager@stackdot.in` | `password123` |
| BDE | `bde@stackdot.in` | `password123` |
| ISE | `ise@stackdot.in` | `password123` |

> The Company Admin, Branch Manager, BDE, and ISE accounts are only seeded
> when no company exists yet (first-time setup). Run `node create_dummy_data.js`
> after the seed to populate the full StackDot hierarchy.

---

## Useful Commands

```bash
npm run dev              # Start dev server with hot-reload (nodemon)
npm start                # Start production server
npx prisma studio        # Open Prisma Studio (database GUI)
npx prisma migrate dev   # Create a new migration from schema changes
npx prisma migrate deploy # Apply migrations (CI/staging/prod)
npx prisma db seed       # Run the baseline seed
node create_dummy_data.js # Seed demo company hierarchy + leads
```

---

## Project Structure

```
crm-api/
  prisma/
    schema.prisma       # Database schema (single source of truth)
    migrations/         # Migration history — never edit manually
    seed.js             # Baseline seed (idempotent, production-grade)
  src/
    config/
      initSystem.js     # Startup seeder — runs on every server start
      roleConstants.js  # Role names, ranks, module list
      db.js             # Prisma client singleton
    modules/            # Feature modules (lead, opportunity, qualification, ...)
    middleware/         # Auth, error handler, rate limiter
    utils/              # AppError, password utils, etc.
    index.js            # Express app entry point
```

---

## Architecture Notes

- **`initSystem.js`** runs on every server startup and syncs system roles,
  permissions, and qualification criteria for all active companies.
  It is safe to run on every boot — fully idempotent.

- **`seed.js`** is for developer onboarding and CI environments.
  It seeds the minimum baseline data required for the application to function.

- **Business data** (leads, opportunities, customers) is never seeded here.
  Use `create_dummy_data.js` for development/demo datasets.
