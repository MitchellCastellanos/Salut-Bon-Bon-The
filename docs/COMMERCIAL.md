# Commercial packages and positioning

Owner of the product: Gaban Solutions. Currency: CAD. Decision baseline: **2026-11-20**.

Prices below are **proposed launch prices, not yet accepted by the client**. Do not publish them as commitments. Contract terms (deliverables, recurring costs, payment fees, messaging allowances, support, Apple Developer account ownership, privacy/consent, timeline) belong in the signed proposal and must never be invented here. What is actually built is tracked only in [PROJECT_STATUS.md](PROJECT_STATUS.md); this file describes what is *sold*.

## Packages

| Feature | Essential | **Plus (recommended)** | Premium |
| --- | :-: | :-: | :-: |
| Launch price (setup) | $1,799 | **$3,199** | $4,999 |
| Reference regular price | $2,499 | $4,499 | $6,999 |
| Proposed maintenance / month | $49 | $79 | $129 |
| Bilingual FR/EN site | Yes | Yes | Yes |
| Menu with photos | Yes | Yes | Yes |
| Drink customization | Yes | Yes | Yes |
| Cart and pickup orders | Yes | Yes | Yes |
| Pay at pickup | Yes | Yes | Yes |
| Order management | Yes | Yes | Yes |
| Basic SEO | Yes | Yes | Yes |
| Stripe online payments | – | Yes | Yes |
| Customer accounts | – | Yes | Yes |
| Order history and favorites | – | Yes | Yes |
| Salut Rewards 9+1 | – | Yes | Yes |
| Digital loyalty card with QR | – | Yes | Yes |
| Apple Wallet | – | Yes | Yes |
| Automated notifications | – | Yes | Yes |
| Basic analytics | – | Yes | Yes |
| Referrals and birthday promotions | – | – | Yes |
| Advanced analytics | – | – | Yes |
| Scheduled campaigns | – | – | Yes |
| Promo codes | – | – | Yes |
| Gift cards | – | – | Yes |

The "reference regular price" row comes from the owner-side scope note of 2026-11-20 and is not part of the later package table supplied for this audit; confirm it before quoting.

- **Inheritance:** Premium includes Plus; Plus includes Essential.
- **Plus owner administration is part of the package.** Every function Plus promises must be operable by the owner without a developer (see the admin checklist in [PRODUCT_SPEC.md](PRODUCT_SPEC.md#admin-requirements-for-salut-plus)). A broad admin redesign is a separate, later phase.
- **Apple Wallet is included in Plus**, not a Premium add-on. Google Wallet is not promised.
- Sold scope is not a claim of delivery. A static preview is not an integration. Existing code may exceed a lower package for preview purposes; enforcing package entitlements in code is a separate product decision (none exists today).

## Plus positioning

Salut Plus: *Turn every order into a returning customer.* Online ordering and payment, a personalized 9+1 digital loyalty card with QR, and an Apple Wallet pass for easy in-store identification. Plus is the immediate development target.

## Loyalty offer (decision)

The program is **9 eligible drinks purchased, the 10th free** ("option A"), chosen by the owner on 2026-11-19 and implemented by migration 011. The earlier option B (10 points per $1, 1,000 points = $5) is superseded and survives only in the archive: [proposal](archive/LOYALTY_PROPOSAL_2026-11-18.md), [points-era notes](archive/REWARDS_POINTS_ERA_2026-11-18.md). Rules still awaiting owner approval are listed in [PROJECT_STATUS.md](PROJECT_STATUS.md#decisions-the-owner-must-make).

## Premium scope (not to be built during Plus)

- Sales analytics and exports depend on settled payment and refund records; add period aggregates and retention reporting.
- Referral campaigns need codes, attribution, first-purchase qualification and abuse controls.
- Marketing automation needs campaign schedules, promotion rules, segmentation, consent and delivery reports. Promo codes belong here.
- Gift cards need issuance, unique codes, a transactional balance ledger, refund and partial-redemption rules. There are no gift-card tables or code today.
- Birthday promotions need a collected birthday and consent.

## Marketing content

Fresh Mango Series leads the homepage; Crème Brûlée, House Lemonade and Explore Our Menu have bilingual landing pages. The import seeds the four campaigns active with no end date and ADMIN controls publication, order and dates (`/admin/campaigns`). No promotion dates or discounts have been approved. Suggested sequence: Fresh Mango Series, then Crème Brûlée and House Lemonade features, with Explore Our Menu year-round, coordinated with verified availability, approved images, bilingual copy and working links.

Optional first-party analytics is off by default and records only event names, campaign ids and timestamps for opted-in browsers.

Category introductions awaiting owner review:

| Category | Français canadien | Canadian English |
| --- | --- | --- |
| Bubble thé au lait | Retrouvez les classiques, du taro au litchi. | Explore milk tea classics, from taro to lychee. |
| Thé aux fruits | Faites le plein de saveurs fruitées, de la mangue au pamplemousse rouge. | Explore fruit-forward flavours, from mango to ruby red grapefruit. |
| Matcha | Découvrez le matcha au lait, à l’avoine ou frappé. | Explore milk tea, oat milk and frappé takes on matcha. |
| Smoothies | Choisissez une saveur fruitée ou essayez le smoothie à l’avocat. | Pick a fruit blend or try the avocado smoothie. |
| Limonade maison | Découvrez nos limonades, de la pêche à la framboise bleue. | Explore our lemonades, from peach to blue raspberry. |

Social drafts: « La fraîcheur de la mangue, à chaque gorgée. Découvrez les cinq boissons de la Série Mangue Fraîche. » / “A fresh taste of mango in every sip. Explore all five drinks in the Fresh Mango Series.”

## Activation constraints

Live payments, customer messaging, loyalty activation and any production migration each need separate authorization, tested provider credentials, owner consent and launch readiness. Apple Wallet needs Apple-issued signing credentials and a working issuance/update service, and must not be promised until verified on a real iPhone.
