import { QrCard } from "../app/[lang]/account/qr-card";
import { replaceCardQr } from "../app/[lang]/account/actions";
import { logoMarkup, officialLogo } from "./brand-server";
import type { Lang } from "./domain";
import { ensureIdentifier, identifierUrl } from "./identification";
import { brandedQr } from "./qr-logo";
import { siteOrigin } from "./site-origin";
import { walletConfigured } from "./wallet";

/**
 * The digital loyalty card: a stable identification QR with the official logo (what staff scan, and what the Apple Wallet pass carries),
 * the Wallet action, and an optional single-use redemption code. The QR holds only an opaque identifier, never personal data.
 */
export async function MemberCard({ lang, accountId, memberCode, background }: { lang: Lang; accountId: string; memberCode: string; background?: string }) {
  const fr = lang === "fr";
  const id = await ensureIdentifier(accountId);
  const logo = officialLogo();
  const qr = id.revoked ? undefined : brandedQr(identifierUrl(id.value, await siteOrigin()), { logoSvg: logoMarkup(), title: fr ? "Code QR de la carte de fidélité" : "Loyalty card QR code" });
  const wallet = walletConfigured();
  return <>
    <section className="panel rewards-card" aria-labelledby="card-title" style={background ? { backgroundImage: `linear-gradient(rgba(255,248,239,.85), rgba(255,248,239,.85)), url(${background})`, backgroundSize: "cover" } : undefined}>
      <h2 id="card-title">{fr ? "Ma carte Récompenses Salut" : "My Salut Rewards card"}</h2>
      {qr ? <div className="qr member-qr" role="img" aria-label={fr ? "Code QR de la carte de fidélité" : "Loyalty card QR code"} data-testid="member-qr" dangerouslySetInnerHTML={{ __html: qr.svg }}/>
        : <p role="alert">{fr ? "Ce code a été désactivé. Remplacez-le pour obtenir un nouveau code." : "This code was disabled. Replace it to get a new one."}</p>}
      <p>{fr ? "Numéro de membre" : "Member number"} <strong className="member-code">{memberCode}</strong></p>
      <p className="fine-print">{fr ? "Présentez ce code au comptoir : le personnel le scanne pour ajouter vos tampons ou vous remettre votre récompense." : "Show this code at the counter: staff scan it to add your stamps or hand over your reward."}</p>
      <div className="filters">
        {wallet ? <a className="button" href={`/api/wallet/pass?lang=${lang}`}>{fr ? "Ajouter à Apple Wallet" : "Add to Apple Wallet"}</a>
          : <span className="pill" role="status">{fr ? "Apple Wallet : bientôt (en attente des identifiants Apple)" : "Apple Wallet: coming soon (waiting for Apple credentials)"}</span>}
        <form action={replaceCardQr.bind(null, lang)}><button className="outline">{fr ? "Remplacer mon code QR" : "Replace my QR code"}</button></form>
      </div>
    </section>
    <QrCard lang={lang} memberCode={memberCode} logo={logo} collapsed/>
  </>;
}
