# Admin access and customer accounts (rehearsal guide)

## Getting into the Admin

Sign-in is at `/fr/staff` (or `/en/staff`). ADMIN users then reach `/fr/admin`. Three things must exist in the environment:

1. `DATABASE_URL` pointing at a migrated database (migrations 001–009).
2. `BETTER_AUTH_URL` (the exact browser origin, `https://…`, no trailing path), `BETTER_AUTH_SECRET` (random, 32+ characters) and `SITE_URL`. Without them the staff page says sign-in is unavailable.
3. A first ADMIN identity. Create it once from a trusted machine (the password is read from stdin and never stored in shell history):

```bash
read -rs ADMIN_PW   # type the password, 12+ characters
DATABASE_URL=<owner or app connection string> printf '%s' "$ADMIN_PW" | npm run staff:create -- ADMIN you@example.com "Your name"
```

From then on, ADMIN manages everyone else in **Admin → Team and access** (`/fr/admin/team`): create STAFF or ADMIN accounts, promote or demote, replace a password, or remove access. Rules enforced on the server: ADMIN only; the last remaining ADMIN can never be demoted or removed; you cannot change your own access; role changes, password replacement and removal end that person's sessions immediately; every change is written to the audit history.

The Admin home shows whether pickup ordering is open and, when it is closed, exactly what is missing (switch, schedule, lead time, capacity, fiscal status, profile, priced products) with a link to fix each item. Products also need **Offered** ticked in the price sheet before they can be ordered.

## Language policy: the admin is English only

**Owner decision (2026-11-19): the administration and staff console is in English.** The public website stays bilingual (French and English parity). Concretely:

- Everything under `/admin/*` and `/staff/*` renders in English. `proxy.ts` redirects `/fr/admin...` and `/fr/staff...` to `/en/...`, so old links, the footer "Staff area" link and rewards QR links keep working.
- New admin or staff screens must be written in English only: no `fr ? ... : ...` copy, no French strings. (The existing screens still contain the dormant French variants; they are never shown and can be removed gradually.)
- Customer-facing output generated from the console stays bilingual: customer emails, receipts, tracking pages, and the public pages the console edits.
- Tests drive the console through `/en/...` with English labels.

## Where everything is (ADMIN)

The administration and staff area (`/admin/*`, `/staff/*`) has its own frame: no public header or footer, a grouped sidebar that is always visible (drawer on phones), a **Back to the website** button, the signed-in name and role, and sign-out. STAFF see only Sales and the card scanner. The frame is `app/[lang]/console-shell.tsx`; the layout switches to it from the `x-salut-path` header set in `proxy.ts`.

`/fr/admin` is the dashboard: ordering status (with what is missing), sales for today and the last 7 days (online vs counter), and a card for each area. Every admin screen shares one navigation bar.

| To do this | Go to |
| --- | --- |
| Follow and advance orders, record payment at pickup | `/staff` (Orders) |
| Record an in-person sale (paid and completed, linked to a Rewards customer by code or email) | `/staff/counter` |
| Edit the menu: products, categories, toppings, images, collections | `/admin/catalog` |
| Set prices and what is offered | `/admin/prices` |
| Opening hours, closures, lead time, capacity | `/admin/hours` |
| Address, phone, GST/QST numbers, tax status | `/admin/business` |
| See customers, their points and orders | `/admin/customers` |
| Rewards rules, adjustments, refunds | `/admin/rewards` |
| Site activity | `/admin/analytics` |
| Homepage campaigns and quick pricing | `/admin/campaigns` |
| People with access | `/admin/team` |

STAFF can use `/staff`, `/staff/counter` and `/staff/rewards`; everything under `/admin` is ADMIN only.

### Counter sales
Prices, options and tax are computed on the server exactly like an online order; the sale is stored as `COUNTER`, already paid (cash, terminal or other) and completed, with the staff member recorded. It does not use pickup capacity or require the online-ordering switch, but it does need a chosen tax status. Naming a Rewards customer (member code or email) links the sale and earns points by the usual rule. Needs migration 010.

### Analytics
Set `SALUT_ANALYTICS_ENABLED=1` to collect first-party events. Only visitors who accept the analytics preference are measured and no personal data is stored. With it off, the page explains so instead of disappearing.

## Customer accounts without email

Customer registration normally needs email verification (Resend). With `SALUT_INSTANT_ACCOUNTS=1` new customers are created already verified and can sign in right away. It is honoured in every environment, **including production**, because the owner chose to show the customer journey before a mail provider exists. Trade-off: while it is on, anyone can register an address they do not own, and password-reset mail cannot be relied on. Remove the variable (and redeploy) as soon as Resend is configured. It was set in Vercel Production on 2026-11-19.

## Full rehearsal walkthrough

1. Admin: set the weekly hours, lead time and capacity (`/admin/hours`), the tax status (`/admin/business`), tick **Offered** and confirm prices (`/admin/prices`), then switch pickup ordering on.
2. Customer: `/fr/account` → create an account → sign in → order from the menu (the **Available for pickup** section appears once checkout is open) → the order shows under *My orders* and in the private tracking page.
3. Staff: sign in at `/fr/staff`, advance the order, record payment at pickup.
4. Admin: add a STAFF member in Team and access and confirm that person can use `/staff` but gets a 404 on `/admin`.

`node tests/instant-journey-smoke.mjs` automates steps 2–4 (see [Testing](TESTING.md)). Note that the public header's **Order** button points at the isolated order demonstration (`/fr/demo-commande`, see [Order and rewards demo](ORDER_REWARDS_DEMO.md)); real orders linked to accounts use the menu's pickup section.
