import { notFound } from "next/navigation";
import { language } from "../../../../src/domain";
import { verifyEmail } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

// Verification is a button, not a GET side effect, so mail scanners that prefetch links cannot consume the token.
export default async function Verify({ params, searchParams }: PageProps<"/[lang]/account/verify">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 8) notFound();
  return <section className="wrap section narrow"><h1>{fr ? "Confirmer mon courriel" : "Confirm my email"}<span>.</span></h1>
    <form className="panel checkout" action={verifyEmail.bind(null, lang)}>
      <input type="hidden" name="token" value={token}/>
      <p>{fr ? "Appuyez pour activer votre compte." : "Press to activate your account."}</p>
      <button className="button">{fr ? "Confirmer mon courriel" : "Confirm my email"}</button>
    </form></section>;
}
