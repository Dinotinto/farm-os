# Deployment Flow

This project follows the same broad shape as `D:\dtinto-housefinder`.

## Local

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run dev`.

## Database

- Local development uses `prisma/schema.prisma` with SQLite.
- Production/UAT should use `prisma/schema.postgres.prisma` with PostgreSQL.
- Neon is the recommended UAT database because it gives a managed PostgreSQL URL that Vercel can use directly.

## Checks

Run:

```bash
npm run lint
npm run build:local
```

Production build uses:

```bash
npm run build
```

## UAT with Neon

1. Create `.env.uat` from `.env.uat.example`.
2. Put the Neon PostgreSQL URL in `DATABASE_URL`.
3. Run:

```bash
npm run uat:env
npm run uat:db:push
npm run uat:db:seed
npm run deploy:check
```

Then deploy to Vercel with `DATABASE_URL` set in the Vercel project.
