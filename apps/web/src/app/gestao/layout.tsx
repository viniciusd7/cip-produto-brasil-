import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { SairButton } from "./sair-button";

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.user?.isPlatformAdmin) redirect("/login");

  return (
    <div className="gestao-shell">
      <header className="gestao-shell__top">
        <div className="gestao-shell__brand">
          <BrandLogo priority />
          <div>
            <strong>Gestão CIP</strong>
            <span>Console interno · prefeituras, consultores e prefeitos</span>
          </div>
        </div>
        <div className="gestao-shell__user">
          <span>{session.user.name}</span>
          <SairButton />
        </div>
      </header>
      <main className="gestao-shell__main">{children}</main>
    </div>
  );
}
