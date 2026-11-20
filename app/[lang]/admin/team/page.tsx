import { pickupDate } from "../../../../src/domain";
import { staffActor } from "../../../../src/staff";
import { listTeam } from "../../../../src/team";
import { adminPage } from "../guard";
import { Badge, Notice, PageHeader } from "../ui";
import { Submit } from "../submit";
import { addMember, removeMember, resetPassword, setRole } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

const saves: Record<string, string> = { created: "Account created.", role: "Access level changed.", revoked: "Access removed.", password: "Password replaced. This person’s sessions were closed." };
const errors: Record<string, string> = {
  invalid: "Check the form. The password needs at least 12 characters.", exists: "An account already exists for this email.",
  last_admin: "At least one administrator must always remain.", self: "You cannot change your own access.", not_found: "Account not found.",
};

export default async function AdminTeam({ params, searchParams }: PageProps<"/[lang]/admin/team">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const [team, me] = await Promise.all([listTeam(), staffActor()]);
  return <section className="wrap">
    <PageHeader title="Staff and access" intro="Who can sign in to the team area. Staff handle orders, counter sales and the loyalty scanner. Administrators also manage the menu, prices, hours, tax, rewards, reports and settings."/>
    <Notice saved={query.saved} error={query.error} saves={saves} errors={errors}/>
    <ul className="admin-list">{team.map(member => <li key={member.id} className="admin-form">
      <h2>{member.name}{member.id === me && <small> (you)</small>} <Badge tone={member.role === "ADMIN" ? "warn" : "neutral"}>{member.role === "ADMIN" ? "Administrator" : "Staff"}</Badge></h2>
      <p className="admin-hint">{member.email} · added {pickupDate(new Date(member.created_at).toISOString(), "en")}</p>
      {member.id !== me && <div className="admin-row-actions" style={{ justifyContent: "flex-start" }}>
        <form action={setRole.bind(null, lang)}><input type="hidden" name="id" value={member.id}/>
          <Submit className="outline" name="role" value={member.role === "ADMIN" ? "STAFF" : "ADMIN"} confirm={member.role === "ADMIN" ? `Make ${member.name} Staff? They will lose access to the administration.` : `Make ${member.name} an Administrator? They will be able to change prices, hours, tax and rewards.`}>{member.role === "ADMIN" ? "Make staff" : "Make administrator"}</Submit></form>
        <form action={removeMember.bind(null, lang)}><input type="hidden" name="id" value={member.id}/>
          <Submit className="danger" confirm={`Remove ${member.name}’s access? They will be signed out immediately.`}>Remove access</Submit></form>
      </div>}
      {member.id !== me && <form action={resetPassword.bind(null, lang)} className="admin-cols"><input type="hidden" name="id" value={member.id}/>
        <label>New password (12 characters minimum)<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
        <div style={{ alignSelf: "end" }}><Submit className="outline" confirm={`Replace ${member.name}’s password? Their sessions will be closed.`}>Replace password</Submit></div></form>}
    </li>)}</ul>
    <form className="admin-form" action={addMember.bind(null, lang)} aria-labelledby="add-title">
      <h2 id="add-title">Add a person</h2>
      <div className="admin-cols">
        <label>Name<input name="name" required maxLength={80} autoComplete="off"/></label>
        <label>Email<input name="email" type="email" required maxLength={254} autoComplete="off"/></label>
        <label>Access level<select name="role" defaultValue="STAFF"><option value="STAFF">Staff</option><option value="ADMIN">Administrator</option></select></label>
        <label>Starting password (12 characters minimum)<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
      </div>
      <div><Submit>Create account</Submit></div>
    </form>
  </section>;
}
