# Technology stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, Zod, PGlite and pg provide the first vertical slice. Vitest runs domain and SQL tests. Node.js 24 is the current development runtime. Exact package versions are pinned in [package.json](../package.json) and integrity metadata is in [package-lock.json](../package-lock.json). Better Auth, Prisma, Stripe, Resend, Twilio and Playwright remain planned. Avoid splitting the product across deployables while one Next process and PostgreSQL support the workflow.
