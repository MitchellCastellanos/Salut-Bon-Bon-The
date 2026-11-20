import Link from "next/link";
import { analyticsEnabled } from "../../../../src/analytics";
import { instantAccounts } from "../../../../src/account-email";
import { demoMode } from "../../../../src/demo-mode";
import { emailMode } from "../../../../src/notifications";
import { simulatedPayments, stripeMode } from "../../../../src/providers/stripe";
import { walletConfigured } from "../../../../src/wallet";
import { adminPage } from "../guard";
import { Badge, Notice, PageHeader } from "../ui";
import { Submit } from "../submit";
import { prepareDemo } from "../demo/actions";

export const metadata = { robots: { index: false, follow: false } };

type Row = { name: string; tone: "good" | "warn" | "bad" | "neutral"; status: string; what: string; next?: string; href?: string };

export default async function Integrations({ params, searchParams }: PageProps<"/[lang]/admin/integrations">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const stripe = stripeMode(), mail = emailMode(), demo = demoMode();
  const rows: Row[] = [
    { name: "Online card payments (Stripe)", tone: stripe === "live" ? "good" : stripe === "test" ? "warn" : simulatedPayments() ? "warn" : "bad",
      status: stripe === "live" ? "Live" : stripe === "test" ? "Test mode (no real money)" : simulatedPayments() ? "Simulated (no real money)" : "Not connected",
      what: stripe === "disabled" ? (simulatedPayments() ? "Customers pay on a practice page. Orders look real, but no card is charged and no money moves. Refunds are simulated too."
        : "Customers can only choose to pay at pickup.") : "Customers pay by card through Stripe Checkout; payments are confirmed by Stripe before an order can be confirmed.",
      next: stripe === "live" ? undefined : "Your web team adds the Stripe keys and webhook secret to the hosting settings. The owner must approve going live." },
    { name: "Email to customers (Resend)", tone: mail === "live" ? "good" : mail === "test" ? "warn" : "bad",
      status: mail === "live" ? "Live" : mail === "test" ? "Test mode (sent only to a test address)" : "Not connected",
      what: mail === "disabled" ? "Order and account messages are written to the log, but nothing is sent. Customers cannot receive verification or password-reset emails yet." : "Order messages and account emails are delivered.",
      next: mail === "live" ? undefined : "Your web team verifies your sending domain with Resend and adds the key. Until then, every message is recorded under Notifications.", href: "notifications" },
    { name: "Apple Wallet card", tone: walletConfigured() ? "good" : "bad", status: walletConfigured() ? "Configured (not yet verified on a real iPhone)" : "Not connected",
      what: walletConfigured() ? "Customers can add their loyalty card to Apple Wallet." : "Customers see their QR card on screen. “Add to Apple Wallet” appears once Apple credentials are added.",
      next: walletConfigured() ? "Install a pass on an iPhone and scan it at the counter to confirm." : "Needs an Apple Developer account and Pass Type ID certificate (kept in the hosting settings, never on this screen).", href: "wallet" },
    { name: "Visit measurement", tone: analyticsEnabled() ? "good" : "neutral", status: analyticsEnabled() ? "On" : "Off", what: "Counts page and cart activity for visitors who accept it. No personal data.", href: "reports" },
    { name: "Account sign-up without email", tone: instantAccounts() ? "bad" : "good", status: instantAccounts() ? "On (turn off before launch)" : "Off",
      what: instantAccounts() ? "Anyone can create an account with an address they do not own. Fine for a demo, not for real customers." : "Customers must confirm their email address." },
    { name: "Demo mode", tone: demo ? "warn" : "good", status: demo ? "On" : "Off", what: demo ? "Simulated payments, no real emails and automatic loyalty sign-up. Turn off before real customers use the site." : "The site behaves as a real store." },
  ];
  return <section className="wrap">
    <PageHeader title="Payments and integrations" intro="The outside services your store depends on, and whether each one is connected. Keys and certificates live in your hosting settings and are never shown or edited here."/>
    <Notice saved={query.saved} saves={{ demo: "Demo settings applied." }}/>
    <ul className="admin-list">{rows.map(row => <li key={row.name} className="admin-row">
      <div><h3>{row.name} <Badge tone={row.tone}>{row.status}</Badge></h3><p>{row.what}</p>{row.next && <p><strong>To connect:</strong> {row.next}</p>}</div>
      {row.href && <div className="admin-row-actions"><Link className="outline" href={`/${lang}/admin/${row.href}`}>Open</Link></div>}
    </li>)}</ul>
    {demo && <form action={prepareDemo.bind(null, lang)} className="admin-form"><h2>Demo store</h2>
      <p>One click opens the test store: Mon–Sat 10:30–20:00 pickup, 10 min preparation, 10 orders per time slot, tax status “not registered” (no tax), every priced drink offered and Salut Rewards 9+1 active with your authorization recorded. Prices are not changed. Nothing is charged or sent.</p>
      <div><Submit confirm="Apply the demo settings? This overwrites your hours, pickup limits, tax status and rewards activation.">Apply demo settings</Submit></div></form>}
  </section>;
}
