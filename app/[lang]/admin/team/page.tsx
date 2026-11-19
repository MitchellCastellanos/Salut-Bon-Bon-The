import Link from "next/link";
import { notFound } from "next/navigation";
import { language, pickupDate } from "../../../../src/domain";
import { staffActor, staffRole } from "../../../../src/staff";
import { listTeam } from "../../../../src/team";
import { addMember, removeMember, resetPassword, setRole } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

const messages: Record<string, [string, string]> = {
  created: ["Compte créé.", "Account created."], role: ["Rôle modifié.", "Role changed."],
  revoked: ["Accès retiré.", "Access removed."], password: ["Mot de passe remplacé. Les sessions de cette personne ont été fermées.", "Password replaced. This person’s sessions were closed."],
  invalid: ["Vérifiez le formulaire. Le mot de passe doit contenir au moins 12 caractères.", "Check the form. The password needs at least 12 characters."],
  exists: ["Un compte existe déjà pour ce courriel.", "An account already exists for this email."],
  last_admin: ["Il doit toujours rester au moins un administrateur.", "At least one administrator must always remain."],
  self: ["Vous ne pouvez pas modifier votre propre accès.", "You cannot change your own access."],
  not_found: ["Compte introuvable.", "Account not found."],
};

export default async function AdminTeam({ params, searchParams }: PageProps<"/[lang]/admin/team">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const query = await searchParams;
  const flag = (key: string) => typeof query[key] === "string" ? messages[query[key] as string] : undefined;
  const [team, me] = await Promise.all([listTeam(), staffActor()]);
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/admin`}>{fr ? "Administration" : "Administration"}</Link>
    <h1>{fr ? "Équipe et accès" : "Team and access"}</h1>
    <p>{fr ? "L’équipe (STAFF) gère les commandes et le comptoir de récompenses. L’administration (ADMIN) gère aussi le catalogue, les prix, les heures, la fiscalité et les récompenses." : "Staff (STAFF) handle orders and the rewards counter. Administrators (ADMIN) also manage the catalog, prices, hours, tax and rewards."}</p>
    {flag("saved") && <p role="status" className="panel">{flag("saved")![fr ? 0 : 1]}</p>}
    {flag("error") && <p role="alert" className="panel">{flag("error")![fr ? 0 : 1]}</p>}
    <div className="order-grid">{team.map(member => <article className="panel" key={member.id}>
      <h2>{member.name}{member.id === me && <small> ({fr ? "vous" : "you"})</small>}</h2>
      <p>{member.email} · <strong className="pill">{member.role === "ADMIN" ? "ADMIN" : "STAFF"}</strong></p>
      <small>{fr ? "Créé le" : "Created"} {pickupDate(new Date(member.created_at).toISOString(), lang)}</small>
      {member.id !== me && <>
        <form action={setRole.bind(null, lang)} className="filters"><input type="hidden" name="id" value={member.id}/>
          <button className="outline" name="role" value={member.role === "ADMIN" ? "STAFF" : "ADMIN"}>{member.role === "ADMIN" ? (fr ? "Rendre STAFF" : "Make STAFF") : (fr ? "Rendre ADMIN" : "Make ADMIN")}</button></form>
        <form action={resetPassword.bind(null, lang)} className="filters"><input type="hidden" name="id" value={member.id}/>
          <label>{fr ? "Nouveau mot de passe" : "New password"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
          <button className="outline">{fr ? "Remplacer" : "Replace"}</button></form>
        <form action={removeMember.bind(null, lang)}><input type="hidden" name="id" value={member.id}/>
          <button className="outline">{fr ? "Retirer l’accès" : "Remove access"}</button></form>
      </>}
    </article>)}</div>
    <form className="panel checkout" action={addMember.bind(null, lang)} aria-labelledby="add-title">
      <h2 id="add-title">{fr ? "Ajouter une personne" : "Add a person"}</h2>
      <label>{fr ? "Nom" : "Name"}<input name="name" required maxLength={80} autoComplete="off"/></label>
      <label>{fr ? "Courriel" : "Email"}<input name="email" type="email" required maxLength={254} autoComplete="off"/></label>
      <label>{fr ? "Rôle" : "Role"}<select name="role" defaultValue="STAFF"><option value="STAFF">STAFF</option><option value="ADMIN">ADMIN</option></select></label>
      <label>{fr ? "Mot de passe initial (12 caractères minimum)" : "Initial password (12 characters minimum)"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
      <button className="button">{fr ? "Créer le compte" : "Create account"}</button>
    </form>
  </section>;
}
