import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/feedback";

export function Forbidden() {
  return (
    <EmptyState
      icon={<ShieldAlert className="size-10 text-amber-500" aria-hidden />}
      title="You don’t have access to this page"
      description="Your role doesn’t include the permission required here. Ask a Super Admin if you think this is a mistake."
      action={
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      }
    />
  );
}
