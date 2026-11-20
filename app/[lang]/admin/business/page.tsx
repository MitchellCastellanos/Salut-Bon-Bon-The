import { notFound } from "next/navigation";
import { language } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";
import { pickupConfiguration } from "../../../../src/store-settings";
import { BlockerList } from "../blockers";
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
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const q = await searchParams;
  const error = typeof q.error === "string" ? errors[q.error] ?? [q.error, q.error] : undefined;
  const { profile, fiscal, blockers } = await pickupConfiguration();
  const pct = (rate: number) => String(rate / 1000);
  return <section className="wrap catalog-page">
    <h1>{fr ? "Commerce et fiscalité" : "Business and tax"}</h1>
    {blockers.length > 0 && <BlockerList lang={lang} blockers={blockers}/>}
    {q.saved && <p role="status" className="panel">{fr ? "Enregistré." : "Saved."}</p>}
    {error && <p role="alert" className="panel">{error[fr ? 0 : 1]}</p>}
    <form className="panel checkout" action={saveBusinessProfile.bind(null, lang)} aria-labelledby="profile">
      <h2 id="profile">{fr ? "Profil public du commerce" : "Public business profile"}</h2>
      <p>{fr ? "Ces renseignements alimentent le pied de page, la section « Nous trouver », les données structurées (SEO), les instructions de cueillette et les reçus." : "These details feed the footer, the “Find us” section, structured data (SEO), pickup instructions and receipts."}</p>
      <label>{fr ? "Nom affiché" : "Display name"}<input name="displayName" required maxLength={120} defaultValue={profile?.displayName}/></label>
      <label>{fr ? "Adresse (numéro et rue)" : "Street address"}<input name="street" required maxLength={160} defaultValue={profile?.street} autoComplete="off"/></label>
      <label>{fr ? "Ville" : "City"}<input name="city" required maxLength={80} defaultValue={profile?.city}/></label>
      <label>{fr ? "Province" : "Province"}<input name="province" required maxLength={40} defaultValue={profile?.province ?? "Québec"}/></label>
      <label>{fr ? "Code postal" : "Postal code"}<input name="postalCode" required maxLength={7} defaultValue={profile?.postalCode}/></label>
      <label>{fr ? "Pays" : "Country"}<input name="country" required maxLength={60} defaultValue={profile?.country ?? "Canada"}/></label>
      <label>{fr ? "Téléphone public" : "Public phone"}<input name="phone" required type="tel" maxLength={20} defaultValue={profile?.phone}/></label>
      <label>{fr ? "Identifiant Google Maps (facultatif)" : "Google Maps place ID (optional)"}<input name="googlePlaceId" maxLength={200} defaultValue={profile?.googlePlaceId}/></label>
      <label>{fr ? "Sources ou notes de vérification (facultatif)" : "Verification sources or notes (optional)"}<textarea name="note" rows={3} maxLength={600} defaultValue={profile?.verification.note}/></label>
      <label>{fr ? "Adresses des sources (une par ligne, facultatif)" : "Source URLs (one per line, optional)"}<textarea name="sources" rows={2} maxLength={800} defaultValue={profile?.verification.sources?.join("\n")}/></label>
      <label><input type="checkbox" name="confirmed" defaultChecked={profile?.verification.status === "verified"}/> {fr ? "Je confirme que ces renseignements sont exacts et publics. Les données structurées (SEO) ne sont publiées qu’une fois confirmés." : "I confirm these details are accurate and public. Structured data (SEO) is only published once confirmed."}</label>
      {profile && profile.verification.status !== "verified" && <p role="status">{fr ? "Non confirmé : ces renseignements s’affichent sur le site, mais pas dans les données structurées." : "Not confirmed: these details show on the site but not in structured data."}</p>}
      <button className="button">{fr ? "Enregistrer le profil" : "Save profile"}</button>
    </form>
    <form className="panel checkout" action={saveFiscalSettings.bind(null, lang)} aria-labelledby="fiscal">
      <h2 id="fiscal">{fr ? "Paramètres fiscaux (TPS / TVQ)" : "Tax settings (GST / QST)"}</h2>
      <p>{fr ? "Les taxes ne sont perçues que si le commerce est inscrit et que les deux numéros sont saisis. Laissez vides les numéros inconnus : rien n’est inventé et aucune taxe n’est perçue sans inscription." : "Tax is only collected when the business is registered and both numbers are entered. Leave unknown numbers blank: nothing is invented and no tax is collected without registration."}</p>
      <label>{fr ? "Statut fiscal" : "Tax status"}<select name="status" defaultValue={fiscal.status}>
        <option value="unconfigured">{fr ? "À déterminer (commande fermée)" : "Not decided (ordering closed)"}</option>
        <option value="registered">{fr ? "Inscrit : percevoir la TPS et la TVQ" : "Registered: collect GST and QST"}</option>
        <option value="not_registered">{fr ? "Non inscrit : ne percevoir aucune taxe" : "Not registered: collect no tax"}</option></select></label>
      <label>{fr ? "Dénomination sociale" : "Legal business name"}<input name="legalName" maxLength={160} defaultValue={fiscal.legalName}/></label>
      <label>{fr ? "Numéro de TPS" : "GST registration number"}<input name="gstNumber" maxLength={30} placeholder="123456789 RT 0001" defaultValue={fiscal.gstNumber}/></label>
      <label>{fr ? "Numéro de TVQ" : "QST registration number"}<input name="qstNumber" maxLength={30} placeholder="1234567890 TQ 0001" defaultValue={fiscal.qstNumber}/></label>
      <label>{fr ? "Taux de TPS (%)" : "GST rate (%)"}<input name="gstRate" inputMode="decimal" required defaultValue={pct(fiscal.gstRate)}/></label>
      <label>{fr ? "Taux de TVQ (%)" : "QST rate (%)"}<input name="qstRate" inputMode="decimal" required defaultValue={pct(fiscal.qstRate)}/></label>
      <label>{fr ? "Note sur les reçus (facultatif)" : "Receipt note (optional)"}<input name="receiptNote" maxLength={300} defaultValue={fiscal.receiptNote}/></label>
      <p className="fine-print">{fr ? "La TVQ est calculée sur le prix avant taxes, et non sur la TPS. Chaque taxe est arrondie au cent. Restauration : Revenu Québec impose des obligations de facturation (identification de l’établissement, numéro de facture, détail des articles, montants et numéros de TPS et de TVQ, et, pour les inscrits, un module d’enregistrement des ventes). Le reçu du site reprend ces renseignements, mais ne remplace pas ces obligations : confirmez-les avec votre comptable." : "QST is calculated on the pre-tax price, not on GST. Each tax is rounded to the cent. Restaurant sector: Revenu Québec imposes billing obligations (establishment identification, bill number, itemised lines, tax amounts and GST/QST numbers, and for registrants a sales recording system). The site receipt carries these details but does not replace those obligations: confirm them with your accountant."}</p>
      <button className="button">{fr ? "Enregistrer les paramètres fiscaux" : "Save tax settings"}</button>
    </form>
  </section>;
}
