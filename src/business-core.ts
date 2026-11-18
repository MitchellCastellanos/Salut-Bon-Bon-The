// Pure business-profile and tax logic. Safe to import from client components (no database access).
import { z } from "zod";

/** Canadian postal code, normalised to "A1A 1A1". */
const postalCode = z.string().trim().toUpperCase().regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/)
  .transform(value => `${value.replace(/\s/g, "").slice(0, 3)} ${value.replace(/\s/g, "").slice(3)}`);

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(80),
  province: z.string().trim().min(2).max(40),
  postalCode,
  country: z.string().trim().min(2).max(60),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ().-]{6,19}$/),
  googlePlaceId: z.string().trim().max(200).optional(),
  /** Whether the owner has confirmed these details are correct and public. Structured data is only published once confirmed. */
  verification: z.object({
    status: z.enum(["unverified", "verified"]),
    note: z.string().trim().max(600).optional(),
    sources: z.array(z.url()).max(6).optional(),
  }).default({ status: "unverified" }),
});
export type BusinessProfile = z.infer<typeof profileSchema>;

/** Canadian GST/HST number "123456789 RT 0001" and Québec QST number "1234567890 TQ 0001". */
export const gstNumberPattern = /^\d{9}\s?RT\s?\d{4}$/i;
export const qstNumberPattern = /^\d{10}\s?TQ\s?\d{4}$/i;
export const defaultGstRate = 5000;   // 5 %, in thousandths of one percent
export const defaultQstRate = 9975;   // 9.975 %

export const fiscalSchema = z.object({
  /** unconfigured: checkout stays off. registered: GST and QST are collected. not_registered: no tax is collected. */
  status: z.enum(["unconfigured", "registered", "not_registered"]).default("unconfigured"),
  legalName: z.string().trim().max(160).optional(),
  gstNumber: z.string().trim().max(30).optional(),
  qstNumber: z.string().trim().max(30).optional(),
  gstRate: z.number().int().min(0).max(100000).default(defaultGstRate),
  qstRate: z.number().int().min(0).max(100000).default(defaultQstRate),
  receiptNote: z.string().trim().max(300).optional(),
}).superRefine((fiscal, ctx) => {
  const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (fiscal.gstNumber && !gstNumberPattern.test(fiscal.gstNumber)) bad("gstNumber", "GST number format is 123456789 RT 0001");
  if (fiscal.qstNumber && !qstNumberPattern.test(fiscal.qstNumber)) bad("qstNumber", "QST number format is 1234567890 TQ 0001");
  if (fiscal.status === "registered") {
    if (!fiscal.legalName) bad("legalName", "A legal name is required to collect tax");
    if (!fiscal.gstNumber) bad("gstNumber", "A GST registration number is required to collect tax");
    if (!fiscal.qstNumber) bad("qstNumber", "A QST registration number is required to collect tax");
  }
});
export type FiscalSettings = z.infer<typeof fiscalSchema>;
export const unconfiguredFiscal: FiscalSettings = fiscalSchema.parse({});

export type TaxLine = { code: "GST" | "QST"; rate: number; cents: number };

/** GST and QST are each rounded to the cent on the pre-tax subtotal (QST is not charged on GST). Only collected when registered. */
export function computeTax(subtotal: number, fiscal: FiscalSettings): { cents: number; lines: TaxLine[] } {
  if (fiscal.status !== "registered") return { cents: 0, lines: [] };
  const lines: TaxLine[] = [
    { code: "GST", rate: fiscal.gstRate, cents: Math.round(subtotal * fiscal.gstRate / 100000) },
    { code: "QST", rate: fiscal.qstRate, cents: Math.round(subtotal * fiscal.qstRate / 100000) },
  ];
  return { cents: lines.reduce((sum, line) => sum + line.cents, 0), lines };
}

export type BusinessSnapshot = {
  displayName: string; legalName?: string; street: string; city: string; province: string; postalCode: string; country: string;
  phone: string; taxStatus: FiscalSettings["status"]; gstNumber?: string; qstNumber?: string; receiptNote?: string;
};

export function businessSnapshot(profile: BusinessProfile, fiscal: FiscalSettings): BusinessSnapshot {
  const registered = fiscal.status === "registered";
  return {
    displayName: profile.displayName, legalName: fiscal.legalName || undefined, street: profile.street, city: profile.city,
    province: profile.province, postalCode: profile.postalCode, country: profile.country, phone: profile.phone,
    taxStatus: fiscal.status, gstNumber: registered ? fiscal.gstNumber : undefined, qstNumber: registered ? fiscal.qstNumber : undefined,
    receiptNote: fiscal.receiptNote || undefined,
  };
}

export const addressLine = (p: Pick<BusinessProfile, "street" | "city" | "province" | "postalCode">) => `${p.street}, ${p.city} (${p.province}) ${p.postalCode}`;
export const phoneHref = (phone: string) => `tel:${phone.startsWith("+") ? "+" : ""}${phone.replace(/\D/g, "")}`;
export const directionsHref = (p: Pick<BusinessProfile, "street" | "city" | "province" | "postalCode" | "country">) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.street}, ${p.city}, ${p.province} ${p.postalCode}, ${p.country}`)}`;

export const blockerCodes = ["FLAG_OFF", "NO_SCHEDULE", "NO_LEAD_TIME", "NO_CAPACITY", "NO_FISCAL_STATUS", "NO_PROFILE", "NO_PRICES"] as const;
export type Blocker = typeof blockerCodes[number];
