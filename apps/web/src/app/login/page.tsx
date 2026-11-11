import { headers } from "next/headers";
import { gestaoUrl, isGestaoHost, prefeituraUrl } from "@/lib/hosts";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ negado?: string }>;
}) {
  const host = (await headers()).get("host") || "";
  const { negado } = await searchParams;
  const gestao = isGestaoHost(host);
  return (
    <LoginForm
      area={gestao ? "gestao" : "prefeitura"}
      outroEndereco={gestao ? prefeituraUrl(host) : gestaoUrl(host)}
      negado={negado === "1"}
    />
  );
}
