# Architecture decisions

## 2026-11-17 · PostgreSQL in the demo and deployed design

Accepted for the first slice. Use PGlite with a local data directory for a portable demo and the PostgreSQL driver for Neon connectivity. A local server would add provisioning work and memory-only storage would lose orders. SQL lives in versioned files. Prisma and Better Auth remain planned and must be integrated before a production rollout. The demo driver is single-process and requires writable disk.
