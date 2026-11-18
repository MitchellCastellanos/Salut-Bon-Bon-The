import { addressLine, directionsHref, phoneHref, type BusinessProfile } from "./business-core";
import { days, type PickupPolicy } from "./pickup-policy";

const dayLabel: Record<string, [string, string]> = { Mon: ["Lundi", "Monday"], Tue: ["Mardi", "Tuesday"], Wed: ["Mercredi", "Wednesday"], Thu: ["Jeudi", "Thursday"], Fri: ["Vendredi", "Friday"], Sat: ["Samedi", "Saturday"], Sun: ["Dimanche", "Sunday"] };

export function HoursList({ lang, policy, short = false }: { lang: "fr" | "en"; policy: PickupPolicy; short?: boolean }) {
  const fr = lang === "fr";
  return <ul className="footer-hours">{days.map(day => <li key={day}><span>{short ? dayLabel[day][fr ? 0 : 1].slice(0, 3) : dayLabel[day][fr ? 0 : 1]}</span> {policy.hours[day]?.length ? policy.hours[day]!.map(([a, b]) => `${a}–${b}`).join(", ") : (fr ? "Fermé" : "Closed")}</li>)}</ul>;
}

export function AddressBlock({ lang, profile }: { lang: "fr" | "en"; profile: BusinessProfile }) {
  const fr = lang === "fr";
  return <address className="business-address">
    <strong>{profile.displayName}</strong><br/>{profile.street}<br/>{profile.city} ({profile.province}) {profile.postalCode}<br/>
    <a href={phoneHref(profile.phone)}>{profile.phone}</a><br/>
    <a href={directionsHref(profile)} rel="noopener noreferrer" target="_blank">{fr ? "Itinéraire" : "Directions"}</a>
  </address>;
}

/** schema.org structured data from the persisted profile. Only published once the owner confirmed the details. No invented fields. */
export function businessJsonLd(profile: BusinessProfile | null, policy: PickupPolicy | null, site: string | undefined) {
  if (!profile || profile.verification.status !== "verified") return null;
  const dayName: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
  const hours = policy ? days.flatMap(day => (policy.hours[day] ?? []).map(([opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dayName[day], opens, closes }))) : [];
  const data = {
    "@context": "https://schema.org", "@type": "FoodEstablishment", name: profile.displayName, telephone: profile.phone,
    ...(site ? { url: site } : {}),
    address: { "@type": "PostalAddress", streetAddress: profile.street, addressLocality: profile.city, addressRegion: profile.province, postalCode: profile.postalCode, addressCountry: profile.country },
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function PickupInstructions({ lang, profile }: { lang: "fr" | "en"; profile: Pick<BusinessProfile, "displayName" | "street" | "city" | "province" | "postalCode" | "phone"> }) {
  const fr = lang === "fr";
  return <p className="fine-print">{fr ? "Cueillette en magasin : " : "In-store pickup: "}<strong>{profile.displayName}</strong>, {addressLine(profile)}. {fr ? "Heures de Montréal. Téléphone : " : "Montréal time. Phone: "}<a href={phoneHref(profile.phone)}>{profile.phone}</a></p>;
}
