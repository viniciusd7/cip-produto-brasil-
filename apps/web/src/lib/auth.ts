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
      isPlatformAdmin: boolean;
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
        municipioId: { label: "Prefeitura", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        try {
          const result = await apiFetch<LoginResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              ...(credentials.municipioId
                ? { municipioId: credentials.municipioId }
                : {}),
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
            isPlatformAdmin: result.data.user.isPlatformAdmin,
            accessToken: result.data.accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.role = (user as { role?: string }).role;
        token.municipioId = (user as { municipioId?: string }).municipioId;
        token.municipioNome = (user as { municipioNome?: string }).municipioNome;
        token.secretariaId = (user as { secretariaId?: string | null }).secretariaId;
        token.isPlatformAdmin = (user as { isPlatformAdmin?: boolean }).isPlatformAdmin;
      }
      if (trigger === "update" && session?.accessToken) {
        const result = await apiFetch<{
          data: {
            id: string;
            role: string;
            municipioId: string;
            municipioNome: string;
            secretariaId?: string | null;
            isPlatformAdmin: boolean;
          };
        }>("/auth/me", { token: session.accessToken });
        if (result.data.id !== token.sub) {
          throw new Error("O contexto de sessão não corresponde à conta autenticada.");
        }
        token.accessToken = session.accessToken;
        token.role = result.data.role;
        token.municipioId = result.data.municipioId;
        token.municipioNome = result.data.municipioNome;
        token.secretariaId = result.data.secretariaId;
        token.isPlatformAdmin = result.data.isPlatformAdmin;
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
        session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
