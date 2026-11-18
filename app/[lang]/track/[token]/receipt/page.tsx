import { notFound } from "next/navigation";
import { language, modifiers, money, pickupDate } from "../../../../../src/domain";
import { addressLine } from "../../../../../src/business-core";
import { receiptFor } from "../../../../../src/orders";

export const metadata = { robots: { index: false, follow: false } };

const taxName: Record<string, [string, string]> = { GST: ["TPS", "GST"], QST: ["TVQ", "QST"] };
const payment: Record<string, [string, string]> = {
  UNPAID: ["À payer à la cueillette", "To be paid at pickup"], PAID_AT_PICKUP: ["Payée à la cueillette", "Paid at pickup"], PAID_ONLINE: ["Payée en ligne", "Paid online"],
  DEMO_PAID: ["Paiement simulé", "Simulated payment"], PAYMENT_FAILED: ["Paiement échoué", "Payment failed"], REFUND_REQUIRED: ["Remboursement requis", "Refund required"],
};

/**
 * Customer bill built from the order's stored snapshot. It lists what Revenu Québec expects on a restaurant bill (trade and legal name,
 * establishment address, date, unique bill number, itemised lines, pre-tax subtotal, each tax with its registration number, total).
 * It does not replace a certified sales recording system where one is required.
 */
export default async function ReceiptPage({ params }: PageProps<"/[lang]/track/[token]/receipt">) {
  const { lang, token } = await params;
  if (!language(lang)) notFound();
  const receipt = await receiptFor(token);
  if (!receipt) notFound();
  const fr = lang === "fr";
  const biz = receipt.business_snapshot;
  const subtotal = receipt.total - receipt.tax_cents;
  const when = new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", dateStyle: "long", timeStyle: "short" }).format(new Date(receipt.created_at));
  return <div className="wrap section narrow receipt">
    <h1>{fr ? "Reçu" : "Receipt"}<span>.</span></h1>
    {biz ? <address className="business-address"><strong>{biz.displayName}</strong>{biz.legalName && biz.legalName !== biz.displayName ? <> ({biz.legalName})</> : null}<br/>{addressLine(biz)}<br/>{biz.phone}</address> :
      <p role="status">{fr ? "Les coordonnées du commerce n’étaient pas enregistrées lors de cette commande." : "The business details were not recorded when this order was placed."}</p>}
    <p>{fr ? "Facture n°" : "Bill no."} <strong>{receipt.number}</strong> · {when}<br/>{fr ? "Cueillette" : "Pickup"}: {pickupDate(new Date(receipt.pickup_at).toISOString(), lang)}</p>
    <table className="price-table"><thead><tr><th>{fr ? "Article" : "Item"}</th><th>{fr ? "Qté" : "Qty"}</th><th>{fr ? "Montant" : "Amount"}</th></tr></thead>
      <tbody>{receipt.items.map((item, i) => <tr key={i}><td>{item.name[lang]}{item.size ? ` · ${modifiers[item.size as "regular" | "large"]?.[lang] ?? item.size}` : ""}{item.selectedModifiers?.length ? ` (${item.selectedModifiers.map(m => m[lang]).join(", ")})` : ""}</td><td>{item.quantity}</td><td>{money(item.subtotal, lang)}</td></tr>)}</tbody>
      <tfoot>
        <tr><th colSpan={2} scope="row">{fr ? "Sous-total avant taxes" : "Subtotal before tax"}</th><td>{money(subtotal, lang)}</td></tr>
        {receipt.tax_breakdown?.map(line => <tr key={line.code}><th colSpan={2} scope="row">{taxName[line.code][fr ? 0 : 1]} ({line.rate / 1000} %){biz && (line.code === "GST" ? biz.gstNumber : biz.qstNumber) ? ` · ${fr ? "n°" : "no."} ${line.code === "GST" ? biz.gstNumber : biz.qstNumber}` : ""}</th><td>{money(line.cents, lang)}</td></tr>)}
        {!receipt.tax_breakdown?.length && <tr><th colSpan={2} scope="row">{fr ? "Taxes" : "Tax"}</th><td>{receipt.tax_cents ? money(receipt.tax_cents, lang) : fr ? "Aucune taxe perçue" : "No tax collected"}</td></tr>}
        <tr><th colSpan={2} scope="row">Total</th><td><strong>{money(receipt.total, lang)}</strong></td></tr>
      </tfoot></table>
    <p>{(payment[receipt.payment] ?? [receipt.payment, receipt.payment])[fr ? 0 : 1]}</p>
    {biz?.receiptNote && <p className="fine-print">{biz.receiptNote}</p>}
  </div>;
}
