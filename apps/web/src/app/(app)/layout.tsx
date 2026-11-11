import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect("/login");

  // NextAuth pode permanecer válido com JWT da API já expirado.
  try {
    await apiFetch("/auth/me", { token: session.accessToken });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/login");
    }
    // API fora do ar: deixa a página tratar o erro da chamada própria.
  }

  return (
    <AppShell
      initialRole={session.user?.role}
      initialName={session.user?.name}
      initialMunicipio={session.user?.municipioNome}
      initialIsPlatformAdmin={session.user?.isPlatformAdmin}
    >
      {children}
    </AppShell>
  );
}
