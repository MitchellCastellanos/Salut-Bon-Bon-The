import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-salut-lang", request.nextUrl.pathname.split("/")[1]);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/fr/:path*", "/en/:path*"] };
