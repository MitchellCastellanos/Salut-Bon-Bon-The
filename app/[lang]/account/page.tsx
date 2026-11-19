import Link from "next/link";
import { notFound } from "next/navigation";
import { accountEmailAvailable } from "../../../src/account-email";
import { staffAuthConfigured } from "../../../src/auth";
import { usesOfficialCatalog } from "../../../src/catalog-mode";
import { customerSession } from "../../../src/customer";
import { database } from "../../../src/db";
import { language, money, pickupDate, stateLabels, type State } from "../../../src/domain";
import { accountForUser, loyaltyProgram } from "../../../src/loyalty";
import { rewardsName } from "../../../src/storefront-content";
import { hasPublicImage, StorefrontArt } from "../../../src/storefront-art";
import { forgotPassword, joinRewards, login, logout, register, updateProfile } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

const notices: Record<string, [string, string]> = {
  registered: ["Si l’adresse est valide, un courriel de confirmation vient d’être envoyé. Confirmez-le avant de vous connecter.", "If the address is valid, a confirmation email was just sent. Confirm it before signing in."],
  created: ["Compte créé. Vous pouvez maintenant vous connecter.", "Account created. You can now sign in."],
  verified: ["Courriel confirmé. Vous pouvez maintenant vous connecter.", "Email confirmed. You can now sign in."],
  forgot: ["Si un compte existe pour cette adresse, un courriel de réinitialisation a été envoyé.", "If an account exists for this address, a reset email was sent."],
  reset: ["Mot de passe mis à jour. Connectez-vous avec le nouveau mot de passe.", "Password updated. Sign in with your new password."],
  saved: ["Profil enregistré.", "Profile saved."],
};
const errors: Record<string, [string, string]> = {
  login: ["Courriel ou mot de passe invalide, ou courriel non confirmé.", "Invalid email or password, or the email is not confirmed."],
  register: ["Vérifiez le formulaire. Le mot de passe doit contenir au moins 12 caractères.", "Check the form. The password needs at least 12 characters."],
  rate: ["Trop de tentatives. Réessayez plus tard.", "Too many attempts. Try again later."],
  unavailable: ["Les comptes clients ne sont pas disponibles : le service de courriel n’est pas configuré.", "Customer accounts are unavailable: the email service is not configured."],
  verify: ["Ce lien de confirmation est invalide ou expiré.", "This confirmation link is invalid or expired."],
  profile: ["Impossible d’enregistrer le profil.", "Could not save the profile."],
};

export default async function AccountPage({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const t = (pair: [string, string]) => pair[fr ? 0 : 1];
  const query = await searchParams;
  const flag = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const notice = Object.keys(notices).find(key => flag(key)) ;
  const error = errors[flag("error")];
  const available = usesOfficialCatalog() && staffAuthConfigured();
  if (!available) return <section className="wrap section narrow"><h1>{fr ? "Mon compte" : "My account"}<span>.</span></h1>
    <p role="status">{fr ? "Les comptes clients nécessitent la base de données et l’authentification configurées pour cet environnement." : "Customer accounts need the database and authentication configured for this environment."}</p></section>;
  const session = await customerSession();
  const banner = <>{notice && <p role="status" className="panel">{t(notices[notice])}</p>}{error && <p role="alert" className="panel">{t(error)}</p>}</>;
  if (!session) {
    const canRegister = accountEmailAvailable();
    return <section className="wrap section">
      {hasPublicImage("/rewards/campaign-banner.webp") && <div className="art-banner"><StorefrontArt path="/rewards/campaign-banner.webp" sizes="(max-width: 900px) 100vw, 1100px" priority/></div>}
      <p className="eyebrow">{rewardsName[lang]}</p><h1>{fr ? "Mon compte" : "My account"}<span>.</span></h1>
      {banner}
      <p>{fr ? "Créez un compte pour suivre vos commandes et cumuler des points avec Récompenses Salut." : "Create an account to follow your orders and earn points with Salut Rewards."}</p>
      {hasPublicImage("/account/welcome.webp") && <div className="art-banner welcome"><StorefrontArt path="/account/welcome.webp" sizes="(max-width: 900px) 100vw, 480px"/></div>}
      <div className="order-grid">
        <form className="panel checkout" action={login.bind(null, lang)} aria-labelledby="login-title">
          <h2 id="login-title">{fr ? "Connexion" : "Sign in"}</h2>
          <label>{fr ? "Courriel" : "Email"}<input name="email" type="email" required maxLength={254} autoComplete="username"/></label>
          <label>{fr ? "Mot de passe" : "Password"}<input name="password" type="password" required maxLength={128} autoComplete="current-password"/></label>
          <button className="button">{fr ? "Se connecter" : "Sign in"}</button>
        </form>
        {canRegister ? <form className="panel checkout" action={register.bind(null, lang)} aria-labelledby="register-title">
          <h2 id="register-title">{fr ? "Créer un compte" : "Create an account"}</h2>
          <label>{fr ? "Prénom et nom" : "Full name"}<input name="name" required maxLength={80} autoComplete="name"/></label>
          <label>{fr ? "Courriel" : "Email"}<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
          <label>{fr ? "Mot de passe (12 caractères minimum)" : "Password (12 characters minimum)"}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
          <label><input type="checkbox" name="accept" required/> {fr ? <>J’accepte la <Link href={`/${lang}/legal/privacy`}>politique de confidentialité</Link>.</> : <>I accept the <Link href={`/${lang}/legal/privacy`}>privacy policy</Link>.</>}</label>
          <p className="fine-print">{fr ? "Nous n’utilisons votre courriel que pour votre compte et vos commandes. Aucune infolettre." : "We only use your email for your account and orders. No newsletter."}</p>
          <button className="button">{fr ? "Créer mon compte" : "Create my account"}</button>
        </form> : <div className="panel"><h2>{fr ? "Créer un compte" : "Create an account"}</h2><p role="status">{t(errors.unavailable)}</p></div>}
      </div>
      <details className="panel"><summary>{fr ? "Mot de passe oublié ?" : "Forgot your password?"}</summary>
        <form className="checkout" action={forgotPassword.bind(null, lang)}>
          <label>{fr ? "Courriel" : "Email"}<input name="email" type="email" required maxLength={254}/></label>
          <button className="outline">{fr ? "Envoyer le lien" : "Send the link"}</button>
        </form></details>
    </section>;
  }
  const db = await database();
  const [account, program] = await Promise.all([accountForUser(session.id, db), loyaltyProgram(db)]);
  const { rows: orders } = await db.query<{ number: string; status: State; pickup_at: Date | string; total: number; created_at: Date | string; tracking_token: string }>(
    `SELECT number::text AS number, status, pickup_at, total, created_at, tracking_token FROM orders WHERE customer_user_id = $1 ORDER BY created_at DESC LIMIT 50`, [session.id]);
  return <section className="wrap section">
    <div className="section-head"><div><p className="eyebrow">{rewardsName[lang]}</p><h1>{fr ? "Mon compte" : "My account"}<span>.</span></h1></div>
      <form action={logout.bind(null, lang)}><button className="outline">{fr ? "Se déconnecter" : "Sign out"}</button></form></div>
    {banner}
    <div className="order-grid">
      <section className="panel" aria-labelledby="rewards-title"><h2 id="rewards-title">{rewardsName[lang]}</h2>
        {account ? <><p className="total">{fr ? "Solde" : "Balance"} <strong>{account.balance} {fr ? "points" : "points"}</strong></p>
          <p>{program.active ? (fr ? "Programme actif." : "Program active.") : (fr ? "Le programme n’est pas actif pour le moment : aucun point n’est cumulé." : "The program is not active right now: no points are being earned.")}</p>
          <Link className="button" href={`/${lang}/account/rewards`}>{fr ? "Voir ma carte et mes récompenses" : "View my card and rewards"}</Link></> :
          <><p>{fr ? "Adhérez gratuitement pour obtenir votre carte et cumuler des points." : "Join for free to get your card and earn points."}</p>
            <form action={joinRewards.bind(null, lang)}><button className="button">{fr ? "Adhérer à Récompenses Salut" : "Join Salut Rewards"}</button></form></>}
      </section>
      <form className="panel checkout" action={updateProfile.bind(null, lang)} aria-labelledby="profile-title">
        <h2 id="profile-title">{fr ? "Profil" : "Profile"}</h2>
        <label>{fr ? "Nom" : "Name"}<input name="name" required maxLength={80} defaultValue={session.name} autoComplete="name"/></label>
        <p>{fr ? "Courriel" : "Email"}: <strong>{session.email}</strong></p>
        <button className="outline">{fr ? "Enregistrer" : "Save"}</button>
      </form>
    </div>
    <h2>{fr ? "Mes commandes" : "My orders"}</h2>
    {!orders.length ? <p>{fr ? "Aucune commande pour le moment." : "No orders yet."}</p> :
      <ul className="catalog-grid">{orders.map(order => <li key={order.number}>
        <Link href={`/${lang}/track/${order.tracking_token}`}><strong>#{order.number}</strong></Link>
        <small>{stateLabels[order.status][lang]} · {pickupDate(new Date(order.pickup_at).toISOString(), lang)}</small>
        <span>{money(order.total, lang)}</span></li>)}</ul>}
  </section>;
}
