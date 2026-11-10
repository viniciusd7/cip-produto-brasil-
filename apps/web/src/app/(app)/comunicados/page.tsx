import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ComunicacaoProjeto } from "@/components/comunicacao-projeto";
export default async function ComunicadosPage() {
  const session = await getServerSession(authOptions);
  return <ComunicacaoProjeto token={session?.accessToken || ""} />;
}
