"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export function InviteLinkDialog({ url, email, onClose }: { url: string | null; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; the field is selectable */
    }
  }

  return (
    <Modal
      open={url !== null}
      onClose={onClose}
      title="Share the invitation link"
      description={`No email provider is configured yet, so ${email} won’t receive an email.`}
      size="md"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <p className="mb-3 text-sm text-slate-600">
        Send this one-time link to the user over a secure channel. It lets them set their password and expires in 72 hours. It is shown only once.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={url ?? ""} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Modal>
  );
}
