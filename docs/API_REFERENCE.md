# Application interfaces

| Interface | Access | Request and outcome |
| --- | --- | --- |
| GET /fr or /en | Public | Localized storefront |
| GET /fr/menu or /en/menu | Public | Menu and cart interface |
| Menu slots server action | Public | Returns upcoming ISO timestamps |
| Menu submit server action | Public | UUID request key, locale, name, notes, pickup ISO timestamp, payment method and modifier lines. Returns order number and token or INVALID, MENU, SLOT, CONFLICT, METHOD or FAILED |
| GET /:lang/track/:token | Token bearer | Order number, pickup time and status |
| Staff login and logout actions | Email and password with PostgreSQL, or private demo password | Set or clear an HttpOnly session cookie. Sign-out revokes the Better Auth session |
| GET /:lang/staff | Staff session | Login prompt or latest 100 orders, with active orders first |
| Staff change action | Staff session | Order number, expected state and target transition or PAY |

Next.js server actions are internal interfaces. There are currently no webhooks or external APIs.
