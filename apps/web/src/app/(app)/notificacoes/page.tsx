import { redirect } from "next/navigation";

export default function NotificacoesPage() {
  redirect("/comunicados?aba=avisos");
}
