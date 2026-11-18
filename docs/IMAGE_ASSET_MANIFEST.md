# Storefront image asset manifest

The approved mockup is the design reference. All paths below are relative to the repository root. Current photos and banner artwork are placeholders. Add approved files before rebuilding, and check desktop and phone crops. Product imagery depicts the demo menu until the owner confirms the catalog. Drawings for the seven category tiles and utility icons live inline. Waves and background colors are CSS.

## Campaign photography · P0

Full-width at desktop, with HTML titles and buttons over the left side. On phones the copy is above the image and the crop shifts right. Keep the subjects within the right half with generous top, bottom, and right clearance. Use clean, pale negative space in the left 40% of each image. Current fallback is a coordinating color stage and CSS cups. Use owner-approved campaign copy and drinks before public launch.

| Path | Component and purpose | Source and subject |
| --- | --- | --- |
| `public/drinks/hero.webp` | Homepage carousel, opening mango campaign | 8:3 landscape, 2400 × 900. Group the official mango coconut, mango slush, and mango lychee specialties at right. Prompt updated in Batch 1. Image pending. |
| `public/promotions/strawberry.webp` | Homepage carousel, strawberry campaign | 8:3 landscape, 2400 × 900. Pink iced fruit tea and strawberries at right. |
| `public/promotions/taro.webp` | Homepage carousel, taro campaign | 8:3 landscape, 2400 × 900. Creamy lavender taro drinks at right. |

## Featured drinks and menu · P1

All five use the same centered, near-square landscape source, 20:19 at 1200 × 1140. Keep the cup and straw clear of the top and bottom to accommodate the wider menu cards. Names and demo CAD prices are rendered below the photos. Current fallback is the tinted CSS cup illustration. Replace concept art with representative, owner-approved imagery once the drinks are confirmed.

| Path | Component and subject |
| --- | --- |
| `public/drinks/classic.webp` | Featured card and menu. Brown sugar milk tea on oat. |
| `public/drinks/matcha.webp` | Featured card and menu. Matcha milk tea on pale green. |
| `public/drinks/taro.webp` | Featured card and menu. Creamy taro milk tea on lilac. |
| `public/drinks/mango.webp` | Featured card and menu. Mango fruit tea on pale yellow. |
| `public/drinks/strawberry.webp` | Featured card and menu. Pink strawberry fruit tea on blush. |

## Promotional banners · P1

Artwork sits in a bounded column beside HTML copy. Keep silhouettes centered and use transparent WebP backgrounds so the cards supply their own peach or lavender color. These illustrations can be generated.

| Path | Component, size and placeholder |
| --- | --- |
| `public/promotions/pickup.webp` | Order Online and Pick Up In Store. 4:5 portrait, 720 × 900. Hand and centered phone with a bag pictogram. CSS phone and bag icon fallback. |
| `public/promotions/rewards.webp` | Récompenses Salut / Salut Rewards. 1:1, 780 × 780. Tilted rewards card with simple stars and gift icon. CSS card fallback. |

## Instagram gallery · P2

The horizontal gallery uses centered 31:20 landscape crops, 930 × 600. Images have no overlays. Current fallback reuses each matching product slot. Use as demo editorial photography until verified social photos are available. This gallery is locally curated. `INSTAGRAM_URL` links to an approved profile when configured.

| Path | Subject in display order |
| --- | --- |
| `public/gallery/matcha.webp` | Iced matcha milk tea |
| `public/gallery/mango.webp` | Golden mango fruit tea |
| `public/gallery/strawberry.webp` | Strawberry fruit tea |
| `public/gallery/classic.webp` | Brown sugar milk tea |
| `public/gallery/taro.webp` | Lavender taro milk tea |

## Owner-supplied

- `public/brand/logo.svg` is wired in the header and footer. Supply the official logo in its original proportions with clear space. The footer uses a light treatment. The supplied chat image served as a visual reference, and a deployable SVG was unavailable. Live text is the fallback.
- `public/store/exterior.webp` remains a future slot for a real storefront photograph. No current component reads this path. A 3:2 landscape photo is suggested if a store section later uses one.

Generate in the order in [Batch 1](image-prompts/BATCH-01.md), [Batch 2](image-prompts/BATCH-02.md), and [Batch 3](image-prompts/BATCH-03.md). The separate skill archive could not be located. The batches follow the complete format in the redesign brief.

## Official collection imagery

| Path | Purpose | Dimensions | Status | Batch | Replaces placeholder |
| --- | --- | --- | --- | --- | --- |
| `public/catalog/MANGO-01.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 4 | Empty image slot |
| `public/catalog/MANGO-02.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 4 | Empty image slot |
| `public/catalog/MANGO-03.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 4 | Empty image slot |
| `public/catalog/MANGO-04.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 4 | Empty image slot |
| `public/catalog/MANGO-05.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 4 | Empty image slot |
| `public/catalog/BRULEE-01.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 5 | Empty image slot |
| `public/catalog/BRULEE-02.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 5 | Empty image slot |
| `public/catalog/BRULEE-03.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 5 | Empty image slot |
| `public/catalog/BRULEE-04.webp` | Specialty product card | 1200 × 1140 | Prompt ready, image pending | 5 | Empty image slot |
| `public/promotions/creme-brulee.webp` | Collection banner | 2400 × 900 | Prompt ready, image pending | 5 | Empty image slot |
| `public/promotions/house-lemonade.webp` | Collection banner | 2400 × 900 | Prompt ready, image pending | 5 | Empty image slot |

## Asset register (audit 2026-11-18)

The machine-readable register is [`image-manifest.json`](image-manifest.json) (id, batch, file, association, placement, aspect ratio, size, FR/EN alt text, generation and integration status). Run `npm run assets:check` to list what is still missing.

Status: **0 of 30 files exist** (27 originally plus the 3 rewards and account images of BATCH-06). There is no `public/` directory yet, so every slot renders its CSS or SVG fallback (`hasPublicImage` guards each one, and layouts do not shift). All 29 generated images have finished prompts in `docs/image-prompts/BATCH-01.md` to `BATCH-06.md`, written to be run one image at a time. Nothing was substituted or fabricated.

- Launch-critical for the approved campaigns: `hero.webp`, `creme-brulee.webp`, `house-lemonade.webp` (BATCH-01 image 1, BATCH-05 images 5–6) and the nine product photos in BATCH-04 and BATCH-05 images 1–4.
- Not launch-critical: BATCH-01 demo drinks, BATCH-02, BATCH-03 gallery. Do not publish demo drinks as the real menu.
- `public/brand/logo.svg` must be supplied by the owner. No prompt was written because a generated logo would misrepresent the brand.
- The house-lemonade poster prompt matches the collection exactly (701, 702, 704, 706, pineapple lemonade, 707); the pineapple lemonade has no product photo of its own and none was invented.
- Drop-in rule: save each file at its exact path, run `npm run assets:check`, then `npm run build`. Images are decorative next to visible product names, so they ship with empty `alt`; the register's alt text is for any future standalone use.

### Rewards and account imagery (BATCH-06, added for Récompenses Salut)

| Path | Placement | Notes |
| --- | --- | --- |
| `public/rewards/campaign-banner.webp` | Header of `/account/rewards` and the signed-out `/account` | 8:3, clean left 40% for HTML copy. |
| `public/rewards/card-background.webp` | Background layer of the loyalty QR card | 4:5, low-contrast centre so the QR stays scannable. |
| `public/account/welcome.webp` | Side image on the signed-out `/account` | 4:3. |

Existing coverage reviewed and kept: mango, crème brûlée and lemonade campaigns (BATCH-01, 04, 05) and the generic rewards tile `public/promotions/rewards.webp` (BATCH-02, a rewards card with a gift motif, not a gift-card product).

**Logo policy.** Product photography stays logo-free. The official logo is always a separate HTML/CSS layer (`src/brand.tsx`, `src/brand-server.ts`): header, footer, account pages, rewards and QR card, checkout surfaces and transactional emails. Until the owner supplies `public/brand/logo.svg` the site shows the typographic wordmark; emails need a PNG export at `public/brand/logo-email.png` (email clients reject SVG); `public/brand/logo.svg` also becomes the favicon and the social preview automatically. Never embed a logo inside AI-generated photography.
