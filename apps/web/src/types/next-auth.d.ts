import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      municipioId: string;
      municipioNome: string;
      secretariaId?: string | null;
    };
  }

  interface User {
    role?: string;
    municipioId?: string;
    municipioNome?: string;
    secretariaId?: string | null;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: string;
    municipioId?: string;
    municipioNome?: string;
    secretariaId?: string | null;
  }
}
