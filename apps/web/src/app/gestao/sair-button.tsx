"use client";

import { signOut } from "next-auth/react";

export function SairButton() {
  return (
    <button type="button" className="cip-btn cip-btn--ghost" onClick={() => void signOut({ callbackUrl: "/login" })}>
      Sair
    </button>
  );
}
