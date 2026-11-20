import { adminPage } from "../guard";
import { LiveNote, Notice, PageHeader } from "../ui";
import { Submit } from "../submit";
import { pickupConfiguration } from "../../../../src/store-settings";
import { saveBusinessProfile, saveFiscalSettings } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

const errors: Record<string, [string, string]> = {
  displayName: ["Nom invalide.", "Invalid name."], street: ["Adresse invalide.", "Invalid street address."], city: ["Ville invalide.", "Invalid city."],
  province: ["Province invalide.", "Invalid province."], postalCode: ["Code postal canadien invalide (ex. H8S 2C5).", "Invalid Canadian postal code (e.g. H8S 2C5)."],
  country: ["Pays invalide.", "Invalid country."], phone: ["Téléphone invalide.", "Invalid phone number."],
  "fiscal.legalName": ["La dénomination sociale est obligatoire pour percevoir les taxes.", "A legal name is required to collect tax."],
  "fiscal.gstNumber": ["Numéro de TPS invalide ou manquant (format 123456789 RT 0001).", "GST number missing or invalid (format 123456789 RT 0001)."],
  "fiscal.qstNumber": ["Numéro de TVQ invalide ou manquant (format 1234567890 TQ 0001).", "QST number missing or invalid (format 1234567890 TQ 0001)."],
};

export default async function AdminBusiness({ params, searchParams }: PageProps<"/[lang]/admin/business">) {
  const lang = await adminPage((await params).lang);
  const q = await searchParams;
  const error = typeof q.error === "string" ? errors[q.error] ?? [q.error, q.error] : undefined;
  const { profile, fiscal } = await pickupConfiguration();
  const pct = (rate: number) => String(rate / 1000);
  return <section className="wrap">
    <PageHeader title="Business info and tax" intro="Your address, phone and tax numbers. They appear on the website, in search results and on customer receipts."/>
    <Notice saved={q.saved} saves={{ profile: "Business information saved. The website and receipts use it now.", fiscal: "Tax settings saved. Checkout uses them now." }} error={error ? "x" : undefined} errors={{ x: error?.[1] ?? "" }}/>
    <LiveNote/>
    <form className="admin-form" action={saveBusinessProfile.bind(null, lang)} aria-labelledby="profile">
      <h2 id="profile">Public business profile</h2>
      <p>These details feed the footer, the “Find us” section, structured data (SEO), pickup instructions and receipts.</p>
      <label>Display name<input name="displayName" required maxLength={120} defaultValue={profile?.displayName}/></label>
      <label>Street address<input name="street" required maxLength={160} defaultValue={profile?.street} autoComplete="off"/></label>
      <label>City<input name="city" required maxLength={80} defaultValue={profile?.city}/></label>
      <label>Province<input name="province" required maxLength={40} defaultValue={profile?.province ?? "Québec"}/></label>
      <label>Postal code<input name="postalCode" required maxLength={7} defaultValue={profile?.postalCode}/></label>
      <label>Country<input name="country" required maxLength={60} defaultValue={profile?.country ?? "Canada"}/></label>
      <label>Public phone<input name="phone" required type="tel" maxLength={20} defaultValue={profile?.phone}/></label>
      <label>Google Maps place ID (optional)<input name="googlePlaceId" maxLength={200} defaultValue={profile?.googlePlaceId}/></label>
      <label>Verification sources or notes (optional)<textarea name="note" rows={3} maxLength={600} defaultValue={profile?.verification.note}/></label>
      <label>Source URLs (one per line, optional)<textarea name="sources" rows={2} maxLength={800} defaultValue={profile?.verification.sources?.join("\n")}/></label>
      <label><input type="checkbox" name="confirmed" defaultChecked={profile?.verification.status === "verified"}/> I confirm these details are accurate and public. Structured data (SEO) is only published once confirmed.</label>
      {profile && profile.verification.status !== "verified" && <p role="status">Not confirmed: these details show on the site but not in structured data.</p>}
      <Submit>Save business information</Submit>
    </form>
    <form className="admin-form" action={saveFiscalSettings.bind(null, lang)} aria-labelledby="fiscal">
      <h2 id="fiscal">Tax settings (GST / QST)</h2>
      <p>Tax is only collected when the business is registered and both numbers are entered. Leave unknown numbers blank: nothing is invented and no tax is collected without registration.</p>
      <label>Tax status<select name="status" defaultValue={fiscal.status}>
        <option value="unconfigured">Not decided (ordering closed)</option>
        <option value="registered">Registered: collect GST and QST</option>
        <option value="not_registered">Not registered: collect no tax</option></select></label>
      <label>Legal business name<input name="legalName" maxLength={160} defaultValue={fiscal.legalName}/></label>
      <label>GST registration number<input name="gstNumber" maxLength={30} placeholder="123456789 RT 0001" defaultValue={fiscal.gstNumber}/></label>
      <label>QST registration number<input name="qstNumber" maxLength={30} placeholder="1234567890 TQ 0001" defaultValue={fiscal.qstNumber}/></label>
      <label>GST rate (%)<input name="gstRate" inputMode="decimal" required defaultValue={pct(fiscal.gstRate)}/></label>
      <label>QST rate (%)<input name="qstRate" inputMode="decimal" required defaultValue={pct(fiscal.qstRate)}/></label>
      <label>Receipt note (optional)<input name="receiptNote" maxLength={300} defaultValue={fiscal.receiptNote}/></label>
      <p className="fine-print">QST is calculated on the pre-tax price, not on GST. Each tax is rounded to the cent. Restaurant sector: Revenu Québec imposes billing obligations (establishment identification, bill number, itemised lines, tax amounts and GST/QST numbers, and for registrants a sales recording system). The site receipt carries these details but does not replace those obligations: confirm them with your accountant.</p>
      <Submit>Save tax settings</Submit>
    </form>
  </section>;
}
