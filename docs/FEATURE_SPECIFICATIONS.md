# Feature specifications

- Homepage features three swipable hero slides with labeled buttons and demo drinks.
- Menu filters fruit and milk teas. A drink can have regular or large size, sugar and ice settings, a product-specific topping and up to ten units per line. Cart permits 20 lines.
- Checkout offers quarter-hour demo slots and checks lead time. Business hours, pause, taxes and capacity rules are pending. Simulated payment labels state that there is no charge.
- Status moves from received through confirmed, preparing, ready and completed. Staff can cancel eligible active orders. Completion requires recorded pickup payment or demo settlement. Cancellation does not process a refund.
- A tracking link can be copied or bookmarked. It reveals order status, number and pickup only.
- Staff and tracking refresh on a five-second interval. The queue combines active and recent closed orders. The private local demo uses a shared sign-in. With PostgreSQL configured, individual STAFF and ADMIN accounts can view and update orders.

## Approved storefront design

- Cream and chocolate framing, mango-first full-width promotions, orange ordering CTAs, pastel category tiles, and organic CSS transitions follow the approved reference. The campaign carousel supports arrows, dots and swipe, with no autoplay. Campaign copy is HTML and can be moved to admin-managed content later.
- Menu tiles link to existing filters where supported. Smoothies, house lemonades and jellies are labeled previews. The popping pearl tile links to fruit teas that support the topping. Five favorites show sample CAD pricing. Matcha milk tea is a demo addition.
- Récompenses Salut / Salut Rewards are the approved full program names. The home banner and account affordance show a coming-soon state. Customer authentication, earning and redemption are future work.
- Instagram is a local gallery, with the verified profile link coming from INSTAGRAM_URL. Business hours and address remain placeholders. The official logo slot and all replaceable art paths are in the [manifest](IMAGE_ASSET_MANIFEST.md).
