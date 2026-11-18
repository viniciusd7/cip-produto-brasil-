import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { gestaoUrl, isGestaoHost, isLocalSameOriginHost } from "@/lib/hosts";

const PUBLIC = ["/login", "/manifest.webmanifest", "/offline.html"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") || "";
  // PWA resources carry no session data and must work on both application hosts.
  if (pathname === "/manifest.webmanifest" || pathname === "/offline.html") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const localSameOrigin = isLocalSameOriginHost(host);

  if (isGestaoHost(host)) {
    if (PUBLIC.includes(pathname)) return NextResponse.next();
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (!token.isPlatformAdmin) {
      return NextResponse.redirect(new URL("/login?negado=1", req.url));
    }
    if (pathname === "/") return NextResponse.rewrite(new URL("/gestao", req.url));
    if (pathname.startsWith("/gestao")) return NextResponse.next();
    // Rotas das prefeituras não existem no console da CIP.
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Em localhost, o console CIP fica em /gestao no mesmo host (sessão compartilhada).
  if (pathname.startsWith("/gestao")) {
    if (localSameOrigin) {
      if (!token) return NextResponse.redirect(new URL("/login", req.url));
      if (!token.isPlatformAdmin) {
        return NextResponse.redirect(new URL("/login?negado=1", req.url));
      }
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(`${gestaoUrl(host)}/`));
  }
  if (PUBLIC.includes(pathname) || pathname === "/") return NextResponse.next();
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (token.isPlatformAdmin && !token.municipioId) {
    const dest = localSameOrigin
      ? new URL("/gestao", req.url)
      : new URL(`${gestaoUrl(host)}/`);
    return NextResponse.redirect(dest);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)"],
};
