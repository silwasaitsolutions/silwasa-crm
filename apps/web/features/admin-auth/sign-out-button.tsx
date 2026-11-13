"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/admin-api";
import { buttonClass } from "./auth-card";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await authApi.logout();
        } finally {
          router.replace("/admin/login");
          router.refresh();
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
