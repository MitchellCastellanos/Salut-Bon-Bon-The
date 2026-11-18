# Architecture decisions

## 2026-11-17 · PostgreSQL in the demo and deployed design

Accepted for the first slice. Use PGlite with a local data directory for a portable demo and the PostgreSQL driver for Neon connectivity. A local server would add provisioning work and memory-only storage would lose orders. SQL lives in versioned files. Prisma remains planned. See the staff authentication decision below. The demo driver is single-process and requires writable disk.

## 2026-11-17 · Individual staff sessions

Use Better Auth with the shared pg pool and versioned SQL. Keep credential provisioning operator-only and require STAFF or ADMIN for staff sessions and order operations. This retains the existing PostgreSQL deployment path and avoids adding an ORM just for authentication. The independent demo cookie remains available for the private credential-free workflow. Current roles are read with every staff authorization check so demotion takes effect for existing sessions. Both roles handle orders. Reserve store settings and other upcoming management operations for ADMIN.
