# Client pricing and customization — 2026-11-18

Source: two client photos supplied in conversation (in-store menu and handwritten prices). All CAD before taxes.

| Category | Regular price |
| --- | ---: |
| Milk bubble tea | $5.99 |
| Fruit tea | $5.99 |
| Smoothies | $7.99 |
| Fresh Mango Series | $7.99 |
| Crème Brûlée | $8.99 |
| House lemonade | $5.99 |

**Not confirmed:** Matcha pricing, large-size price differential, and whether every beverage supports every topping. Do not invent these.

**Client rule:** One tapioca serving included at no charge; every additional topping $1.00. Available photographed options include popping pearls (tapioca, cherry, strawberry, passion fruit, lychee, dragon fruit, mango, green apple, peach, brown sugar boba, coconut, kiwi) and jellies (rainbow, mango, lychee, aloe vera, coconut, green apple). Existing product modifier assignments must be reviewed to ensure all advertised choices are available, and a second tapioca serving must be chargeable rather than a second free serving.

The display-price fallback is updated in src/catalog-display-prices.ts. For DB-backed storefronts the SQL in db/manual-client-prices-2026-11-18.sql must be applied to the correct database after review; this commit does NOT apply it automatically. It updates regular variants and already-assigned modifiers only. Existing large variants, missing modifier assignments, and the full one-free-serving/extra-serving rule require follow-up work before declaring checkout complete.

The actual menu component in app/[lang]/menu/menu.tsx already renders **Customize** / **Personnaliser**, not Customer. If Customer is still visible, trace the other component, cached deployment, or translation source before changing text blindly.

**QA before merge:** verify displayed prices, variant sizes, default free tapioca, multiple extras at +$1 each, client-side total, server-side quote, cart, checkout, receipts, rewards, EN/FR, and mobile.
