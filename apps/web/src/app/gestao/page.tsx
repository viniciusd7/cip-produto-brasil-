import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PlatformAdminConsole } from "./platform-admin-console";

export default async function GestaoPage() {
  const session = await getServerSession(authOptions);
  return <PlatformAdminConsole token={session?.accessToken || ""} />;
}
