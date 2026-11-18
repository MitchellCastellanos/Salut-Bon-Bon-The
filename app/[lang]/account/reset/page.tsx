import { notFound } from "next/navigation";
import { language } from "../../../../src/domain";
import { resetPassword } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function Reset({ params, searchParams }: PageProps<"/[lang]/account/reset">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const { token, error } = await searchParams;
  if (typeof token !== "string" || token.length < 8) notFound();
  return <section className="wrap section narrow"><h1>{fr ? "Nouveau mot de passe" : "New password"}<span>.</span></h1>
    {error && <p role="alert" className="panel">{fr ? "Ce lien est invalide ou expiré, ou le mot de passe est trop court (12 caractères minimum)." : "This link is invalid or expired, or the password is too short (12 characters minimum)."}</p>}
    <form className="panel checkout" action={resetPassword.bind(null, lang)}>
      <input type="hidden" name="token" value={token}/>
      <label>{fr ? "Nouveau mot de passe" : "New password"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
      <button className="button">{fr ? "Enregistrer" : "Save"}</button>
    </form></section>;
}
