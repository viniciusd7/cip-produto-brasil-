import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

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
  ],
};
