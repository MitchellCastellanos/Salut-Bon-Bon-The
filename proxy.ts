import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  // The administration and staff console is English only: French URLs redirect to the English ones.
  const { pathname, search } = request.nextUrl;
  if (/^\/fr\/(?:admin|staff)(?:\/|$)/.test(pathname)) return NextResponse.redirect(new URL(pathname.replace(/^\/fr/, "/en") + search, request.url));
  const headers = new Headers(request.headers);
  headers.set("x-salut-lang", request.nextUrl.pathname.split("/")[1]);
  headers.set("x-salut-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/fr/:path*", "/en/:path*"] };
