import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { apiFetch } from "./api";

type LoginResponse = {
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      municipioId: string;
      municipioNome: string;
      secretariaId?: string | null;
    };
  };
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        try {
          const result = await apiFetch<LoginResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          return {
            id: result.data.user.id,
            email: result.data.user.email,
            name: result.data.user.name,
            role: result.data.user.role,
            municipioId: result.data.user.municipioId,
            municipioNome: result.data.user.municipioNome,
            secretariaId: result.data.user.secretariaId,
            accessToken: result.data.accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.role = (user as { role?: string }).role;
        token.municipioId = (user as { municipioId?: string }).municipioId;
        token.municipioNome = (user as { municipioNome?: string }).municipioNome;
        token.secretariaId = (user as { secretariaId?: string | null }).secretariaId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = (token.role as string) || "leitura";
        session.user.municipioId = (token.municipioId as string) || "";
        session.user.municipioNome = (token.municipioNome as string) || "";
        session.user.secretariaId =
          (token.secretariaId as string | null | undefined) ?? null;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
