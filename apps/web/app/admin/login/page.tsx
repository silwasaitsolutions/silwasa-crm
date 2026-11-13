import { Suspense } from "react";
import { LoginForm } from "@/features/admin-auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
