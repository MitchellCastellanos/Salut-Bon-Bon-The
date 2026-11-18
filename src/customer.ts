import { headers } from "next/headers";
import { customerAuth } from "./auth";

export type CustomerSession = { id: string; email: string; name: string };

/** The signed-in customer, or undefined. Staff and admin identities never resolve here. */
export async function customerSession(): Promise<CustomerSession | undefined> {
  const auth = customerAuth();
  if (!auth) return undefined;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "CUSTOMER" || !session.user.emailVerified) return undefined;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}
