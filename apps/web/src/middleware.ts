import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;
    // Admin CIP sem prefeitura ativa só tem acesso ao console central.
    if (
      token?.isPlatformAdmin &&
      !token.municipioId &&
      pathname !== "/administracao"
    ) {
      return NextResponse.redirect(new URL("/administracao", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/painel/:path*",
    "/planejamento/:path*",
    "/secretarias/:path*",
    "/minha-pasta/:path*",
    "/carteira/:path*",
    "/acoes/:path*",
    "/iniciativas/:path*",
    "/pendencias/:path*",
    "/administracao/:path*",
    "/relatorios/:path*",
    "/importacao/:path*",
    "/comunicados/:path*",
    "/implantacao/:path*",
    "/validacoes/:path*",
    "/notificacoes/:path*",
  ],
};
